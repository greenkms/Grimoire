import { GrokRuntimeCommandLoader } from '@/providers/grok/app/GrokRuntimeCommandLoader';
import { GrokChatRuntime } from '@/providers/grok/runtime/GrokChatRuntime';

function createMockPlugin(): any {
  return {
    settings: {
      providerConfigs: {
        grok: {
          enabled: true,
        },
      },
    },
  };
}

describe('GrokRuntimeCommandLoader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses an isolated in-memory session for blank-tab command warmup', async () => {
    const commands = [{ id: 'acp:review', name: 'review', content: '' }];
    const syncSpy = jest.spyOn(GrokChatRuntime.prototype, 'syncConversationState').mockImplementation(() => {});
    const ensureReadySpy = jest.spyOn(GrokChatRuntime.prototype, 'ensureReady').mockResolvedValue(true);
    const getSupportedCommandsSpy = jest.spyOn(GrokChatRuntime.prototype, 'getSupportedCommands').mockResolvedValue(commands);
    const cleanupSpy = jest.spyOn(GrokChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const loader = new GrokRuntimeCommandLoader();

    await expect(loader.loadCommands({
      allowSessionCreation: true,
      conversation: null,
      externalContextPaths: [],
      plugin: createMockPlugin(),
      runtime: null,
    })).resolves.toEqual(commands);

    expect(syncSpy).toHaveBeenCalledWith({
      providerState: {},
      sessionId: null,
    });
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(getSupportedCommandsSpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps blank tabs cold unless warmup is explicitly requested', async () => {
    const ensureReadySpy = jest.spyOn(GrokChatRuntime.prototype, 'ensureReady');
    const loader = new GrokRuntimeCommandLoader();

    await expect(loader.loadCommands({
      conversation: null,
      externalContextPaths: [],
      plugin: createMockPlugin(),
      runtime: null,
    })).resolves.toEqual([]);

    expect(ensureReadySpy).not.toHaveBeenCalled();
  });

  it('warms pre-session conversations that already have messages', async () => {
    const commands = [{ id: 'acp:review', name: 'review', content: '' }];
    const syncSpy = jest.spyOn(GrokChatRuntime.prototype, 'syncConversationState').mockImplementation(() => {});
    const ensureReadySpy = jest.spyOn(GrokChatRuntime.prototype, 'ensureReady').mockResolvedValue(true);
    const getSupportedCommandsSpy = jest.spyOn(GrokChatRuntime.prototype, 'getSupportedCommands').mockResolvedValue(commands);
    const loader = new GrokRuntimeCommandLoader();

    await expect(loader.loadCommands({
      conversation: {
        id: 'conv-grok',
        messages: [{ id: 'm1' }],
        providerState: {},
        sessionId: null,
      } as any,
      externalContextPaths: [],
      plugin: createMockPlugin(),
      runtime: null,
    })).resolves.toEqual(commands);

    expect(syncSpy).toHaveBeenCalledWith({
      id: 'conv-grok',
      messages: [{ id: 'm1' }],
      providerState: {},
      sessionId: null,
    }, []);
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(getSupportedCommandsSpy).toHaveBeenCalledTimes(1);
  });

  it('does not create a pre-session command warmup session on the bound tab runtime', async () => {
    const commands = [{ id: 'acp:review', name: 'review', content: '' }];
    const syncSpy = jest.spyOn(GrokChatRuntime.prototype, 'syncConversationState').mockImplementation(() => {});
    const ensureReadySpy = jest.spyOn(GrokChatRuntime.prototype, 'ensureReady').mockResolvedValue(true);
    const getSupportedCommandsSpy = jest.spyOn(GrokChatRuntime.prototype, 'getSupportedCommands').mockResolvedValue(commands);
    const cleanupSpy = jest.spyOn(GrokChatRuntime.prototype, 'cleanup').mockImplementation(() => {});
    const boundRuntime = {
      providerId: 'grok',
      cleanup: jest.fn(),
      ensureReady: jest.fn(),
      getSupportedCommands: jest.fn(),
      syncConversationState: jest.fn(),
    };
    const loader = new GrokRuntimeCommandLoader();

    await expect(loader.loadCommands({
      conversation: {
        id: 'conv-grok',
        messages: [{ id: 'm1' }],
        providerState: {},
        sessionId: null,
      } as any,
      externalContextPaths: [],
      plugin: createMockPlugin(),
      runtime: boundRuntime as any,
    })).resolves.toEqual(commands);

    expect(boundRuntime.syncConversationState).not.toHaveBeenCalled();
    expect(boundRuntime.ensureReady).not.toHaveBeenCalled();
    expect(boundRuntime.getSupportedCommands).not.toHaveBeenCalled();
    expect(syncSpy).toHaveBeenCalledWith({
      id: 'conv-grok',
      messages: [{ id: 'm1' }],
      providerState: {},
      sessionId: null,
    }, []);
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(getSupportedCommandsSpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
