import { createGeminiWorkspaceServices } from '@/providers/gemini/app/GeminiWorkspaceServices';
import { GeminiChatRuntime } from '@/providers/gemini/runtime/GeminiChatRuntime';

describe('createGeminiWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a usage provider for ACP cost updates', async () => {
    const services = await createGeminiWorkspaceServices({} as any, {} as any);

    expect(services.commandCatalog).toBeDefined();
    expect(services.usageProvider).toBeDefined();
  });

  it('skips discovery while a seeded catalog stays fresh so opening the model dropdown does not boot the CLI', async () => {
    const ensureReady = jest.spyOn(GeminiChatRuntime.prototype, 'ensureReady');
    const cleanup = jest.spyOn(GeminiChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        gemini: {
          discoveredModels: [{ label: 'Gemini 2.5 Pro', rawId: 'gemini-2.5-pro' }],
          enabled: true,
        },
      },
    };
    const plugin = { settings };

    const services = await createGeminiWorkspaceServices(plugin as any, {} as any);
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings: settings,
    });

    expect(changed).toBe(false);
    expect(ensureReady).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('rediscovers models when the resolved CLI path changes', async () => {
    const ensureReady = jest
      .spyOn(GeminiChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(GeminiChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        gemini: {
          discoveredModels: [{ label: 'Gemini 2.5 Pro', rawId: 'gemini-2.5-pro' }],
          enabled: true,
        },
      },
    };
    let resolvedCliPath = '/usr/local/bin/gemini';
    const plugin = {
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createGeminiWorkspaceServices(plugin as any, {} as any);
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });
    expect(ensureReady).not.toHaveBeenCalled();

    resolvedCliPath = '/opt/homebrew/bin/gemini';
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('suppresses the reload warmup when the CLI resolver is not reachable yet at construction', async () => {
    const ensureReady = jest
      .spyOn(GeminiChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(GeminiChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        gemini: {
          discoveredModels: [{ label: 'Gemini 2.5 Pro', rawId: 'gemini-2.5-pro' }],
          enabled: true,
        },
      },
    };
    // Production ordering: the catalog is built inside createGeminiWorkspaceServices,
    // which runs *inside* ProviderWorkspaceRegistry.initialize(). The registry only
    // assigns this.services[providerId] after initialize() resolves, so the CLI
    // resolver - and with it the resolved path - appears only afterwards.
    let resolvedCliPath: string | null = null;
    const plugin = {
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createGeminiWorkspaceServices(plugin as any, {} as any);
    resolvedCliPath = '/usr/local/bin/gemini';
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings: settings,
    });

    expect(changed).toBe(false);
    expect(ensureReady).not.toHaveBeenCalled();
  });

  it('still rediscovers when the environment changed before the first refresh', async () => {
    const ensureReady = jest
      .spyOn(GeminiChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(GeminiChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        gemini: {
          discoveredModels: [{ label: 'Gemini 2.5 Pro', rawId: 'gemini-2.5-pro' }],
          enabled: true,
        },
      },
    };
    let activeEnvironment = 'GEMINI_API_KEY=old';
    let resolvedCliPath: string | null = null;
    const plugin = {
      getActiveEnvironmentVariables: () => activeEnvironment,
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createGeminiWorkspaceServices(plugin as any, {} as any);
    resolvedCliPath = '/usr/local/bin/gemini';
    activeEnvironment = 'GEMINI_API_KEY=new';
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });
});
