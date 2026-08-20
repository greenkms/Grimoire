import { type ChildProcess, spawn } from 'node:child_process';

import { buildAntigravityProcessLaunch } from './AntigravityProcessLaunch';

const ADD_DIR_HELP_PROBE_TIMEOUT_MS = 10_000;
const PROBE_OUTPUT_LIMIT = 64_000;

// Anchored so sibling flags like a hypothetical `--add-directory` do not
// register as support; `--no-add-dir` cannot match because its only `--`
// precedes `no`.
const ADD_DIR_FLAG_PATTERN = /--add-dir\b/;

const addDirSupportByCommand = new Map<string, Promise<boolean>>();

/**
 * Older `agy` builds predate `--add-dir`, and Windows builds can return exit
 * code 0 with empty stdout (#67), so support is probed from `agy --help`
 * instead of assumed. The result is cached per CLI command; callers that find
 * no support simply launch without the flag, preserving existing behavior.
 */
export function probeAntigravityAddDirSupport(
  command: string,
  runtimeEnv: NodeJS.ProcessEnv,
  onSpawn?: (child: ChildProcess) => void,
): Promise<boolean> {
  const cached = addDirSupportByCommand.get(command);
  if (cached) {
    return cached;
  }
  const probe = detectAddDirSupport(command, runtimeEnv, onSpawn).catch(() => false);
  addDirSupportByCommand.set(command, probe);
  return probe;
}

export function resetAntigravityAddDirSupportCache(): void {
  addDirSupportByCommand.clear();
}

async function detectAddDirSupport(
  command: string,
  runtimeEnv: NodeJS.ProcessEnv,
  onSpawn?: (child: ChildProcess) => void,
): Promise<boolean> {
  const launch = buildAntigravityProcessLaunch(command, ['--help'], runtimeEnv);
  return new Promise<boolean>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(launch.command, launch.args, {
        env: runtimeEnv,
        shell: launch.shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      resolve(false);
      return;
    }
    onSpawn?.(child);

    let output = '';
    let settled = false;
    let timer: number | undefined;
    const settle = (supported: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      try {
        child.kill();
      } catch {
        // The child already exited between the event and this call.
      }
      // Destroying the read ends stops accumulation and closes the pipe so an
      // orphaned writer (e.g. agy under a killed cmd.exe wrapper) gets EPIPE
      // instead of keeping a broken CLI streaming into memory.
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve(supported);
    };
    const collect = (chunk: Buffer | string): void => {
      if (settled || output.length >= PROBE_OUTPUT_LIMIT) {
        return;
      }
      output += chunk.toString();
      if (ADD_DIR_FLAG_PATTERN.test(output)) {
        settle(true);
      }
    };

    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', () => settle(ADD_DIR_FLAG_PATTERN.test(output)));
    child.on('close', () => settle(ADD_DIR_FLAG_PATTERN.test(output)));
    timer = window.setTimeout(() => settle(false), ADD_DIR_HELP_PROBE_TIMEOUT_MS);
  });
}
