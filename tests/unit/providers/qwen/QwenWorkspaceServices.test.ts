import { hashCatalogFingerprint } from '@/core/providers/catalogFingerprint';
import { createQwenWorkspaceServices } from '@/providers/qwen/app/QwenWorkspaceServices';
import { resolveQwenModelCatalogFingerprint } from '@/providers/qwen/modelCatalogFingerprint';
import { QwenChatRuntime } from '@/providers/qwen/runtime/QwenChatRuntime';
import { getQwenProviderSettings } from '@/providers/qwen/settings';

function recordedFingerprintFor(cliPath: string): string {
  return hashCatalogFingerprint(
    resolveQwenModelCatalogFingerprint(
      { getResolvedProviderCliPath: () => cliPath } as any,
      getQwenProviderSettings({ providerConfigs: { qwen: { enabled: true } } }),
    ),
  );
}

describe('createQwenWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a usage provider for ACP cost updates', async () => {
    const services = await createQwenWorkspaceServices({} as any, {} as any);

    expect(services.commandCatalog).toBeDefined();
    expect(services.usageProvider).toBeDefined();
  });

  it('keeps trusting a catalog persisted before the fingerprint existed', async () => {
    const ensureReady = jest.spyOn(QwenChatRuntime.prototype, 'ensureReady');
    const cleanup = jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          enabled: true,
        },
      },
    };
    const plugin = { settings };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
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
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          enabled: true,
        },
      },
    };
    let resolvedCliPath = '/usr/local/bin/qwen';
    const plugin = {
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });
    expect(ensureReady).not.toHaveBeenCalled();

    resolvedCliPath = '/opt/homebrew/bin/qwen';
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('suppresses the reload warmup when the CLI resolver is not reachable yet at construction', async () => {
    const ensureReady = jest
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          enabled: true,
        },
      },
    };
    // Production ordering: the catalog is built inside createQwenWorkspaceServices,
    // which runs *inside* ProviderWorkspaceRegistry.initialize(). The registry only
    // assigns this.services[providerId] after initialize() resolves, so the CLI
    // resolver - and with it the resolved path - appears only afterwards.
    let resolvedCliPath: string | null = null;
    const plugin = {
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    resolvedCliPath = '/usr/local/bin/qwen';
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings: settings,
    });

    expect(changed).toBe(false);
    expect(ensureReady).not.toHaveBeenCalled();
  });

  it('still rediscovers when the environment changed before the first refresh', async () => {
    const ensureReady = jest
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          enabled: true,
        },
      },
    };
    let activeEnvironment = 'QWEN_API_KEY=old';
    let resolvedCliPath: string | null = null;
    const plugin = {
      getActiveEnvironmentVariables: () => activeEnvironment,
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    resolvedCliPath = '/usr/local/bin/qwen';
    activeEnvironment = 'QWEN_API_KEY=new';
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });
  it('seeds a catalog whose recorded fingerprint still matches the resolved CLI', async () => {
    const ensureReady = jest.spyOn(QwenChatRuntime.prototype, 'ensureReady');
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          discoveredModelsFingerprint: recordedFingerprintFor('/usr/local/bin/qwen'),
          enabled: true,
        },
      },
    };
    const plugin = {
      getResolvedProviderCliPath: () => '/usr/local/bin/qwen',
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings: settings,
    });

    expect(changed).toBe(false);
    expect(ensureReady).not.toHaveBeenCalled();
  });

  it('rediscovers when the CLI path changed while the plugin was not running', async () => {
    const ensureReady = jest
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          discoveredModelsFingerprint: recordedFingerprintFor('/usr/local/bin/qwen'),
          enabled: true,
        },
      },
    };
    const plugin = {
      getResolvedProviderCliPath: () => '/opt/homebrew/bin/qwen',
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('rediscovers a changed CLI even when the resolver only arrives after construction', async () => {
    const ensureReady = jest
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockResolvedValue(true);
    jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const settings = {
      providerConfigs: {
        qwen: {
          discoveredModels: [{ label: 'Qwen3 Coder', rawId: 'qwen3-coder-plus' }],
          discoveredModelsFingerprint: recordedFingerprintFor('/usr/local/bin/qwen'),
          enabled: true,
        },
      },
    };
    let resolvedCliPath: string | null = null;
    const plugin = {
      getResolvedProviderCliPath: () => resolvedCliPath,
      settings,
    };

    const services = await createQwenWorkspaceServices(plugin as any, {} as any);
    resolvedCliPath = '/opt/homebrew/bin/qwen';
    await services.modelCatalog?.refreshModels({ plugin: plugin as any, settings: settings });

    expect(ensureReady).toHaveBeenCalledTimes(1);
  });
});
