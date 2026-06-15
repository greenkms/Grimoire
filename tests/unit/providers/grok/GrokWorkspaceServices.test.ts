import { createGrokWorkspaceServices } from '@/providers/grok/app/GrokWorkspaceServices';
import { GrokChatRuntime } from '@/providers/grok/runtime/GrokChatRuntime';
import { getGrokProviderSettings, updateGrokProviderSettings } from '@/providers/grok/settings';

describe('createGrokWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes Grok Build model discovery through an isolated workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateGrokProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const syncConversationStateSpy = jest.spyOn(GrokChatRuntime.prototype, 'syncConversationState');
    const ensureReadySpy = jest
      .spyOn(GrokChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: GrokChatRuntime) {
        updateGrokProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        } as any);
        return true;
      });
    const cleanupSpy = jest.spyOn(GrokChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createGrokWorkspaceServices(plugin as any, vaultAdapter as any);
    expect(services.usageProvider).toBeDefined();
    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(true);
    expect(syncConversationStateSpy).toHaveBeenCalledWith({
      providerState: {},
      sessionId: null,
    });
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(cleanupSpy).toHaveBeenCalled();
    expect(getGrokProviderSettings(settings).discoveredModels).toEqual([
      { label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' },
    ]);
  });

  it('uses cached Grok Build discovered models without warming the runtime again', async () => {
    const settings: Record<string, unknown> = {};
    updateGrokProviderSettings(settings, {
      discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
      enabled: true,
      visibleModels: ['openai/gpt-5.6'],
    } as any);
    const plugin = {
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest.spyOn(GrokChatRuntime.prototype, 'ensureReady');
    const cleanupSpy = jest.spyOn(GrokChatRuntime.prototype, 'cleanup');
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createGrokWorkspaceServices(plugin as any, vaultAdapter as any);
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
        providerId: 'grok',
        reason: 'cache_fresh',
      }),
      event: 'modelCatalog.refresh.skipped',
      level: 'debug',
      scope: 'provider.grok',
    }));
  });
});
