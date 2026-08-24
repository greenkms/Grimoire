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
});
