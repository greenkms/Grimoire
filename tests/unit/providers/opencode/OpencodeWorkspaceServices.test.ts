import { createOpencodeWorkspaceServices } from '@/providers/opencode/app/OpencodeWorkspaceServices';
import { OpencodeChatRuntime } from '@/providers/opencode/runtime/OpencodeChatRuntime';
import { getOpencodeProviderSettings, updateOpencodeProviderSettings } from '@/providers/opencode/settings';

describe('createOpencodeWorkspaceServices', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes OpenCode model discovery through an isolated workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateOpencodeProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const syncConversationStateSpy = jest.spyOn(OpencodeChatRuntime.prototype, 'syncConversationState');
    const ensureReadySpy = jest
      .spyOn(OpencodeChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: OpencodeChatRuntime) {
        updateOpencodeProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' }],
          visibleModels: ['openai/gpt-5.6'],
        } as any);
        return true;
      });
    const cleanupSpy = jest.spyOn(OpencodeChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const vaultAdapter = {
      delete: jest.fn(),
      ensureFolder: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      listFiles: jest.fn().mockResolvedValue([]),
      read: jest.fn(),
      write: jest.fn(),
    };

    const services = await createOpencodeWorkspaceServices(plugin as any, vaultAdapter as any);
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
    expect(getOpencodeProviderSettings(settings).discoveredModels).toEqual([
      { label: 'OpenAI/GPT-5.6', rawId: 'openai/gpt-5.6' },
    ]);
  });
});
