import * as fs from 'node:fs/promises';

import type { PreparedChatTurn } from '@/core/runtime/types';
import type { StreamChunk } from '@/core/types';
import type { AcpContentBlock } from '@/providers/acp';
import { GeminiChatRuntime } from '@/providers/gemini/runtime/GeminiChatRuntime';
import { getGeminiProviderSettings, updateGeminiProviderSettings } from '@/providers/gemini/settings';

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
  const settings: Record<string, unknown> = {};
  updateGeminiProviderSettings(settings, { enabled: true });

  return {
    app: {
      vault: {
        adapter: {
          basePath: '/tmp/grimoire-gemini-test-vault',
        },
      },
    },
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/usr/local/bin/gemini'),
    manifest: { version: '0.0.0-test' },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    settings,
    ...overrides,
  };
}

async function collect(generator: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('GeminiChatRuntime', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm('/tmp/grimoire-gemini-test-vault', { force: true, recursive: true });
  });

  it('does not start when the provider is disabled', async () => {
    const settings: Record<string, unknown> = {};
    updateGeminiProviderSettings(settings, { enabled: false });
    const runtime = new GeminiChatRuntime(createMockPlugin({ settings }));

    await expect(runtime.ensureReady()).resolves.toBe(false);
    expect(runtime.isReady()).toBe(false);
  });

  it('launches Gemini in ACP mode', async () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const startProcess = jest.spyOn(runtime as any, 'startProcess').mockImplementation(async () => {
      (runtime as any).ready = true;
      (runtime as any).connection = {};
    });

    await expect(runtime.ensureReady({ allowSessionCreation: false })).resolves.toBe(true);

    expect(startProcess).toHaveBeenCalledWith(expect.objectContaining({
      args: ['--acp'],
      command: '/usr/local/bin/gemini',
    }));
  });

  it('seeds visible model options from ACP discovery when none are configured', () => {
    const plugin = createMockPlugin();
    const runtime = new GeminiChatRuntime(plugin);

    (runtime as any).syncSessionDiscovery({
      models: {
        availableModels: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        ],
        currentModelId: 'gemini-2.5-flash',
      },
    });

    const settings = getGeminiProviderSettings(plugin.settings);
    expect(settings.discoveredModels.map((model) => model.rawId)).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ]);
    expect(settings.visibleModels).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ]);
  });

  it('streams ACP assistant chunks and done', async () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const turn = runtime.prepareTurn({ text: 'Hello' });

    jest.spyOn(runtime, 'ensureReady').mockResolvedValue(true);
    (runtime as any).sessionId = 'session-1';
    (runtime as any).loadedSessionId = 'session-1';
    (runtime as any).connection = {
      prompt: jest.fn(async () => {
        await (runtime as any).handleSessionNotification({
          sessionId: 'session-1',
          update: {
            content: { text: 'Hi from Gemini', type: 'text' },
            messageId: 'assistant-1',
            sessionUpdate: 'agent_message_chunk',
          },
        });
        return {};
      }),
    };

    const chunks = await collect(runtime.query(turn as PreparedChatTurn));

    expect(chunks).toContainEqual({ itemId: 'assistant-1', type: 'assistant_message_start' });
    expect(chunks).toContainEqual({ content: 'Hi from Gemini', type: 'text' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('prepares vault search context in the per-turn prompt', () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const turn = runtime.prepareTurn({
      text: 'Hello',
      vaultSearchContext: {
        query: 'roadmap',
        snippets: [{
          source: { id: 'v1', kind: 'vault-note', path: 'notes/Roadmap.md', title: 'Roadmap' },
          text: 'Launch plan',
          score: 1,
          matchedTerms: ['roadmap'],
        }],
      },
    });

    expect(turn.prompt).toContain('<vault_search query="roadmap">');
    expect(turn.prompt).toContain('Launch plan');
    expect(turn.persistedContent).toContain('<vault_search query="roadmap">');
    expect(turn.persistedContent).toContain('Launch plan');
  });

  it('includes Grimoire note and selection context in the persisted and ACP prompts', async () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const prompt = jest.fn<Promise<object>, [{ prompt: AcpContentBlock[]; sessionId: string }]>(
      async () => ({})
    );

    const turn = runtime.prepareTurn({
      browserSelection: {
        selectedText: 'Browser quote',
        source: 'browser:https://example.com',
        title: 'Example',
        url: 'https://example.com',
      },
      canvasSelection: {
        canvasPath: 'boards/Artic Ocean.canvas',
        nodeIds: ['node-1', 'node-2'],
      },
      currentNotePath: 'notes/Artic Ocean.md',
      editorSelection: {
        mode: 'selection',
        notePath: 'notes/Artic Ocean.md',
        selectedText: 'Selected text',
        startLine: 4,
        lineCount: 2,
      },
      text: 'Summarize this',
    }) as PreparedChatTurn;

    expect(turn.persistedContent).toContain('<current_note>');
    expect(turn.persistedContent).toContain('notes/Artic Ocean.md');
    expect(turn.persistedContent).toContain('<editor_selection path="notes/Artic Ocean.md" lines="4-5">');
    expect(turn.persistedContent).toContain('Selected text');
    expect(turn.persistedContent).toContain('<browser_selection source="browser:https://example.com" title="Example" url="https://example.com">');
    expect(turn.persistedContent).toContain('<canvas_selection path="boards/Artic Ocean.canvas">');

    jest.spyOn(runtime, 'ensureReady').mockResolvedValue(true);
    (runtime as any).sessionId = 'session-1';
    (runtime as any).loadedSessionId = 'session-1';
    (runtime as any).connection = { prompt };

    await collect(runtime.query(turn));

    expect(prompt).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('<current_note>'),
          type: 'text',
        }),
      ]),
    }));
    const firstPromptCall = prompt.mock.calls[0]?.[0];
    expect(firstPromptCall).toBeDefined();
    const firstPromptBlock = firstPromptCall?.prompt[0];
    expect(firstPromptBlock).toMatchObject({ type: 'text' });
    const promptText = firstPromptBlock?.type === 'text' ? firstPromptBlock.text : '';
    expect(promptText).toContain('notes/Artic Ocean.md');
    expect(promptText).toContain('<editor_selection path="notes/Artic Ocean.md" lines="4-5">');
    expect(promptText).toContain('<browser_selection source="browser:https://example.com" title="Example" url="https://example.com">');
    expect(promptText).toContain('<canvas_selection path="boards/Artic Ocean.canvas">');
  });

  it('sends orchestrator instructions in the per-turn ACP prompt when active', async () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const turn = runtime.prepareTurn({ text: 'Plan this work' });
    const prompt = jest.fn(async () => ({}));

    jest.spyOn(runtime, 'ensureReady').mockResolvedValue(true);
    (runtime as any).sessionId = 'session-1';
    (runtime as any).loadedSessionId = 'session-1';
    (runtime as any).connection = { prompt };

    await collect(runtime.query(
      turn as PreparedChatTurn,
      undefined,
      { orchestratorMode: true },
    ));

    expect(prompt).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('## Grimoire Orchestrator Mode'),
          type: 'text',
        }),
      ]),
    }));
  });

  it('cancels the active Gemini session', () => {
    const runtime = new GeminiChatRuntime(createMockPlugin());
    const cancel = jest.fn();

    (runtime as any).sessionId = 'session-1';
    (runtime as any).connection = { cancel };

    runtime.cancel();

    expect(cancel).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('requires approval before ACP file writes while the shared Safe toggle is active', async () => {
    const plugin = createMockPlugin();
    plugin.settings.permissionMode = 'normal';
    const runtime = new GeminiChatRuntime(plugin);
    const approvalCallback = jest.fn().mockResolvedValue('deny');

    runtime.setApprovalCallback(approvalCallback);

    await expect((runtime as any).writeTextFile({
      content: 'new page',
      path: 'Notes/New.md',
      sessionId: 'session-1',
    })).rejects.toThrow('Gemini file write was not approved');

    expect(approvalCallback).toHaveBeenCalledWith(
      'write',
      expect.objectContaining({
        path: '/tmp/grimoire-gemini-test-vault/Notes/New.md',
      }),
      'Gemini wants to write Notes/New.md.',
      expect.objectContaining({
        decisionReason: 'File write permission required',
      }),
    );
    await expect(fs.stat('/tmp/grimoire-gemini-test-vault/Notes/New.md')).rejects.toThrow();
  });

  describe('resolveSessionPath workspace containment', () => {
    function createRuntimeWithPermissionMode(permissionMode: string): any {
      const settings: Record<string, unknown> = { permissionMode };
      updateGeminiProviderSettings(settings, { enabled: true });
      const runtime = new GeminiChatRuntime(createMockPlugin({ settings }));
      (runtime as any).sessionCwds.set('session-1', '/tmp/grimoire-gemini-test-vault');
      return runtime;
    }

    it('rejects an absolute path outside the workspace in safe mode', () => {
      const runtime = createRuntimeWithPermissionMode('normal');
      expect(() => (runtime as any).resolveSessionPath('session-1', '/etc/hosts')).toThrow(
        'File access is limited to the current workspace.',
      );
    });

    it('rejects an escaping relative path in safe mode', () => {
      const runtime = createRuntimeWithPermissionMode('normal');
      expect(() => (runtime as any).resolveSessionPath('session-1', '../../etc/hosts')).toThrow(
        'File access is limited to the current workspace.',
      );
    });

    it('allows a path inside the workspace in safe mode', () => {
      const runtime = createRuntimeWithPermissionMode('normal');
      expect((runtime as any).resolveSessionPath('session-1', 'Notes/today.md')).toBe(
        '/tmp/grimoire-gemini-test-vault/Notes/today.md',
      );
    });

    it('allows a path outside the workspace in active (full_access) mode', () => {
      const runtime = createRuntimeWithPermissionMode('full_access');
      expect((runtime as any).resolveSessionPath('session-1', '/etc/hosts')).toBe('/etc/hosts');
    });
  });
});
