import { type ChildProcess, spawn } from 'node:child_process';

import type GrimoirePlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import type { AntigravityDiscoveredModel } from '../settings';
import { buildAntigravityProcessLaunch } from './AntigravityProcessLaunch';
import { buildAntigravityRuntimeEnv } from './AntigravityRuntimeEnvironment';

const MODEL_LIST_TIMEOUT_MS = 30_000;
const MODEL_LIST_BUFFER_LIMIT = 32_000;
const ACTIVE_MODELS_PROCESS_KEY = '__grimoireAntigravityActiveModelsProcess';

type AntigravityWindowState = Window & {
  [ACTIVE_MODELS_PROCESS_KEY]?: ChildProcess;
};

export async function discoverAntigravityModels(plugin: GrimoirePlugin): Promise<AntigravityDiscoveredModel[]> {
  const command = plugin.getResolvedProviderCliPath('antigravity') ?? 'agy';
  const cwd = getVaultPath(plugin.app) ?? process.cwd();
  plugin.recordDebugLog?.({
    data: {
      argsSummary: 'models',
      command,
      commandSource: classifyAgyCommand(command),
      cwdLabel: getCwdLabel(plugin, cwd),
      homePresent: Boolean(process.env.HOME),
      pathEntryCount: (process.env.PATH ?? '').split(':').filter(Boolean).length,
      pathHasLocalBin: (process.env.PATH ?? '').split(':').includes(`${process.env.HOME ?? ''}/.local/bin`),
      providerId: 'antigravity',
      shellPresent: Boolean(process.env.SHELL),
    },
    event: 'models.spawn',
    level: 'debug',
    scope: 'provider.antigravity',
  });
  const output = await runAgyModels({
    command,
    cwd,
    plugin,
    runtimeEnv: buildAntigravityRuntimeEnv(plugin.settings, command),
  });
  const models = parseAntigravityModels(output);

  plugin.recordDebugLog?.({
    data: {
      modelCount: models.length,
      providerId: 'antigravity',
      stdoutBytes: output.length,
    },
    event: models.length > 0 ? 'models.parsed' : 'models.empty',
    level: models.length > 0 ? 'info' : 'warn',
    scope: 'provider.antigravity',
  });

  return models;
}

export function parseAntigravityModels(output: string): AntigravityDiscoveredModel[] {
  const models: AntigravityDiscoveredModel[] = [];
  const seen = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const rawId = line.trim();
    if (!rawId || seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);
    models.push({
      label: rawId,
      rawId,
    });
  }
  return models;
}

function runAgyModels(spec: {
  command: string;
  cwd: string;
  plugin: GrimoirePlugin;
  runtimeEnv: NodeJS.ProcessEnv;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const previousProcess = getActiveModelsProcess();
    if (previousProcess && !previousProcess.killed) {
      previousProcess.kill('SIGTERM');
      spec.plugin.recordDebugLog?.({
        data: {
          providerId: 'antigravity',
        },
        event: 'models.previousKilled',
        level: 'warn',
        scope: 'provider.antigravity',
      });
    }
    const launch = buildAntigravityProcessLaunch(spec.command, ['models'], spec.runtimeEnv);
    spec.plugin.recordDebugLog?.({
      data: {
        launchMode: launch.launchMode,
        providerId: 'antigravity',
      },
      event: 'models.launchMode',
      level: 'debug',
      scope: 'provider.antigravity',
    });
    const proc = spawn(launch.command, launch.args, {
      cwd: spec.cwd,
      env: spec.runtimeEnv,
      shell: launch.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    setActiveModelsProcess(proc);
    spec.plugin.recordDebugLog?.({
      data: {
        launchMode: launch.launchMode,
        pid: proc.pid ?? -1,
        providerId: 'antigravity',
        stdinMode: 'ignore',
        stdioMode: 'ignore-pipe-pipe',
      },
      event: 'models.processStarted',
      level: 'debug',
      scope: 'provider.antigravity',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let sawStdout = false;
    let sawStderr = false;
    const startedAt = Date.now();
    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      clearActiveModelsProcess(proc);
      callback();
    };
    const timeout = window.setTimeout(() => {
      spec.plugin.recordDebugLog?.({
        data: {
          killSignal: 'SIGTERM',
          pid: proc.pid ?? -1,
          providerId: 'antigravity',
        },
        event: 'models.signalSent',
        level: 'warn',
        scope: 'provider.antigravity',
      });
      proc.kill('SIGTERM');
      window.setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) {
          spec.plugin.recordDebugLog?.({
            data: {
              killSignal: 'SIGKILL',
              pid: proc.pid ?? -1,
              providerId: 'antigravity',
            },
            event: 'models.forceKill',
            level: 'error',
            scope: 'provider.antigravity',
          });
          proc.kill('SIGKILL');
        }
      }, 2_000);
      spec.plugin.recordDebugLog?.({
        data: {
          durationMs: Date.now() - startedAt,
          providerId: 'antigravity',
          stderrBytes: stderr.length,
          stderrPreview: summarizeCliText(stderr),
          stdoutBytes: stdout.length,
          timeoutMs: MODEL_LIST_TIMEOUT_MS,
        },
        event: 'models.timeout',
        level: 'error',
        scope: 'provider.antigravity',
      });
      settle(() => reject(new Error('Antigravity model discovery timed out.')));
    }, MODEL_LIST_TIMEOUT_MS);

    proc.stdout.on('data', (chunk: Buffer | string) => {
      stdout = appendLimited(stdout, chunk);
      if (!sawStdout) {
        sawStdout = true;
        spec.plugin.recordDebugLog?.({
          data: {
            pid: proc.pid ?? -1,
            providerId: 'antigravity',
            stdoutBytes: stdout.length,
          },
          event: 'models.stdout',
          level: 'debug',
          scope: 'provider.antigravity',
        });
      }
    });
    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr = appendLimited(stderr, chunk);
      if (!sawStderr) {
        sawStderr = true;
        spec.plugin.recordDebugLog?.({
          data: {
            pid: proc.pid ?? -1,
            providerId: 'antigravity',
            stderrBytes: stderr.length,
            stderrPreview: summarizeCliText(stderr),
          },
          event: 'models.stderr',
          level: 'warn',
          scope: 'provider.antigravity',
        });
      }
    });
    proc.on('error', (error) => {
      settle(() => {
        spec.plugin.recordDebugLog?.({
          data: {
            providerId: 'antigravity',
          },
          error,
          event: 'models.spawnError',
          level: 'error',
          scope: 'provider.antigravity',
        });
        reject(error);
      });
    });
    proc.on('exit', (code, signal) => {
      settle(() => {
        const status = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
        spec.plugin.recordDebugLog?.({
          data: {
            durationMs: Date.now() - startedAt,
            providerId: 'antigravity',
            status,
            stderrBytes: stderr.length,
            stderrPreview: summarizeCliText(stderr),
            stdoutBytes: stdout.length,
          },
          event: code === 0 ? 'models.exit' : 'models.failed',
          level: code === 0 ? 'debug' : 'error',
          scope: 'provider.antigravity',
        });
        if (code === 0) {
          resolve(stdout);
          return;
        }
        const details = stderr.trim();
        reject(new Error(details ? `Antigravity model discovery failed (${status})\n\n${details}` : `Antigravity model discovery failed (${status})`));
      });
    });
    proc.on('close', (code, signal) => {
      const status = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
      spec.plugin.recordDebugLog?.({
        data: {
          durationMs: Date.now() - startedAt,
          pid: proc.pid ?? -1,
          providerId: 'antigravity',
          signal: signal ?? 'none',
          status,
          stderrBytes: stderr.length,
          stdoutBytes: stdout.length,
        },
        event: 'models.close',
        level: 'debug',
        scope: 'provider.antigravity',
      });
    });
  });
}

function getActiveModelsProcess(): ChildProcess | null {
  return (window as AntigravityWindowState)[ACTIVE_MODELS_PROCESS_KEY] ?? null;
}

function setActiveModelsProcess(proc: ChildProcess): void {
  (window as AntigravityWindowState)[ACTIVE_MODELS_PROCESS_KEY] = proc;
}

function clearActiveModelsProcess(proc: ChildProcess): void {
  const state = window as AntigravityWindowState;
  if (state[ACTIVE_MODELS_PROCESS_KEY] === proc) {
    delete state[ACTIVE_MODELS_PROCESS_KEY];
  }
}

function appendLimited(current: string, chunk: Buffer | string): string {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
  return `${current}${text}`.slice(-MODEL_LIST_BUFFER_LIMIT);
}

function getCwdLabel(plugin: GrimoirePlugin, cwd: string): string {
  return cwd === getVaultPath(plugin.app) ? 'vault' : 'process';
}

function classifyAgyCommand(command: string): string {
  if (command === 'agy') {
    return 'path';
  }
  if (command.endsWith('/.local/bin/agy')) {
    return 'homeLocalBin';
  }
  return 'absolute';
}

function summarizeCliText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 240);
}
