import { type ChildProcess, spawn } from 'node:child_process';

import { buildAntigravityProcessLaunch } from './AntigravityProcessLaunch';

const ADD_DIR_HELP_PROBE_TIMEOUT_MS = 10_000;

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
): Promise<boolean> {
  const cached = addDirSupportByCommand.get(command);
  if (cached) {
    return cached;
  }
  const probe = detectAddDirSupport(command, runtimeEnv).catch(() => false);
  addDirSupportByCommand.set(command, probe);
  return probe;
}

export function resetAntigravityAddDirSupportCache(): void {
  addDirSupportByCommand.clear();
}

async function detectAddDirSupport(
  command: string,
  runtimeEnv: NodeJS.ProcessEnv,
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
      resolve(supported);
    };
    const collect = (chunk: Buffer | string): void => {
      output += chunk.toString();
      if (output.includes('--add-dir')) {
        settle(true);
      }
    };

    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', () => settle(output.includes('--add-dir')));
    child.on('close', () => settle(output.includes('--add-dir')));
    timer = window.setTimeout(() => settle(false), ADD_DIR_HELP_PROBE_TIMEOUT_MS);
  });
}
