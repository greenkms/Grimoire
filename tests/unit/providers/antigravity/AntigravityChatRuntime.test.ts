import type { PreparedChatTurn } from '@/core/runtime/types';
import type { StreamChunk } from '@/core/types';
import {
  AntigravityChatRuntime,
  buildAntigravityPrintArgs,
} from '@/providers/antigravity/runtime/AntigravityChatRuntime';
import { updateAntigravityProviderSettings } from '@/providers/antigravity/settings';

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
  const settings: Record<string, unknown> = { permissionMode: 'full_access' };
  updateAntigravityProviderSettings(settings, { enabled: true });

  return {
    app: {
      vault: {
        adapter: {
          basePath: '/tmp/grimoire-antigravity-test-vault',
        },
      },
    },
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/usr/local/bin/agy'),
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

describe('AntigravityChatRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not start when the provider is disabled', async () => {
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: false });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));

    await expect(runtime.ensureReady()).resolves.toBe(false);
    expect(runtime.isReady()).toBe(false);
  });

  it('runs agy in print mode and streams stdout as a chat response', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi from Antigravity\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' }) as PreparedChatTurn));

    expect((runtime as any).runPrint).toHaveBeenCalledWith(expect.objectContaining({
      command: '/usr/local/bin/agy',
      prompt: 'Hello',
    }));
    expect(chunks).toContainEqual({ content: 'Hi from Antigravity', type: 'text' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('emits a startup status before waiting for agy print output', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi from Antigravity\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' }) as PreparedChatTurn));

    expect(chunks[0]).toEqual({ content: 'Starting Antigravity...', type: 'status' });
  });

  it('includes Grimoire note and selection context in the persisted and print prompts', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Context received\n');

    const turn = runtime.prepareTurn({
      browserSelection: {
        selectedText: 'Browser quote',
        source: 'browser:https://example.com',
        title: 'Example',
        url: 'https://example.com',
      },
      canvasSelection: {
        canvasPath: 'board.canvas',
        nodeIds: ['node-1', 'node-2'],
      },
      currentNotePath: 'notes/today.md',
      editorSelection: {
        mode: 'selection',
        notePath: 'notes/today.md',
        selectedText: 'Selected text',
        startLine: 4,
        lineCount: 2,
      },
      text: 'Summarize this',
    }) as PreparedChatTurn;

    expect(turn.persistedContent).toContain('<current_note>');
    expect(turn.persistedContent).toContain('notes/today.md');
    expect(turn.persistedContent).toContain('<editor_selection path="notes/today.md" lines="4-5">');
    expect(turn.persistedContent).toContain('Selected text');
    expect(turn.persistedContent).toContain('<browser_selection source="browser:https://example.com" title="Example" url="https://example.com">');
    expect(turn.persistedContent).toContain('<canvas_selection path="board.canvas">');

    await collect(runtime.query(turn));

    expect(runPrint).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('<current_note>'),
    }));
    const prompt = (runPrint.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain('<editor_selection path="notes/today.md" lines="4-5">');
    expect(prompt).toContain('<browser_selection source="browser:https://example.com" title="Example" url="https://example.com">');
    expect(prompt).toContain('<canvas_selection path="board.canvas">');
  });

  it('rebuilds prior current-note context from conversation history metadata', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Follow-up\n');
    const turn = runtime.prepareTurn({ text: 'Continue' }) as PreparedChatTurn;

    await collect(runtime.query(turn, [
      {
        content: 'Earlier request',
        currentNote: 'notes/prior.md',
        id: 'user-1',
        role: 'user',
        timestamp: 1,
      },
    ]));

    const prompt = (runPrint.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain('User:');
    expect(prompt).toContain('<current_note>');
    expect(prompt).toContain('notes/prior.md');
    expect(prompt).toContain('Earlier request');
    expect(prompt).toContain('User: Continue');
  });

  it('blocks safe mode because agy print cannot enforce file edit approvals', async () => {
    const settings: Record<string, unknown> = { permissionMode: 'normal' };
    updateAntigravityProviderSettings(settings, { enabled: true });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('safe\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' }) as PreparedChatTurn));

    expect(runPrint).not.toHaveBeenCalled();
    expect(chunks).toContainEqual({
      type: 'error',
      content: expect.stringContaining('Antigravity safe mode is unavailable'),
    });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('maps permission modes to agy print flags', () => {
    expect(buildAntigravityPrintArgs({
      model: 'Gemini 3.5 Flash (High)',
      permissionMode: 'normal',
      prompt: 'Hello',
    })).toEqual([
      '--sandbox',
      '--model',
      'Gemini 3.5 Flash (High)',
      '--print',
      'Hello',
    ]);

    expect(buildAntigravityPrintArgs({
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
    })).toEqual([
      '--dangerously-skip-permissions',
      '--print',
      'Hello',
    ]);
  });
});
