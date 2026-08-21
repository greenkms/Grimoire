import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import {
  probeAntigravityCliCapabilities,
  resetAntigravityCliCapabilitiesCache,
} from '@/providers/antigravity/runtime/AntigravityCliCapabilities';

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

describe('probeAntigravityCliCapabilities', () => {
  beforeEach(() => {
    resetAntigravityCliCapabilitiesCache();
    mockedSpawn.mockReset();
  });

  it('detects every capability in agy --help output', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('/usr/local/bin/agy', { SHELL: '/bin/zsh' });
    emitHelpAndExit(proc, [
      'Usage: agy [flags]',
      '  --add-dir <dir>          Add a workspace directory',
      '  --input-format <format>  Input format',
      '  --output-format <format> Output format',
      '  --print-timeout <dur>    Print timeout',
      '  --print',
    ].join('\n'));

    await expect(promise).resolves.toEqual({
      addDir: true,
      printTimeout: true,
      streamJson: true,
    });
    expect(mockedSpawn).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-lc', 'exec "$0" "$@"', '/usr/local/bin/agy', '--help'],
      expect.objectContaining({ shell: false }),
    );
  });

  it('reports mixed capabilities when help advertises only some flags', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, [
      'Usage: agy [flags]',
      '  --add-dir <dir>          Add a workspace directory',
      '  --print-timeout <dur>    Print timeout',
      '  --print',
    ].join('\n'));

    await expect(promise).resolves.toEqual({
      addDir: true,
      printTimeout: true,
      streamJson: false,
    });
  });

  it('requires both format flags for stream-json support', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, [
      'Usage: agy [flags]',
      '  --input-format <format>  Input format',
      '  --print',
    ].join('\n'));

    const capabilities = await promise;
    expect(capabilities.streamJson).toBe(false);
  });

  it('reports no support when help output lacks the flags', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, 'Usage: agy [flags]\n  --print');

    await expect(promise).resolves.toEqual({
      addDir: false,
      printTimeout: false,
      streamJson: false,
    });
  });

  it('fail-closes when the probe child cannot be spawned', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    proc.emit('error', new Error('ENOENT'));

    await expect(promise).resolves.toEqual({
      addDir: false,
      printTimeout: false,
      streamJson: false,
    });
  });

  it('fail-closes when spawn throws', async () => {
    mockedSpawn.mockImplementation(() => {
      throw new Error('spawn refused');
    });

    await expect(probeAntigravityCliCapabilities('agy', {})).resolves.toEqual({
      addDir: false,
      printTimeout: false,
      streamJson: false,
    });
  });

  it('scans stderr because some CLIs print help there', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    proc.stderr.write('  --add-dir <dir>   Additional workspace\n');
    proc.emit('close', 1, null);

    const capabilities = await promise;
    expect(capabilities.addDir).toBe(true);
  });

  it('caches the probe result per CLI command', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityCliCapabilities('/usr/local/bin/agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');
    await expect(first).resolves.toEqual(expect.objectContaining({ addDir: true }));

    await expect(probeAntigravityCliCapabilities('/usr/local/bin/agy', {}))
      .resolves.toEqual(expect.objectContaining({ addDir: true }));
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('also caches negative results so failed probes do not respawn every turn', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const first = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, '  --print');
    await expect(first).resolves.toEqual(expect.objectContaining({ addDir: false }));

    await expect(probeAntigravityCliCapabilities('agy', {}))
      .resolves.toEqual(expect.objectContaining({ addDir: false }));
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('releases the help child early once every probed flag is advertised', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    proc.stdout.write([
      '  --add-dir <dir>',
      '  --input-format <format>',
      '  --output-format <format>',
      '  --print-timeout <dur>',
    ].join('\n'));
    await new Promise((resolve) => setImmediate(resolve));

    await expect(promise).resolves.toEqual({
      addDir: true,
      printTimeout: true,
      streamJson: true,
    });
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });

  it('fail-closes when agy --help never finishes, and stays settled once', async () => {
    jest.useFakeTimers();
    try {
      const proc = createMockChildProcess();
      mockedSpawn.mockReturnValue(proc);

      const promise = probeAntigravityCliCapabilities('agy', {});
      jest.advanceTimersByTime(10_000);

      await expect(promise).resolves.toEqual({
        addDir: false,
        printTimeout: false,
        streamJson: false,
      });
      expect(proc.kill).toHaveBeenCalledTimes(1);

      // Late help output after the timeout must not flip the cached result.
      proc.stdout.write('  --add-dir <dir>  --input-format <f>  --output-format <f>  --print-timeout <d>');
      proc.emit('close', 0, null);
      await expect(probeAntigravityCliCapabilities('agy', {})).resolves.toEqual({
        addDir: false,
        printTimeout: false,
        streamJson: false,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not match sibling flags that merely contain the substring', async () => {
    const directoryProc = createMockChildProcess();
    mockedSpawn.mockReturnValue(directoryProc);
    const directoryPromise = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(directoryProc, [
      '  --add-directory <dir>   Add many directories',
      '  --input-format-json     JSON input',
      '  --print-timeout-max <dur>',
      '  --print',
    ].join('\n'));
    await expect(directoryPromise).resolves.toEqual({
      addDir: false,
      printTimeout: false,
      streamJson: false,
    });

    resetAntigravityCliCapabilitiesCache();
    const negationProc = createMockChildProcess();
    mockedSpawn.mockReturnValue(negationProc);
    const negationPromise = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(negationProc, '  --no-add-dir            Disable extra directories\n  --print');
    await expect(negationPromise).resolves.toEqual(expect.objectContaining({ addDir: false }));
  });

  it('fail-closes past the output cap even when --add-dir arrives later', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);

    const promise = probeAntigravityCliCapabilities('agy', {});
    const filler = `${'x'.repeat(1024)}\n`;
    for (let i = 0; i < 80; i += 1) {
      proc.stdout.write(filler);
    }
    proc.stdout.write('  --add-dir <dir>');
    proc.emit('close', 0, null);

    await expect(promise).resolves.toEqual(expect.objectContaining({ addDir: false }));
  });

  it('reports the spawned probe child so callers can cancel it', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);
    const onSpawn = jest.fn();

    const promise = probeAntigravityCliCapabilities('agy', {}, onSpawn);
    expect(onSpawn).toHaveBeenCalledWith(proc);
    emitHelpAndExit(proc, '  --add-dir <dir>');

    await expect(promise).resolves.toEqual(expect.objectContaining({ addDir: true }));
  });

  it('probes different CLI commands separately', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);
    const first = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');
    await expect(first).resolves.toEqual(expect.objectContaining({ addDir: true }));

    const other = createMockChildProcess();
    mockedSpawn.mockReturnValue(other);
    const second = probeAntigravityCliCapabilities('/opt/other/agy', {});
    emitHelpAndExit(other, '  --print');
    await expect(second).resolves.toEqual(expect.objectContaining({ addDir: false }));
  });

  it('shares a single in-flight probe between concurrent callers', async () => {
    const proc = createMockChildProcess();
    mockedSpawn.mockReturnValue(proc);
    const first = probeAntigravityCliCapabilities('agy', {});
    const second = probeAntigravityCliCapabilities('agy', {});
    emitHelpAndExit(proc, '  --add-dir <dir>');

    await expect(first).resolves.toEqual(expect.objectContaining({ addDir: true }));
    await expect(second).resolves.toEqual(expect.objectContaining({ addDir: true }));
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });
});
