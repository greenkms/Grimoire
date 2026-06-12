import type { PreparedChatTurn } from '@/core/runtime/types';
import type { StreamChunk } from '@/core/types';
import {
  AntigravityChatRuntime,
  buildAntigravityPrintArgs,
} from '@/providers/antigravity/runtime/AntigravityChatRuntime';
import { updateAntigravityProviderSettings } from '@/providers/antigravity/settings';

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
  const settings: Record<string, unknown> = {};
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

  it('launches safe mode with agy sandboxing by default', async () => {
    const settings: Record<string, unknown> = { permissionMode: 'normal' };
    updateAntigravityProviderSettings(settings, { enabled: true });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('safe\n');

    await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' }) as PreparedChatTurn));

    expect((runtime as any).runPrint).toHaveBeenCalledWith(expect.objectContaining({
      permissionMode: 'normal',
    }));
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
