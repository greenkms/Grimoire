import '@/providers';

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

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
import { updateAntigravityProviderSettings } from '@/providers/antigravity/settings';

jest.mock('node:child_process', () => ({
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
  proc.kill = jest.fn();
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

function writeStreamJsonFrame(proc: any, event: Record<string, unknown>): void {
  proc.stdout.write(`${JSON.stringify(event)}\n`);
}

function writeStreamJsonResult(
  proc: any,
  result: { error?: string; response: string; status: string },
): void {
  writeStreamJsonFrame(proc, { event: 'result', result });
}

function getSpawnedAgyArgs(): string[] {
  const printCall = mockedSpawn.mock.calls
    .map(([, args]: [string, string[]]) => {
      const flagArgs = args[0] === '-lc' && args[1] === 'exec "$0" "$@"' ? args.slice(3) : args;
      const isPrint = flagArgs.includes('--print') || flagArgs.includes('--input-format');
      return { args: flagArgs, isPrint };
    })
    .find((entry: { isPrint: boolean }) => entry.isPrint);
  return printCall ? printCall.args : [];
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
    proc.emit('exit', 0, null);

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
      const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
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
      proc.emit('exit', 0, null);

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
      if (args.includes('--help')) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'List vault files' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --add-dir <dir>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Vault listed\n');
    printProc.emit('exit', 0, null);

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
      if (args.includes('--help')) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --print\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Hi\n');
    printProc.emit('exit', 0, null);

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
      if (args.includes('--help')) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write([
      'Usage: agy [flags]',
      '  --add-dir <dir>',
      '  --input-format <format>',
      '  --output-format <format>',
    ].join('\n'));
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    const spawnOptions = mockedSpawn.mock.calls
      .filter(([, args]: [string, string[]]) => !args.includes('--help'))
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
    printProc.emit('exit', 0, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({ content: 'Streamed answer', type: 'text' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
  });

  it('rejects with the structured result error when agy reports status ERROR', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (args.includes('--help')) return probeProc;
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
    printProc.emit('exit', 1, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({
      type: 'error',
      content: 'Antigravity CLI reported an error: timeout waiting for response',
    });
  });

  it('survives EPIPE on stdin when the child exits before draining it', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess({ stdin: true });
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (args.includes('--help')) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: '' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --input-format <f>\n  --output-format <f>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    printProc.stdin.emit('error', new Error('write EPIPE'));
    printProc.stderr.write('prompt must not be empty\n');
    printProc.emit('exit', 1, null);

    const chunks = await chunksPromise;
    expect(chunks).toContainEqual({
      type: 'error',
      content: expect.stringContaining('Antigravity CLI exited (code 1)'),
    });
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
    proc.emit('exit', 0, null);

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
      const spawnArgs = mockedSpawn.mock.calls[0][1] as string[];
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
      proc.emit('exit', 0, null);

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

  it('drops the print run when cancelled while the add-dir probe is in flight', async () => {
    const runtime = new AntigravityChatRuntime(createMockPlugin());
    const probeProc = createMockChildProcess();
    const printProc = createMockChildProcess();
    mockedSpawn.mockImplementation((command: string, args: string[]) => {
      if (args.includes('--help')) return probeProc;
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
      if (args.includes('--help')) return probeProc;
      return printProc;
    });

    const chunksPromise = collect(runtime.query(runtime.prepareTurn({ text: 'Hello' })));
    await new Promise((resolve) => setImmediate(resolve));
    probeProc.stdout.write('Usage: agy\n  --add-dir <dir>\n');
    probeProc.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    printProc.stdout.write('Hi\n');
    printProc.emit('exit', 0, null);
    await chunksPromise;

    const spawnLog = recordDebugLog.mock.calls
      .map(([entry]) => entry)
      .find((entry: any) => entry.event === 'print.spawn');
    expect(spawnLog?.data?.argsSummary).toContain('--add-dir <vault-path>');
    expect(spawnLog?.data?.argsSummary).not.toContain('/tmp/grimoire-antigravity-test-vault');
  });
});
