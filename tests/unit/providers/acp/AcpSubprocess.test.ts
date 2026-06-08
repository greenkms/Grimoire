import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

import { AcpSubprocess } from '@/providers/acp/AcpSubprocess';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

type MockChildProcess = EventEmitter & {
  exitCode: number | null;
  killed: boolean;
  kill: jest.Mock<boolean, [NodeJS.Signals]>;
  pid: number;
  stderr: Readable;
  stdin: Writable;
  stdout: Readable;
};

function createMockProcess(): ChildProcessWithoutNullStreams {
  const proc = new EventEmitter() as MockChildProcess;
  proc.stdin = new Writable({ write: (_chunk, _encoding, callback) => callback() });
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.exitCode = null;
  proc.killed = false;
  proc.kill = jest.fn().mockReturnValue(true);
  proc.pid = 12345;
  return proc as unknown as ChildProcessWithoutNullStreams;
}

function createLaunchSpec() {
  return {
    args: ['acp'],
    command: 'opencode.cmd',
    cwd: 'C:\\vault',
    env: { PATH: 'C:\\bin' },
  };
}

describe('AcpSubprocess', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    jest.useRealTimers();
    spawnMock.mockReset();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('enables shell support when spawning ACP commands on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);

    new AcpSubprocess(createLaunchSpec()).start();

    expect(spawnMock).toHaveBeenCalledWith('opencode.cmd', ['acp'], expect.objectContaining({
      cwd: 'C:\\vault',
      env: { PATH: 'C:\\bin' },
      shell: true,
      stdio: 'pipe',
      windowsHide: true,
    }));
  });

  it('does not enable shell support when spawning ACP commands on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);

    new AcpSubprocess({
      args: ['--acp'],
      command: 'gemini',
      cwd: '/vault',
      env: { PATH: '/usr/bin' },
    }).start();

    expect(spawnMock).toHaveBeenCalledWith('gemini', ['--acp'], expect.objectContaining({
      cwd: '/vault',
      env: { PATH: '/usr/bin' },
      shell: false,
      stdio: 'pipe',
      windowsHide: true,
    }));
  });

  it('uses SIGINT first and taskkill fallback when Windows shutdown times out', async () => {
    jest.useFakeTimers();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
    const subprocess = new AcpSubprocess(createLaunchSpec());
    subprocess.start();

    const shutdownPromise = subprocess.shutdown();
    jest.advanceTimersByTime(3_000);

    expect(mockProc.kill).toHaveBeenCalledWith('SIGINT');
    expect(mockProc.kill).not.toHaveBeenCalledWith('SIGTERM');
    expect(mockProc.kill).not.toHaveBeenCalledWith('SIGKILL');
    expect(spawnMock).toHaveBeenCalledWith('taskkill', ['/pid', '12345', '/f', '/t'], {
      windowsHide: true,
    });

    mockProc.emit('exit', 1, null);
    await shutdownPromise;
  });
});
