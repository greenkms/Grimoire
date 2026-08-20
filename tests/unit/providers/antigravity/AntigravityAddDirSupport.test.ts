import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import {
  probeAntigravityAddDirSupport,
  resetAntigravityAddDirSupportCache,
} from '@/providers/antigravity/runtime/AntigravityAddDirSupport';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

const mockedSpawn = spawn as jest.Mock;

function createMockChildProcess(): any {
  const proc = new EventEmitter() as any;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  // Probe teardown destroys the pipes; tolerate writes that arrive after it.
  proc.stdout.on('error', () => {});
  proc.stderr.on('error', () => {});
  proc.stdin = null;
  proc.kill = jest.fn();
  proc.pid = 4321;
  return proc;
}

function emitHelpAndExit(proc: any, helpText: string): void {
  proc.stdout.write(helpText);
  proc.emit('close', 0, null);
}

describe('probeAntigravityAddDirSupport', () => {
  beforeEach(() => {
    resetAntigravityAddDirSupportCache();
    mockedSpawn.mockReset();
  });

  it('detects --add-dir in agy --help output', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityAddDirSupport('/usr/local/bin/agy', { SHELL: '/bin/zsh' });
    emitHelpAndExit(proc, 'Usage: agy [flags]\n  --add-dir <dir>   Add a workspace directory\n  --print');

    await expect(promise).resolves.toBe(true);
    expect(mockedSpawn).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-lc', 'exec "$0" "$@"', '/usr/local/bin/agy', '--help'],
      expect.objectContaining({ shell: false }),
    );
  });

  it('reports no support when help output lacks --add-dir', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(proc, 'Usage: agy [flags]\n  --print');

    await expect(promise).resolves.toBe(false);
  });

  it('fail-closes when the probe child cannot be spawned', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityAddDirSupport('agy', {});
    proc.emit('error', new Error('ENOENT'));

    await expect(promise).resolves.toBe(false);
  });

  it('fail-closes when spawn throws', async () => {
    mockedSpawn.mockImplementation(() => {
      throw new Error('spawn refused');
    });

    await expect(probeAntigravityAddDirSupport('agy', {})).resolves.toBe(false);
  });

  it('scans stderr because some CLIs print help there', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityAddDirSupport('agy', {});
    proc.stderr.write('  --add-dir <dir>   Additional workspace\n');
    proc.emit('close', 1, null);

    await expect(promise).resolves.toBe(true);
  });

  it('caches the probe result per CLI command', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityAddDirSupport('/usr/local/bin/agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');
    await expect(first).resolves.toBe(true);

    await expect(probeAntigravityAddDirSupport('/usr/local/bin/agy', {})).resolves.toBe(true);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('also caches negative results so failed probes do not respawn every turn', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(proc, '  --print');
    await expect(first).resolves.toBe(false);

    await expect(probeAntigravityAddDirSupport('agy', {})).resolves.toBe(false);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('fail-closes when agy --help never finishes, and stays settled once', async () => {
    jest.useFakeTimers();
    try {
      const proc = createMockChildProcess();
      mockedSpawn.mockReturnValue(proc);

      const promise = probeAntigravityAddDirSupport('agy', {});
      jest.advanceTimersByTime(10_000);

      await expect(promise).resolves.toBe(false);
      expect(proc.kill).toHaveBeenCalledTimes(1);

      // Late help output after the timeout must not flip the cached result.
      proc.stdout.write('  --add-dir <dir>');
      proc.emit('close', 0, null);
      await expect(probeAntigravityAddDirSupport('agy', {})).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not match sibling flags that merely contain the substring', async () => {
    const directoryProc = createMockChildProcess();
    mockedSpawn.mockReturnValue(directoryProc);
    const directoryPromise = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(directoryProc, '  --add-directory <dir>   Add many directories\n  --print');
    await expect(directoryPromise).resolves.toBe(false);

    resetAntigravityAddDirSupportCache();
    const negationProc = createMockChildProcess();
    mockedSpawn.mockReturnValue(negationProc);
    const negationPromise = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(negationProc, '  --no-add-dir            Disable extra directories\n  --print');
    await expect(negationPromise).resolves.toBe(false);
  });

  it('fail-closes past the output cap even when --add-dir arrives later', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityAddDirSupport('agy', {});
    const filler = `${'x'.repeat(1024)}\n`;
    for (let i = 0; i < 80; i += 1) {
      proc.stdout.write(filler);
    }
    proc.stdout.write('  --add-dir <dir>');
    proc.emit('close', 0, null);

    await expect(promise).resolves.toBe(false);
  });

  it('reports the spawned probe child so callers can cancel it', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);
    const onSpawn = jest.fn();

    const promise = probeAntigravityAddDirSupport('agy', {}, onSpawn);
    expect(onSpawn).toHaveBeenCalledWith(proc);
    emitHelpAndExit(proc, '  --add-dir <dir>');

    await expect(promise).resolves.toBe(true);
  });

  it('probes different CLI commands separately', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');
    await expect(first).resolves.toBe(true);

    const other = createMockChildProcess();
    mockedSpawn.mockReturnValue(other);
    const second = probeAntigravityAddDirSupport('/opt/other/agy', {});
    emitHelpAndExit(other, '  --print');
    await expect(second).resolves.toBe(false);
  });

  it('shares a single in-flight probe between concurrent callers', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityAddDirSupport('agy', {});
    const second = probeAntigravityAddDirSupport('agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });
});
