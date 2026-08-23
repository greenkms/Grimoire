import '@/providers';

import { execSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { parseWindowsShellCommandLine, toAgyArgs } from '@test/helpers/antigravityLaunchShape';

import { ProviderWorkspaceRegistry } from '@/core/providers/ProviderWorkspaceRegistry';
import type { StreamChunk } from '@/core/types';
import { setLocale } from '@/i18n/i18n';
import { AntigravityCommandCatalog } from '@/providers/antigravity/commands/AntigravityCommandCatalog';
import {
  AntigravityChatRuntime,
  buildAntigravityPrintArgs,
  expandAntigravityVaultSkillInvocation,
} from '@/providers/antigravity/runtime/AntigravityChatRuntime';
import { resetAntigravityCliCapabilitiesCache } from '@/providers/antigravity/runtime/AntigravityCliCapabilities';
import {
  buildAntigravityProcessLaunch,
  buildWindowsShellCommandLine,
} from '@/providers/antigravity/runtime/AntigravityProcessLaunch';
import { updateAntigravityProviderSettings } from '@/providers/antigravity/settings';

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  spawn: jest.fn(),
}));

const mockedSpawn = spawn as jest.Mock;

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

function createMockChildProcess(options: { stdin?: boolean } = {}): any {
  const proc = new EventEmitter() as any;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.stdin = options.stdin ? new PassThrough() : null;
  // Mirrors ChildProcess.kill flipping `killed`; the capability probe detects
  // aborted children through it.
  proc.kill = jest.fn(() => {
    proc.killed = true;
  });
  proc.pid = 1234;
  proc.exitCode = null;
  proc.signalCode = null;
  return proc;
}

interface TrackedStdin {
  chunks: string[];
  ended: boolean;
}

function trackStdin(proc: any): TrackedStdin {
  const state: TrackedStdin = { chunks: [], ended: false };
  proc.stdin.on('data', (chunk: Buffer) => state.chunks.push(chunk.toString('utf8')));
  const originalEnd = proc.stdin.end.bind(proc.stdin);
  proc.stdin.end = () => {
    state.ended = true;
    return originalEnd();
  };
  return state;
}

const STREAM_JSON_CAPABILITIES = { addDir: true, printTimeout: true, streamJson: true };

// Real children emit `exit` and then `close` once stdio has drained; the
// runtime settles on `close` because the result frame is the last stdout write.
function emitProcessExit(proc: any, code: number | null, signal: string | null): void {
  proc.emit('exit', code, signal);
  proc.emit('close', code, signal);
}

// Fake timers also fake setImmediate, so async setup inside fake-timer tests
// must be flushed through microtasks instead.
async function flushAsyncQueue(times = 10): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function writeStreamJsonFrame(proc: any, event: Record<string, unknown>): void {
  proc.stdout.write(`${JSON.stringify(event)}\n`);
}

function writeStreamJsonResult(
  proc: any,
  result: { error?: string; response: string; status: string },
): void {
  writeStreamJsonFrame(proc, { event: 'result', result });
}

function isHelpProbeArgs(spawnArgs: string[]): boolean {
  return toAgyArgs(spawnArgs).includes('--help');
}

function getSpawnedAgyArgs(): string[] {
  const printCall = mockedSpawn.mock.calls
    .map(([, args]: [string, string[]]) => {
      const flagArgs = toAgyArgs(args);
      const isPrint = flagArgs.includes('--print') || flagArgs.includes('--input-format');
      return { args: flagArgs, isPrint };
    })
    .find((entry: { isPrint: boolean }) => entry.isPrint);
  return printCall ? printCall.args : [];
}

function getPrintLogFilePath(): string {
  const [, args] = mockedSpawn.mock.calls[mockedSpawn.mock.calls.length - 1] as [string, string[]];
  const agyArgs = toAgyArgs(args);
  return agyArgs[agyArgs.indexOf('--log-file') + 1];
}

/**
 * `runPrint` resolves the turn from inside its `try` and unlinks the agy log in
 * the `finally` that follows, so cleanup is still in flight when the awaited
 * promise settles. The number of hops between the two is not fixed - the
 * `fs.promises` call lands on the threadpool - so a single `setImmediate` is an
 * arbitrary barrier that passes or fails with the scheduling of whatever else
 * shares the worker. Wait for the condition instead of for a tick count.
 */
async function waitForRemovedFile(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const exists = await fs.access(filePath).then(() => true, () => false);
    if (!exists) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for ${filePath} to be removed`);
}

// FIFOs exist on POSIX only; the drain-race test parks transcript recovery
// on a named pipe so it deterministically overlaps the next turn.
async function writeToFifo(fifoPath: string, content: string): Promise<void> {
  const handle = await fs.open(fifoPath, 'w');
  try {
    await handle.write(content);
  } finally {
    await handle.close();
  }
}

describe('AntigravityChatRuntime', () => {
  afterEach(() => {
    setLocale('en');
    jest.restoreAllMocks();
    mockedSpawn.mockReset();
    resetAntigravityCliCapabilitiesCache();
    ProviderWorkspaceRegistry.setServices('antigravity', undefined);
  });

  it('does not start when the provider is disabled', async () => {
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: false });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));

    await expect(runtime.ensureReady()).resolves.toBe(false);
    expect(runtime.isReady()).toBe(false);
  });

  it('localizes the disabled-provider query error', async () => {
    setLocale('ru');
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: false });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect(chunks).toContainEqual({
      type: 'error',
      content: 'Antigravity отключён. Включите его в настройках провайдера.',
    });
  });

  it('runs agy in print mode and streams stdout as a chat response', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi from Antigravity\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect((runtime as any).runPrint).toHaveBeenCalledWith(expect.objectContaining({
      command: '/usr/local/bin/agy',
      prompt: 'Hello',
    }));
    expect(chunks).toContainEqual({ content: 'Hi from Antigravity', type: 'text' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  function registerSkillCatalog(files: Record<string, string>): void {
    const catalog = new AntigravityCommandCatalog({
      listFiles: jest.fn(async () => []),
      listFolders: jest.fn(async (root: string) => [
        ...new Set(Object.keys(files)
          .filter((file) => file.startsWith(`${root}/`))
          .map((file) => file.slice(0, file.lastIndexOf('/')))),
      ]),
      read: jest.fn(async (path: string) => {
        const content = files[path];
        if (content === undefined) throw new Error(`Missing ${path}`);
        return content;
      }),
    } as any);
    ProviderWorkspaceRegistry.setServices('antigravity', { commandCatalog: catalog });
  }

  it('expands a shared content-only skill and passes its arguments to AGY', async () => {
    registerSkillCatalog({
      '.agents/skills/start-my-day/SKILL.md': 'Prepare a focused daily plan.',
    });

    await expect(expandAntigravityVaultSkillInvocation('/start-my-day prioritize health'))
      .resolves.toContain('Prepare a focused daily plan.');
    await expect(expandAntigravityVaultSkillInvocation('/start-my-day prioritize health'))
      .resolves.toContain('User input for this skill:\nprioritize health');
  });

  it('expands a skill selected by its frontmatter name without the frontmatter block', async () => {
    registerSkillCatalog({
      '.claude/skills/daily-routine/SKILL.md': '---\nname: start-my-day\n---\n\nStart calmly.',
    });

    const expanded = await expandAntigravityVaultSkillInvocation('/start-my-day');
    expect(expanded).toContain('Start calmly.');
    expect(expanded).not.toContain('name: start-my-day');
    await expect(expandAntigravityVaultSkillInvocation('/Start-My-Day'))
      .resolves.toContain('Start calmly.');
  });

  it('resolves duplicate names with the same root priority as the slash menu', async () => {
    registerSkillCatalog({
      '.claude/skills/shared/SKILL.md': 'Claude copy wins.',
      '.agents/skills/shared/SKILL.md': 'Agents copy must not be used.',
    });

    await expect(expandAntigravityVaultSkillInvocation('/shared'))
      .resolves.toContain('Claude copy wins.');
    await expect(expandAntigravityVaultSkillInvocation('/shared'))
      .resolves.not.toContain('Agents copy must not be used.');
  });

  it('passes an unknown skill invocation through unchanged', async () => {
    registerSkillCatalog({
      '.agents/skills/start-my-day/SKILL.md': 'Prepare a focused daily plan.',
    });

    await expect(expandAntigravityVaultSkillInvocation('/other-skill do things'))
      .resolves.toBe('/other-skill do things');
  });

  it('keeps appended XML context outside the skill instructions', async () => {
    registerSkillCatalog({
      '.agents/skills/start-my-day/SKILL.md': 'Prepare a focused daily plan.',
    });
    const prompt = '/start-my-day prioritize health\n\n<current_note>\ndaily.md\n</current_note>';

    await expect(expandAntigravityVaultSkillInvocation(prompt)).resolves.toBe([
      'You are executing the vault skill "start-my-day". Follow its instructions.',
      '',
      'Prepare a focused daily plan.',
      '',
      'User input for this skill:',
      'prioritize health',
      '',
      '<current_note>',
      'daily.md',
      '</current_note>',
    ].join('\n'));
  });

  it('keeps appended XML context after a skill invoked without arguments', async () => {
    registerSkillCatalog({
      '.agents/skills/start-my-day/SKILL.md': 'Prepare a focused daily plan.',
    });
    const prompt = '/start-my-day\n\n<current_note>\ndaily.md\n</current_note>';

    await expect(expandAntigravityVaultSkillInvocation(prompt)).resolves.toBe([
      'You are executing the vault skill "start-my-day". Follow its instructions.',
      '',
      'Prepare a focused daily plan.',
      '',
      '<current_note>',
      'daily.md',
      '</current_note>',
    ].join('\n'));
  });

  it('keeps a multibyte character that agy split across two stdout chunks intact', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: '你好',
      runtimeEnv: process.env,
    });

    const answer = Buffer.from('修改文件', 'utf8');
    proc.stdout.write(answer.subarray(0, 4));
    proc.stdout.write(answer.subarray(4));
    emitProcessExit(proc, 0, null);

    await expect(result).resolves.toBe('修改文件');
  });

  it('uses the explicit query model instead of the saved provider default', async () => {
    const plugin = createMockPlugin();
    plugin.settings.savedProviderModel = { antigravity: 'antigravity:gemini-2.5-pro' };
    const runtime = new AntigravityChatRuntime(plugin);
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi\n');

    await collect(runtime.query(
      runtime.prepareTurn({ text: 'Hello' }),
      undefined,
      { model: 'antigravity:gemini-2.5-flash' },
    ));

    expect(runPrint).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash',
    }));
  });

  it('repairs a tab-separated model selection saved by older discovery code', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi\n');

    await collect(runtime.query(
      runtime.prepareTurn({ text: 'Hello' }),
      undefined,
      { model: 'antigravity:gemini-3.6-flash-high\tGemini 3.6 Flash (High)' },
    ));

    expect(runPrint).toHaveBeenCalledWith(expect.objectContaining({
      model: 'Gemini 3.6 Flash (High)',
    }));
  });

  it('emits a startup status before waiting for agy print output', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Hi from Antigravity\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect(chunks[0]).toEqual({ content: 'Starting Antigravity...', type: 'status' });
  });

  it('reports an empty agy print response instead of finishing silently', async () => {
    setLocale('ru');
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect(chunks).toContainEqual({
      type: 'error',
      content: expect.stringContaining('Antigravity завершил работу без ответа'),
    });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
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
      contextFiles: ['notes/instructions.md'],
      currentNotePath: 'notes/today.md',
      excludedFolders: ['Climate'],
      editorSelection: {
        mode: 'selection',
        notePath: 'notes/today.md',
        selectedText: 'Selected text',
        startLine: 4,
        lineCount: 2,
      },
      text: 'Summarize this',
    });

    expect(turn.persistedContent).toContain('<current_note>');
    expect(turn.persistedContent).toContain('notes/today.md');
    expect(turn.persistedContent).toContain('<context_files>');
    expect(turn.persistedContent).toContain('notes/instructions.md');
    expect(turn.persistedContent).toContain('<excluded_folders>');
    expect(turn.persistedContent).toContain('<folder>Climate</folder>');
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
    expect(prompt).toContain('notes/instructions.md');
    expect(prompt).toContain('<folder>Climate</folder>');
    expect(prompt).toContain('<browser_selection source="browser:https://example.com" title="Example" url="https://example.com">');
    expect(prompt).toContain('<canvas_selection path="board.canvas">');
  });

  it('rebuilds prior current-note context from conversation history metadata', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('Follow-up\n');
    const turn = runtime.prepareTurn({ text: 'Continue' });

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
    setLocale('ru');
    const settings: Record<string, unknown> = { permissionMode: 'normal' };
    updateAntigravityProviderSettings(settings, { enabled: true });
    const runtime = new AntigravityChatRuntime(createMockPlugin({ settings }));
    const runPrint = jest.spyOn(runtime as any, 'runPrint').mockResolvedValue('safe\n');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect(runPrint).not.toHaveBeenCalled();
    expect(chunks).toContainEqual({
      type: 'error',
      content: expect.stringContaining('Безопасный режим Antigravity недоступен'),
    });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('localizes non-Error request failures', async () => {
    setLocale('ru');
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    jest.spyOn(runtime as any, 'runPrint').mockRejectedValue('transport failed');

    const chunks = await collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));

    expect(chunks).toContainEqual({
      type: 'error',
      content: 'Сбой запроса к Antigravity',
    });
  });

  it('recovers agy print output from the Antigravity transcript when Windows stdout is empty', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-antigravity-test-'));
    const conversationId = '28b04652-35c4-46ca-8231-3e9f904bb0dd';
    const appDataDir = path.join(tempRoot, 'antigravity-cli');
    const transcriptDir = path.join(
      appDataDir,
      'brain',
      conversationId,
      '.system_generated',
      'logs',
    );

    try {
      const result = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Hello from transcript',
        runtimeEnv: process.env,
      });
      const spawnArgs = toAgyArgs(mockedSpawn.mock.calls[0][1] as string[]);
      const logFileArgIndex = spawnArgs.indexOf('--log-file');
      expect(logFileArgIndex).toBeGreaterThanOrEqual(0);
      const logFilePath = spawnArgs[logFileArgIndex + 1];
      expect(logFilePath).toBeTruthy();
      await fs.mkdir(transcriptDir, { recursive: true });
      await fs.writeFile(logFilePath, [
        `I0620 common.go:156] CLI app data directory: ${appDataDir}`,
        `I0620 printmode.go:156] Print mode: conversation=${conversationId}, sending message`,
      ].join('\n'));
      await fs.writeFile(path.join(transcriptDir, 'transcript.jsonl'), [
        JSON.stringify({
          content: '<USER_REQUEST>\nHello from transcript\n</USER_REQUEST>',
          source: 'USER_EXPLICIT',
          status: 'DONE',
          type: 'USER_INPUT',
        }),
        JSON.stringify({
          content: 'Recovered from transcript.\n',
          source: 'MODEL',
          status: 'DONE',
          type: 'PLANNER_RESPONSE',
        }),
      ].join('\n'));
      emitProcessExit(proc, 0, null);

      await expect(result).resolves.toBe('Recovered from transcript.\n');
      expect(getSpawnedAgyArgs()).toEqual(expect.arrayContaining([
        '--dangerously-skip-permissions',
        '--log-file',
        logFilePath,
        '--print',
        'Hello from transcript',
      ]));
      expect(mockedSpawn.mock.calls[0][2]).toEqual(expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
    } finally {
      await fs.rm(tempRoot, { force: true, recursive: true });
    }
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

  it('prepends --add-dir for the vault when the CLI probed as supporting it', () => {
    expect(buildAntigravityPrintArgs({
      addDirPath: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
    })).toEqual([
      '--add-dir',
      '/tmp/grimoire-antigravity-test-vault',
      '--dangerously-skip-permissions',
      '--print',
      'Hello',
    ]);

    expect(buildAntigravityPrintArgs({
      addDirPath: null,
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
    })).not.toContain('--add-dir');
  });

  it('passes the vault to agy via --add-dir after probing agy --help', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'List vault files' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --add-dir <dir>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Vault listed\n');
    emitProcessExit(printProc, 0, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({ content: 'Vault listed', type: 'text' });
    const agyArgs = getSpawnedAgyArgs();
    expect(agyArgs.indexOf('--add-dir')).toBe(0);
    expect(agyArgs).toEqual(expect.arrayContaining([
      '--add-dir',
      '/tmp/grimoire-antigravity-test-vault',
      '--dangerously-skip-permissions',
      '--print',
      'List vault files',
    ]));
  });

  it('omits --add-dir when the probed agy --help does not advertise it', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --print\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Hi\n');
    emitProcessExit(printProc, 0, null);

    await chunksPromise;
    expect(getSpawnedAgyArgs()).not.toContain('--add-dir');
    expect(getSpawnedAgyArgs()).toContain('--print');
  });

  it('sends the prompt over stdin and parses the stream-json result frame', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    const stdin = trackStdin(printProc);
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write([
      'Usage: agy [flags]',
      '  --add-dir <dir>',
      '  --input-format <format>',
      '  --output-format <format>',
      '  --print-timeout <dur>',
    ].join('\n'));
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    const spawnOptions = mockedSpawn.mock.calls
      .filter(([, args]: [string, string[]]) => !isHelpProbeArgs(args))
      .map(([, , options]: [string, string[], Record<string, unknown>]) => options)[0];
    expect(spawnOptions).toEqual(expect.objectContaining({
      stdio: ['pipe', 'pipe', 'pipe'],
    }));
    const agyArgs = getSpawnedAgyArgs();
    expect(agyArgs).toEqual(expect.arrayContaining([
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--print-timeout',
      '29m',
    ]));
    expect(agyArgs).not.toContain('--print');

    expect(stdin.chunks).toHaveLength(1);
    expect(JSON.parse(stdin.chunks[0])).toEqual({
      event: 'user',
      message: { role: 'user', content: 'Hello' },
    });
    expect(stdin.ended).toBe(true);

    writeStreamJsonFrame(printProc, { event: 'init', cwd: '/tmp/grimoire-antigravity-test-vault' });
    writeStreamJsonFrame(printProc, {
      event: 'step_update',
      step_update: { step_type: 'agent_response', state: 'DONE' },
    });
    writeStreamJsonResult(printProc, { response: 'Streamed answer\n', status: 'SUCCESS' });
    emitProcessExit(printProc, 0, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({ content: 'Streamed answer', type: 'text' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('rejects with the structured result error when agy reports status ERROR', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --input-format <f>\n  --output-format <f>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    writeStreamJsonResult(printProc, {
      error: 'timeout waiting for response',
      response: '',
      status: 'ERROR',
    });
    emitProcessExit(printProc, 1, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({
      type: 'error',
      content: 'Antigravity CLI reported an error: timeout waiting for response',
    });
  });

  it('survives EPIPE on stdin when the child exits before draining it', async () => {
    const recordDebugLog = jest.fn();
    const runtime = new AntigravityChatRuntime(createMockPlugin({ recordDebugLog }));
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: '' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --input-format <f>\n  --output-format <f>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    printProc.stdin.emit('error', new Error('write EPIPE'));
    printProc.stderr.write('prompt must not be empty\n');
    emitProcessExit(printProc, 1, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({
      type: 'error',
      content: expect.stringContaining('Antigravity CLI exited (code 1)'),
    });
    expect(recordDebugLog.mock.calls
      .map(([entry]) => entry)
      .some((entry: any) => entry.event === 'print.stdinError')).toBe(true);
  });

  it('keeps a multibyte character split across stream-json chunks parseable', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      cliCapabilities: STREAM_JSON_CAPABILITIES,
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: '你好',
      runtimeEnv: process.env,
    });

    const frame = `${JSON.stringify({
      event: 'result',
      result: { response: '修改文件完成', status: 'SUCCESS' },
    })}\n`;
    const bytes = Buffer.from(frame, 'utf8');
    proc.stdout.write(bytes.subarray(0, 20));
    proc.stdout.write(bytes.subarray(20));
    emitProcessExit(proc, 0, null);

    await expect(result).resolves.toBe('修改文件完成');
  });

  it('recovers a stream-json run from the transcript when no result frame arrives', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-antigravity-test-'));
    const conversationId = '28b04652-35c4-46ca-8231-3e9f904bb0dd';
    const appDataDir = path.join(tempRoot, 'antigravity-cli');
    const transcriptDir = path.join(appDataDir, 'brain', conversationId, '.system_generated', 'logs');

    try {
      const result = (runtime as any).runPrint({
        cliCapabilities: STREAM_JSON_CAPABILITIES,
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Hello from transcript',
        runtimeEnv: process.env,
      });
      const spawnArgs = toAgyArgs(mockedSpawn.mock.calls[0][1] as string[]);
      const logFilePath = spawnArgs[spawnArgs.indexOf('--log-file') + 1];
      await fs.mkdir(transcriptDir, { recursive: true });
      await fs.writeFile(logFilePath, [
        `I0620 common.go:156] CLI app data directory: ${appDataDir}`,
        `I0620 printmode.go:156] Print mode: conversation=${conversationId}, sending message`,
      ].join('\n'));
      await fs.writeFile(path.join(transcriptDir, 'transcript.jsonl'), [
        JSON.stringify({
          content: 'Recovered from transcript.\n',
          source: 'MODEL',
          status: 'DONE',
          type: 'PLANNER_RESPONSE',
        }),
      ].join('\n'));
      writeStreamJsonFrame(proc, { event: 'init', cwd: '/tmp/grimoire-antigravity-test-vault' });
      emitProcessExit(proc, 0, null);

      await expect(result).resolves.toBe('Recovered from transcript.\n');
    } finally {
      await fs.rm(tempRoot, { force: true, recursive: true });
    }
  });

  it('maps stream-json capability onto transport flags', () => {
    expect(buildAntigravityPrintArgs({
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
      streamJson: true,
    })).toEqual([
      '--dangerously-skip-permissions',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
    ]);
  });

  it('combines every advertised flag without the prompt in argv', () => {
    expect(buildAntigravityPrintArgs({
      addDirPath: '/vault',
      logFilePath: '/tmp/grimoire-antigravity.log',
      model: 'Gemini 3.5 Flash (High)',
      permissionMode: 'full_access',
      printTimeout: true,
      prompt: 'Hello',
      streamJson: true,
    })).toEqual([
      '--add-dir',
      '/vault',
      '--dangerously-skip-permissions',
      '--log-file',
      '/tmp/grimoire-antigravity.log',
      '--model',
      'Gemini 3.5 Flash (High)',
      '--print-timeout',
      '29m',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
    ]);
  });

  it('settles only after stdio drains, so a result frame landing after exit still parses', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      cliCapabilities: STREAM_JSON_CAPABILITIES,
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
      runtimeEnv: process.env,
    });

    // Node can emit `exit` before the final buffered frame drains from the
    // pipe; the real order for a fast writer is exit -> data -> close.
    proc.emit('exit', 0, null);
    writeStreamJsonResult(proc, { response: 'late frame\n', status: 'SUCCESS' });
    proc.emit('close', 0, null);

    await expect(result).resolves.toBe('late frame\n');
  });

  it('rejects a structured ERROR result even when agy exits zero', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      cliCapabilities: STREAM_JSON_CAPABILITIES,
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
      runtimeEnv: process.env,
    });
    writeStreamJsonResult(proc, {
      error: 'timeout waiting for response',
      response: '',
      status: 'ERROR',
    });
    emitProcessExit(proc, 0, null);

    await expect(result).rejects.toThrow('Antigravity CLI reported an error: timeout waiting for response');
  });

  it('resolves a complete answer from the result frame even when agy exits non-zero', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      cliCapabilities: STREAM_JSON_CAPABILITIES,
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: 'Hello',
      runtimeEnv: process.env,
    });
    writeStreamJsonResult(proc, { response: 'Complete answer', status: 'SUCCESS' });
    proc.stderr.write('store manager failed\n');
    emitProcessExit(proc, 1, null);

    await expect(result).resolves.toBe('Complete answer');
  });

  it('keeps a fully streamed answer when agy flags ERROR only after answering', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);

    const result = (runtime as any).runPrint({
      cliCapabilities: STREAM_JSON_CAPABILITIES,
      command: 'agy',
      cwd: '/tmp/grimoire-antigravity-test-vault',
      model: null,
      permissionMode: 'full_access',
      prompt: 'Write into a subdirectory',
      runtimeEnv: process.env,
    });
    writeStreamJsonResult(proc, {
      error: 'declaring permissions: cortex tool write_to_file: not a valid artifact path',
      response: 'The files were created and the batch finished.',
      status: 'ERROR',
    });
    emitProcessExit(proc, 1, null);

    const answer = await result;
    expect(answer).toContain('The files were created and the batch finished.');
    expect(answer).toContain('> Warning: Antigravity CLI reported an error after this answer:');
    expect(answer).toContain('not a valid artifact path');
  });

  it('resolves an ERROR-flagged answer when the CLI hangs after it', async () => {
    jest.useFakeTimers();
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);
    try {
      const result = (runtime as any).runPrint({
        cliCapabilities: STREAM_JSON_CAPABILITIES,
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Hang after answer',
        runtimeEnv: process.env,
      });
      writeStreamJsonResult(proc, {
        error: 'view_file: no such file',
        response: 'Everything else completed.',
        status: 'ERROR',
      });

      jest.advanceTimersByTime(10 * 60 * 1000);
      await expect(result).resolves.toContain('Everything else completed.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('treats stderr progress as activity for the inactivity timer', async () => {
    jest.useFakeTimers();
    try {
      const runtime = new AntigravityChatRuntime(createMockPlugin());
      const proc = createMockChildProcess();
      mockedSpawn.mockReturnValue(proc);

      const result = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Noisy stderr',
        runtimeEnv: process.env,
      });

      jest.advanceTimersByTime(9 * 60 * 1000);
      proc.stderr.write('log progress\n');
      jest.advanceTimersByTime(9 * 60 * 1000);
      expect(proc.kill).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

      await expect(result).rejects.toThrow('timed out after 10 minutes without CLI output or log activity');
    } finally {
      jest.useRealTimers();
    }
  });

  it('settles a running print child through cancel without leaving timers armed', async () => {
    jest.useFakeTimers();
    try {
      const runtime = new AntigravityChatRuntime(createMockPlugin());
      const probeProc = createMockChildProcess();
      const printProc = createMockChildProcess({ stdin: true });
      mockedSpawn.mockImplementation((command: string, args: string[]) => {
        if (isHelpProbeArgs(args)) return probeProc;
        return printProc;
      });

      const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
      await flushAsyncQueue();
      probeProc.stdout.write('Usage: agy\n  --input-format <f>\n  --output-format <f>\n');
      probeProc.emit('close', 0, null);
      await flushAsyncQueue();

      runtime.cancel();
      expect(printProc.kill).toHaveBeenCalledWith('SIGTERM');
      emitProcessExit(printProc, null, 'SIGTERM');

      const chunks = await chunksPromise;
      expect(chunks).toContainEqual(expect.objectContaining({ type: 'error' }));
      expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });

      jest.advanceTimersByTime(31 * 60 * 1000);
      expect(printProc.kill).not.toHaveBeenCalledWith('SIGKILL');
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-probes CLI capabilities after a cancelled probe instead of pinning legacy flags', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const firstProbeProc = createMockChildProcess();
    const secondProbeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    const helpProbes = [firstProbeProc, secondProbeProc];
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return helpProbes.shift();
      return printProc;
    });

    const firstTurn = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    runtime.cancel();
    firstProbeProc.emit('close', null, 'SIGTERM');
    await firstTurn;

    const secondTurn = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    secondProbeProc.stdout.write('Usage: agy\n  --input-format <f>\n  --output-format <f>\n');
    secondProbeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    writeStreamJsonResult(printProc, { response: 'Recovered\n', status: 'SUCCESS' });
    emitProcessExit(printProc, 0, null);

    const chunks = await secondTurn;
    expect(chunks).toContainEqual({ content: 'Recovered', type: 'text' });
    // Two help probes (the first was cancelled and not cached) plus one print run.
    expect(mockedSpawn).toHaveBeenCalledTimes(3);
    expect(getSpawnedAgyArgs()).toContain('--input-format');
  });

  it('keeps the newest run cancellable while an older turn is still draining', async () => {
    if (process.platform === 'win32') {
      // The test parks transcript recovery on a FIFO, which Windows lacks.
      return;
    }
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const firstProc = createMockChildProcess();
    const secondProc = createMockChildProcess();
    const printProcs = [firstProc, secondProc];
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProcs.shift();
    });

    // First turn: empty stdout on exit 0, so its close handler parks in
    // transcript recovery reading a FIFO-backed log file.
    const firstTurn = collect(runtime.query(runtime.prepareTurn({ text: 'First' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    const firstLogPath = getPrintLogFilePath();
    execSync(`mkfifo ${JSON.stringify(firstLogPath)}`);
    emitProcessExit(firstProc, 0, null);

    // Second turn claims the process handles while the first still drains.
    const secondTurn = collect(runtime.query(runtime.prepareTurn({ text: 'Second' })));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect((runtime as any).activeProcess).toBe(secondProc);

    // Release the first turn's recovery.
    await writeToFifo(firstLogPath, 'no conversation id here');
    const firstChunks = await firstTurn;
    expect(firstChunks[firstChunks.length - 1]).toEqual({ type: 'done' });

    // The second run must still own its handles and stay cancellable.
    runtime.cancel();
    expect(secondProc.kill).toHaveBeenCalledWith('SIGTERM');
    emitProcessExit(secondProc, null, 'SIGTERM');
    const secondChunks = await secondTurn;
    expect(secondChunks).toContainEqual(expect.objectContaining({ type: 'error' }));

    await fs.rm(firstLogPath, { force: true });
  });

  it('passes an explicit print timeout just below the absolute ceiling', () => {
    expect(buildAntigravityPrintArgs({
      model: null,
      permissionMode: 'full_access',
      printTimeout: true,
      prompt: 'Hello',
    })).toEqual([
      '--dangerously-skip-permissions',
      '--print-timeout',
      '29m',
      '--print',
      'Hello',
    ]);
  });

  it('forwards --print-timeout to agy when the CLI advertises it', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --add-dir <dir>\n  --print-timeout <dur>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Hi\n');
    emitProcessExit(printProc, 0, null);

    await chunksPromise;
    const agyArgs = getSpawnedAgyArgs();
    expect(agyArgs).toEqual(expect.arrayContaining(['--print-timeout', '29m', '--print', 'Hello']));
    expect(agyArgs).not.toContain('--input-format');
  });

  it('forces the streams closed when close lags exit, so the run still settles', async () => {
    jest.useFakeTimers();
    try {
      const runtime = new AntigravityChatRuntime(createMockPlugin());
      const proc = createMockChildProcess();
      const destroyStdout = jest.spyOn(proc.stdout, 'destroy');
      mockedSpawn.mockReturnValue(proc);

      const result = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Orphaned wrapper',
        runtimeEnv: process.env,
      });
      proc.stdout.write('Hi\n');
      proc.emit('exit', 0, null);
      jest.advanceTimersByTime(2_000);
      expect(destroyStdout).toHaveBeenCalledTimes(1);

      // Real children emit `close` once the destroyed streams actually close.
      proc.emit('close', 0, null);
      await expect(result).resolves.toBe('Hi\n');
    } finally {
      jest.useRealTimers();
    }
  });

  it('resolves with an already-delivered answer when the CLI hangs after it', async () => {
    jest.useFakeTimers();
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);
    let logFilePath = '';
    try {
      const result = (runtime as any).runPrint({
        cliCapabilities: STREAM_JSON_CAPABILITIES,
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Hang after answer',
        runtimeEnv: process.env,
      });
      logFilePath = getPrintLogFilePath();
      await fs.writeFile(logFilePath, 'simulated agy log\n');
      writeStreamJsonResult(proc, { response: 'Salvaged answer', status: 'SUCCESS' });

      jest.advanceTimersByTime(10 * 60 * 1000);
      await expect(result).resolves.toBe('Salvaged answer');

      // The turn produced an answer, so its log file is removed.
      jest.useRealTimers();
      await waitForRemovedFile(logFilePath);
      logFilePath = '';
    } finally {
      jest.useRealTimers();
      await fs.rm(logFilePath, { force: true });
    }
  });

  it('keeps an active run alive and cuts a silent one at the inactivity timeout', async () => {
    jest.useFakeTimers();
    try {
      const runtime = new AntigravityChatRuntime(createMockPlugin());
      const proc = createMockChildProcess();
      mockedSpawn.mockReturnValue(proc);

      const result = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Long work',
        runtimeEnv: process.env,
      });

      // Each frame refreshes the ten-minute inactivity timer, so a healthy
      // multi-step run survives far past the old absolute limit.
      for (let minute = 0; minute < 2; minute += 1) {
        jest.advanceTimersByTime(4 * 60 * 1000);
        proc.stdout.write('working\n');
      }
      expect(proc.kill).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      jest.advanceTimersByTime(2_000);
      expect(proc.kill).toHaveBeenCalledWith('SIGKILL');

      await expect(result).rejects.toThrow('timed out after 10 minutes without CLI output or log activity');
    } finally {
      jest.useRealTimers();
    }
  });

  it('treats --log-file growth as liveness during a silent tool call', async () => {
    jest.useFakeTimers();
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const proc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockReturnValue(proc);
    // Real fs.stat cannot settle inside fake timers (its completion needs an
    // event-loop I/O turn that advanced timers never yield), so the log size
    // is served from a synchronous mock and flushed on microtasks.
    let logSize = 0;
    const statMock = jest.spyOn(fs, 'stat').mockImplementation(async () => ({ size: logSize }) as never);
    const flushMicrotasks = async (): Promise<void> => {
      for (let tick = 0; tick < 5; tick += 1) {
        await Promise.resolve();
      }
    };
    try {
      const result = (runtime as any).runPrint({
        cliCapabilities: STREAM_JSON_CAPABILITIES,
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Silent long tool call',
        runtimeEnv: process.env,
      });

      // The pipes stay silent, but agy keeps appending to its log file; every
      // poll that observes growth refreshes the ten-minute inactivity timer.
      for (let cycle = 0; cycle < 2; cycle += 1) {
        logSize += 1_024;
        jest.advanceTimersByTime(15_000);
        await flushMicrotasks();
        jest.advanceTimersByTime(9 * 60 * 1000);
        expect(proc.kill).not.toHaveBeenCalled();
      }

      // Once the log stops growing too, the silent run is finally cut.
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

      await expect(result).rejects.toThrow('timed out after 10 minutes without CLI output or log activity');
    } finally {
      statMock.mockRestore();
      jest.useRealTimers();
    }
  });

  it('ends even a chatty run at the absolute ceiling', async () => {
    jest.useFakeTimers();
    try {
      const runtime = new AntigravityChatRuntime(createMockPlugin());
      const proc = createMockChildProcess();
      mockedSpawn.mockReturnValue(proc);

      const result = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Endless work',
        runtimeEnv: process.env,
      });

      for (let minute = 0; minute < 30; minute += 1) {
        jest.advanceTimersByTime(60 * 1000);
        proc.stdout.write('still working\n');
      }
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

      await expect(result).rejects.toThrow('exceeded the 30-minute limit');
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves the agy log file when the run fails and removes it on success', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const failingProc = createMockChildProcess();
    mockedSpawn.mockReturnValue(failingProc);

    let failingLogPath = '';
    let succeedingLogPath = '';
    try {
      const failingResult = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Fail',
        runtimeEnv: process.env,
      });
      failingLogPath = getPrintLogFilePath();
      await fs.writeFile(failingLogPath, 'simulated agy failure log\n');
      failingProc.stderr.write('boom\n');
      emitProcessExit(failingProc, 1, null);
      await expect(failingResult).rejects.toThrow('exited (code 1)');
      await new Promise((resolve) => setImmediate(resolve));
      await expect(fs.access(failingLogPath)).resolves.toBeUndefined();

      const succeedingProc = createMockChildProcess();
      mockedSpawn.mockReturnValue(succeedingProc);
      const succeedingResult = (runtime as any).runPrint({
        command: 'agy',
        cwd: '/tmp/grimoire-antigravity-test-vault',
        model: null,
        permissionMode: 'full_access',
        prompt: 'Succeed',
        runtimeEnv: process.env,
      });
      succeedingLogPath = getPrintLogFilePath();
      await fs.writeFile(succeedingLogPath, 'simulated agy success log\n');
      succeedingProc.stdout.write('Hi\n');
      emitProcessExit(succeedingProc, 0, null);
      await expect(succeedingResult).resolves.toBe('Hi\n');
      await waitForRemovedFile(succeedingLogPath);
    } finally {
      await fs.rm(failingLogPath, { force: true });
      await fs.rm(succeedingLogPath, { force: true });
    }
  });

  it('drops the print run when cancelled while the add-dir probe is in flight', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    runtime.cancel();
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    const chunks = await chunksPromise;
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    expect(chunks).not.toContainEqual(expect.objectContaining({ type: 'text' }));
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('masks the vault path in the print.spawn args summary', async () => {
    const recordDebugLog = jest.fn();
    const runtime = new AntigravityChatRuntime(createMockPlugin({ recordDebugLog }));
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (isHelpProbeArgs(args)) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --add-dir <dir>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Hi\n');
    emitProcessExit(printProc, 0, null);
    await chunksPromise;

    const spawnLog = recordDebugLog.mock.calls
      .map(([entry]) => entry)
      .find((entry: any) => entry.event === 'print.spawn');
    expect(spawnLog?.data?.argsSummary).toContain('--add-dir <vault-path>');
    expect(spawnLog?.data?.argsSummary).not.toContain('/tmp/grimoire-antigravity-test-vault');
    expect(spawnLog?.data?.argsSummary).toContain('--log-file <log-path>');
    expect(spawnLog?.data?.argsSummary).not.toMatch(/grimoire-antigravity-print-/);
  });
});

describe('launch-shape normalization helpers', () => {
  // Every argument shape buildAntigravityProcessLaunch can hand to cmd.exe,
  // including the quoting edge cases quoteWindowsArgument exists for. Without
  // this, a fixture that grew a path ending in a backslash would read back a
  // different value on Windows only, and fail for a reason unrelated to it.
  const LAUNCH_CASES: Array<{ args: string[]; command: string; name: string }> = [
    {
      args: ['--print', '--output-format', 'stream-json'],
      command: 'agy',
      name: 'plain flags',
    },
    {
      args: ['--help'],
      command: 'agy',
      name: 'the capability probe',
    },
    {
      args: ['--log-file', 'C:\\Users\\test\\AppData\\Local\\Temp\\grimoire-print\\agy.jsonl'],
      command: 'C:\\Users\\test\\AppData\\agy.cmd',
      name: 'a Windows log-file path',
    },
    {
      args: ['--add-dir', 'C:\\Users\\test\\My Vault\\notes'],
      command: 'C:\\Program Files\\agy\\agy.cmd',
      name: 'paths containing spaces',
    },
    {
      args: ['--print', 'a & b | c < d > e ^ f'],
      command: 'agy.cmd',
      name: 'cmd.exe metacharacters',
    },
    {
      args: ['--print', 'привет 世界 🌍'],
      command: 'agy.cmd',
      name: 'multibyte prompt content',
    },
    {
      args: ['--print', 'say "hi" now'],
      command: 'agy.cmd',
      name: 'quoted prompt content',
    },
    {
      args: ['--add-dir', 'C:\\Users\\test\\vault\\'],
      command: 'agy.cmd',
      name: 'a trailing backslash',
    },
    {
      args: ['--print', 'before\\"after'],
      command: 'agy.cmd',
      name: 'a backslash before a quote',
    },
    {
      args: ['--print', ''],
      command: 'agy.cmd',
      name: 'an empty argument',
    },
  ];

  it.each(LAUNCH_CASES)('parses $name back out of the cmd.exe command line', ({ args, command }) => {
    expect(parseWindowsShellCommandLine(buildWindowsShellCommandLine(command, args)))
      .toEqual([command, ...args]);
  });

  it.each(LAUNCH_CASES)('recovers $name from a Windows cmd.exe launch', ({ args, command }) => {
    const launch = buildAntigravityProcessLaunch(command, args, {}, 'win32');

    expect(launch.launchMode).toBe('cmdShell');
    expect(toAgyArgs(launch.args)).toEqual(args);
  });

  it.each(LAUNCH_CASES)('recovers $name from a POSIX login-shell launch', ({ args, command }) => {
    const launch = buildAntigravityProcessLaunch(command, args, { SHELL: '/bin/zsh' }, 'darwin');

    expect(launch.launchMode).toBe('shellLogin');
    expect(toAgyArgs(launch.args)).toEqual(args);
  });

  it('recovers arguments from a direct agy.exe launch', () => {
    const launch = buildAntigravityProcessLaunch(
      'C:\\Users\\test\\agy\\agy.exe',
      ['--print', 'hello'],
      {},
      'win32',
    );

    expect(launch.launchMode).toBe('direct');
    expect(toAgyArgs(launch.args)).toEqual(['--print', 'hello']);
  });

  it('detects the capability probe through every launch shape', () => {
    const cmdShell = buildAntigravityProcessLaunch('agy', ['--help'], {}, 'win32');
    const loginShell = buildAntigravityProcessLaunch('agy', ['--help'], { SHELL: '/bin/zsh' }, 'darwin');
    const printLaunch = buildAntigravityProcessLaunch('agy', ['--print', 'hello'], {}, 'win32');

    expect(isHelpProbeArgs(cmdShell.args)).toBe(true);
    expect(isHelpProbeArgs(loginShell.args)).toBe(true);
    expect(isHelpProbeArgs(printLaunch.args)).toBe(false);
  });
});
