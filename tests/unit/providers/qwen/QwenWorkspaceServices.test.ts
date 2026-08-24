import { createQwenWorkspaceServices } from '@/providers/qwen/app/QwenWorkspaceServices';
import { QwenChatRuntime } from '@/providers/qwen/runtime/QwenChatRuntime';

describe('createQwenWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a usage provider for ACP cost updates', async () => {
    const services = await createQwenWorkspaceServices({} as any, {} as any);

    expect(services.commandCatalog).toBeDefined();
    expect(services.usageProvider).toBeDefined();
  });

  it('skips discovery while a seeded catalog stays fresh so opening the model dropdown does not boot the CLI', async () => {
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
});
