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
