import { existsSync } from 'node:fs';

import { type ChildProcess,spawn } from 'child_process';
import type { Readable, Writable } from 'stream';

import type { CodexLaunchSpec } from './codexLaunchTypes';

const SIGKILL_TIMEOUT_MS = 3_000;
const WINDOWS_CMD_ARGUMENT_CHARS = /[\s"&<>|{}^=;!'+,`~()%@]/u;

function requiresWindowsShellQuoting(value: string): boolean {
  return WINDOWS_CMD_ARGUMENT_CHARS.test(value)
    || value.includes('[')
    || value.includes(']');
}

function quoteWindowsShellArgument(value: string): string {
  if (!value.length) {
    return '""';
  }

  if (!requiresWindowsShellQuoting(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function resolveWindowsSpawnSpec(launchSpec: Pick<CodexLaunchSpec, 'command' | 'args' | 'spawnCwd' | 'env'>) {
  const command = launchSpec.command.trim();
  const lowerCommand = command.toLowerCase();

  if (!command || process.platform !== 'win32') {
    return {
      command: launchSpec.command,
      args: launchSpec.args,
      env: launchSpec.env,
    };
  }

  if (lowerCommand.endsWith('.cmd')) {
    const shellCommand = [command, ...launchSpec.args]
      .map(value => quoteWindowsShellArgument(value))
      .join(' ');

    return {
      command: process.env.ComSpec || process.env.comspec || 'cmd.exe',
      args: ['/d', '/s', '/c', `"${shellCommand}"`],
      env: launchSpec.env,
      windowsVerbatimArguments: true,
    };
  }

  return {
    command: launchSpec.command,
    args: launchSpec.args,
    env: launchSpec.env,
  };
}

type ExitCallback = (
  code: number | null,
  signal: string | null,
  error?: Error,
) => void;

function describeSpawnError(error: Error, command: string, cwd: string): Error {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    return error;
  }

  if (!existsSync(cwd)) {
    return new Error(
      `Failed to start "${command}": working directory not found: "${cwd}".`,
      { cause: error },
    );
  }

  return new Error(
    `Failed to start "${command}": command not found. Set an absolute CLI path `
    + 'in the provider settings — desktop apps do not inherit the shell PATH.',
    { cause: error },
  );
}

export class CodexAppServerProcess {
  private proc: ChildProcess | null = null;
  private alive = false;
  private exitCallbacks: ExitCallback[] = [];
  private terminated = false;
  private exitCode: number | null = null;
  private exitSignal: string | null = null;
  private exitError: Error | null = null;

  constructor(
    private readonly launchSpec: Pick<CodexLaunchSpec, 'command' | 'args' | 'spawnCwd' | 'env'>,
  ) {}

  start(): void {
    const resolvedSpawnSpec = resolveWindowsSpawnSpec(this.launchSpec);

    this.proc = spawn(resolvedSpawnSpec.command, resolvedSpawnSpec.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.launchSpec.spawnCwd,
      env: resolvedSpawnSpec.env,
      windowsHide: true,
      ...(resolvedSpawnSpec.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
    });

    this.alive = true;

    this.proc.on('exit', (code, signal) => {
      this.notifyTerminated(code, signal);
    });

    // A spawn failure (ENOENT) emits 'error' and never 'exit', so swallowing it
    // here left every pending request to hang until its timeout expired. Treat
    // it as termination and pass the cause on.
    this.proc.on('error', (error) => {
      this.notifyTerminated(null, null, describeSpawnError(
        error,
        this.launchSpec.command,
        this.launchSpec.spawnCwd,
      ));
    });
  }

  get stdin(): Writable {
    if (!this.proc?.stdin) throw new Error('Process not started');
    return this.proc.stdin;
  }

  get stdout(): Readable {
    if (!this.proc?.stdout) throw new Error('Process not started');
    return this.proc.stdout;
  }

  get stderr(): Readable {
    if (!this.proc?.stderr) throw new Error('Process not started');
    return this.proc.stderr;
  }

  isAlive(): boolean {
    return this.alive;
  }

  onExit(callback: ExitCallback): void {
    // Replay termination to late subscribers: the transport subscribes after
    // `start()`, which is after a spawn failure has already been emitted.
    if (this.terminated) {
      this.invokeExitCallback(callback);
      return;
    }

    this.exitCallbacks.push(callback);
  }

  private notifyTerminated(
    code: number | null,
    signal: string | null,
    error?: Error,
  ): void {
    if (this.terminated) {
      return;
    }

    this.terminated = true;
    this.alive = false;
    this.exitCode = code;
    this.exitSignal = signal;
    this.exitError = error ?? null;

    for (const cb of this.exitCallbacks) {
      this.invokeExitCallback(cb);
    }
  }

  /**
   * Only pass the error argument when there is one, so the existing
   * `(code, signal)` call shape is unchanged for normal exits.
   */
  private invokeExitCallback(callback: ExitCallback): void {
    try {
      if (this.exitError) {
        callback(this.exitCode, this.exitSignal, this.exitError);
        return;
      }

      callback(this.exitCode, this.exitSignal);
    } catch {
      // Exit listeners are independent best-effort observers.
    }
  }

  offExit(callback: ExitCallback): void {
    const idx = this.exitCallbacks.indexOf(callback);
    if (idx !== -1) this.exitCallbacks.splice(idx, 1);
  }

  async shutdown(): Promise<void> {
    if (!this.proc || !this.alive) return;

    return new Promise<void>((resolve) => {
      const onExit = () => {
        window.clearTimeout(killTimer);
        resolve();
      };

      this.proc!.once('exit', onExit);
      this.proc!.kill('SIGTERM');

      const killTimer = window.setTimeout(() => {
        if (this.alive) {
          this.proc!.kill('SIGKILL');
        }
      }, SIGKILL_TIMEOUT_MS);
    });
  }
}
