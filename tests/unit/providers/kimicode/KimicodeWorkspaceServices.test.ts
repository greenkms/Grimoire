import { createKimicodeWorkspaceServices } from '@/providers/kimicode/app/KimicodeWorkspaceServices';
import { KimicodeChatRuntime } from '@/providers/kimicode/runtime/KimicodeChatRuntime';
import { getKimicodeProviderSettings, updateKimicodeProviderSettings } from '@/providers/kimicode/settings';

describe('createKimicodeWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes Kimi Code model discovery through an isolated workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateKimicodeProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const syncConversationStateSpy = jest.spyOn(KimicodeChatRuntime.prototype, 'syncConversationState');
    const ensureReadySpy = jest
      .spyOn(KimicodeChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: KimicodeChatRuntime) {
        updateKimicodeProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        });
        return true;
      });
    const cleanupSpy = jest.spyOn(KimicodeChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createKimicodeWorkspaceServices(plugin as any, vaultAdapter as any);
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
    expect(getKimicodeProviderSettings(settings).discoveredModels).toEqual([
      { label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' },
    ]);
  });

  it('uses cached Kimi Code discovered models without warming the runtime again', async () => {
    const settings: Record<string, unknown> = {};
    updateKimicodeProviderSettings(settings, {
      discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
      enabled: true,
      visibleModels: ['openai/gpt-5.6'],
    });
    const plugin = {
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest.spyOn(KimicodeChatRuntime.prototype, 'ensureReady');
    const cleanupSpy = jest.spyOn(KimicodeChatRuntime.prototype, 'cleanup');
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createKimicodeWorkspaceServices(plugin as any, vaultAdapter as any);
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(false);
    expect(ensureReadySpy).not.toHaveBeenCalled();
    expect(cleanupSpy).not.toHaveBeenCalled();
    expect(plugin.recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 1,
        providerId: 'kimicode',
        reason: 'cache_fresh',
      }),
      event: 'modelCatalog.refresh.skipped',
      level: 'debug',
      scope: 'provider.kimicode',
    }));
  });
});
