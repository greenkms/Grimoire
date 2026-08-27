import { createMimocodeWorkspaceServices } from '@/providers/mimocode/app/MimocodeWorkspaceServices';
import { MimocodeChatRuntime } from '@/providers/mimocode/runtime/MimocodeChatRuntime';
import { getMimocodeProviderSettings, updateMimocodeProviderSettings } from '@/providers/mimocode/settings';

describe('createMimocodeWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes MiMoCode model discovery through an isolated workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateMimocodeProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const syncConversationStateSpy = jest.spyOn(MimocodeChatRuntime.prototype, 'syncConversationState');
    const ensureReadySpy = jest
      .spyOn(MimocodeChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: MimocodeChatRuntime) {
        updateMimocodeProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        });
        return true;
      });
    const cleanupSpy = jest.spyOn(MimocodeChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createMimocodeWorkspaceServices(plugin as any, vaultAdapter as any);
    expect(services.usageProvider).toBeDefined();
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(true);
    expect(syncConversationStateSpy).toHaveBeenCalledWith({
      providerState: { databasePath: ':memory:' },
      sessionId: null,
    });
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(cleanupSpy).toHaveBeenCalled();
    expect(getMimocodeProviderSettings(settings).discoveredModels).toEqual([
      { label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' },
    ]);
  });

  it('boots the runtime once and then reuses the discovered models for the rest of the process', async () => {
    const settings: Record<string, unknown> = {};
    updateMimocodeProviderSettings(settings, { enabled: true });
    const plugin = {
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest
      .spyOn(MimocodeChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: MimocodeChatRuntime) {
        updateMimocodeProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        });
        return true;
      });
    const cleanupSpy = jest.spyOn(MimocodeChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createMimocodeWorkspaceServices(plugin as any, vaultAdapter as any);
    const discovered = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });
    const reused = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(discovered).toBe(true);
    expect(reused).toBe(false);
    expect(ensureReadySpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(plugin.recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 1,
        providerId: 'mimocode',
        reason: 'cache_fresh',
      }),
      event: 'modelCatalog.refresh.skipped',
      level: 'debug',
      scope: 'provider.mimocode',
    }));
  });

  it('rediscovers a list carried over from a legacy persisted field instead of pinning it', async () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          discoveredModels: [{ label: 'OpenAI/GPT-5.5', rawId: 'openai/gpt-5.5' }],
          enabled: true,
          visibleModels: ['openai/gpt-5.5'],
        },
      },
    };
    const plugin = {
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest
      .spyOn(MimocodeChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: MimocodeChatRuntime) {
        updateMimocodeProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        });
        return true;
      });
    jest.spyOn(MimocodeChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createMimocodeWorkspaceServices(plugin as any, vaultAdapter as any);
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(true);
    expect(ensureReadySpy).toHaveBeenCalledTimes(1);
    expect(getMimocodeProviderSettings(settings).discoveredModels).toEqual([
      { label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' },
    ]);
  });
});
