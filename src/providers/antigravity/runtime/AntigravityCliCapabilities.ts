import { type ChildProcess, spawn } from 'node:child_process';

import { buildAntigravityProcessLaunch } from './AntigravityProcessLaunch';

const HELP_PROBE_TIMEOUT_MS = 10_000;
const PROBE_OUTPUT_LIMIT = 64_000;

export interface AntigravityCliCapabilities {
  addDir: boolean;
  printTimeout: boolean;
  streamJson: boolean;
}

export const NO_ANTIGRAVITY_CLI_CAPABILITIES: AntigravityCliCapabilities = {
  addDir: false,
  printTimeout: false,
  streamJson: false,
};

// Negative lookaheads so sibling flags like a hypothetical `--add-directory`
// or `--input-format-json` do not register as support; `--no-add-dir` cannot
// match because its only `--` precedes `no`.
const ADD_DIR_FLAG_PATTERN = /--add-dir(?![\w-])/;
const INPUT_FORMAT_FLAG_PATTERN = /--input-format(?![\w-])/;
const OUTPUT_FORMAT_FLAG_PATTERN = /--output-format(?![\w-])/;
const PRINT_TIMEOUT_FLAG_PATTERN = /--print-timeout(?![\w-])/;

const capabilitiesByCommand = new Map<string, Promise<AntigravityCliCapabilities>>();

/**
 * Older `agy` builds predate `--add-dir` (#67), `--input-format
 * stream-json` (#69), and `--print-timeout` (#70), and Windows builds can
 * return exit code 0 with empty stdout (#67), so support is probed from
 * `agy --help` instead of assumed. The result is cached per CLI command;
 * callers degrade to the `--print` argv transport when a flag is missing.
 */
export function probeAntigravityCliCapabilities(
  command: string,
  runtimeEnv: NodeJS.ProcessEnv,
  onSpawn?: (child: ChildProcess) => void,
): Promise<AntigravityCliCapabilities> {
  const cached = capabilitiesByCommand.get(command);
  if (cached) {
    return cached;
  }
  const probe = detectCliCapabilities(command, runtimeEnv, onSpawn)
    .catch(() => NO_ANTIGRAVITY_CLI_CAPABILITIES);
  capabilitiesByCommand.set(command, probe);
  return probe;
}

export function resetAntigravityCliCapabilitiesCache(): void {
  capabilitiesByCommand.clear();
}

function detectCliCapabilities(
  command: string,
  runtimeEnv: NodeJS.ProcessEnv,
  onSpawn?: (child: ChildProcess) => void,
): Promise<AntigravityCliCapabilities> {
  const launch = buildAntigravityProcessLaunch(command, ['--help'], runtimeEnv);
  return new Promise<AntigravityCliCapabilities>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(launch.command, launch.args, {
        env: runtimeEnv,
        shell: launch.shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      resolve(NO_ANTIGRAVITY_CLI_CAPABILITIES);
      return;
    }
    onSpawn?.(child);

    let output = '';
    let settled = false;
    let timer: number | undefined;
    const evaluate = (): AntigravityCliCapabilities => ({
      addDir: ADD_DIR_FLAG_PATTERN.test(output),
      printTimeout: PRINT_TIMEOUT_FLAG_PATTERN.test(output),
      streamJson: INPUT_FORMAT_FLAG_PATTERN.test(output) && OUTPUT_FORMAT_FLAG_PATTERN.test(output),
    });
    const settle = (): void => {
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
      resolve(evaluate());
    };
    const collect = (chunk: Buffer | string): void => {
      if (settled || output.length >= PROBE_OUTPUT_LIMIT) {
        return;
      }
      output += chunk.toString();
      // Help output that already advertises every probed flag cannot gain
      // more capabilities, so the child can be released early.
      const capabilities = evaluate();
      if (capabilities.addDir && capabilities.printTimeout && capabilities.streamJson) {
        settle();
      }
    };

    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', settle);
    child.on('close', settle);
    timer = window.setTimeout(settle, HELP_PROBE_TIMEOUT_MS);
  });
}
