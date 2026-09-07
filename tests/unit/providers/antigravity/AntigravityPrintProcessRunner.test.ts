import { executionSessionId, runId, sessionInstanceId } from '@/core/execution/ExecutionIds';
import type { AntigravityInvocation } from '@/providers/antigravity/execution/AntigravityExecutionBackend';
import { AntigravityExecutionBackend } from '@/providers/antigravity/execution/AntigravityExecutionBackend';
import { ANTIGRAVITY_OUTPUT_BYTE_LIMIT } from '@/providers/antigravity/execution/AntigravityExecutionComposition';
import {
  type AntigravityManagedChildProcess,
  AntigravityPrintProcessRunner,
  type AntigravityProcessTransportSpec,
} from '@/providers/antigravity/runtime/AntigravityPrintProcessRunner';

describe('AntigravityPrintProcessRunner', () => {
  it('builds the provider print protocol without shell-interpreting the prompt', async () => {
    const child = new FakeManagedChild();
    const transport = new FakeTransport(child);
    const removeLog = jest.fn().mockResolvedValue(undefined);
    const runner = new AntigravityPrintProcessRunner({
      transport,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog,
    });

    const handle = runner.start(INVOCATION);
    child.exit.resolve({ code: 0 });
    await handle.completed;

    expect(transport.specs).toHaveLength(1);
    expect(transport.specs[0]).toMatchObject({
      cwd: '/vault',
      environment: { PATH: '/usr/local/bin' },
      shell: false,
    });
    expect(transport.specs[0]?.args).toEqual(expect.arrayContaining([
      '--dangerously-skip-permissions',
      '--log-file',
      '/tmp/antigravity.log',
      '--model',
      'Gemini 3.5 Flash (High)',
      '--print',
      'hello && keep this as one argument',
    ]));
    expect(removeLog).toHaveBeenCalledWith('/tmp/antigravity.log');
  });

  it('admits the vault only when the CLI says it knows the flag', async () => {
    // **`agy` scopes its workspace to what it was told about, not to where it
    // was started** (#67), so the vault has to be named — and an older build
    // treats an unknown flag as an argument and fails the run on it. Both
    // halves are the test: sent when advertised, absent when not.
    const advertised = new FakeTransport(new FakeManagedChild());
    const legacy = new FakeTransport(new FakeManagedChild());

    for (const [transport, addDir] of [[advertised, true], [legacy, false]] as const) {
      const runner = new AntigravityPrintProcessRunner({
        transport,
        createLogPath: () => '/tmp/antigravity.log',
        removeLog: jest.fn().mockResolvedValue(undefined),
      });
      const handle = runner.start({
        ...INVOCATION,
        addDirPath: '/vault',
        cliCapabilities: { addDir, printTimeout: false, streamJson: false },
      });
      (transport.child as FakeManagedChild).exit.resolve({ code: 0 });
      await handle.completed;
    }

    expect(advertised.specs[0]?.args).toEqual(expect.arrayContaining(['--add-dir', '/vault']));
    expect(legacy.specs[0]?.args).not.toContain('--add-dir');
  });

  it('sends no vault to add when there is no vault', async () => {
    // `cwd` falls back to the process directory, and a fallback is not a vault:
    // adding it would widen the agent's workspace to wherever Obsidian was
    // started from.
    const transport = new FakeTransport(new FakeManagedChild());
    const runner = new AntigravityPrintProcessRunner({
      transport,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: jest.fn().mockResolvedValue(undefined),
    });

    const handle = runner.start({
      ...INVOCATION,
      cliCapabilities: { addDir: true, printTimeout: false, streamJson: false },
    });
    (transport.child as FakeManagedChild).exit.resolve({ code: 0 });
    await handle.completed;

    expect(transport.specs[0]?.args).not.toContain('--add-dir');
  });

  it('sends the prompt on stdin and reads the answer out of the result frame', async () => {
    // **`agy` refuses `--print` with `--input-format stream-json`**, so the two
    // shapes are exclusive: the transcript leaves argv entirely, which is what
    // survives a conversation past the Windows command-line limit (#69). And
    // the answer is one field of the last frame — accumulating the pipe would
    // spend the byte ceiling on NDJSON envelopes.
    const child = new FakeManagedChild({
      // The frame shapes are the parser's own, which were verified against a
      // live `agy --output-format stream-json` capture — not a plausible
      // spelling: `step_update` carries the step under its own name, and the
      // answer is `result.response`.
      stdout: [
        '{"event":"step_update","step_update":{"step_type":"text","text_delta":"par"}}\n',
        '{"event":"step_update","step_update":{"step_type":"text","text_delta":"tial"}}\n',
        '{"event":"result","result":{"status":"ok","response":"partial answer","error":null}}\n',
      ],
    });
    const transport = new FakeTransport(child);
    const streamed: string[] = [];
    const runner = new AntigravityPrintProcessRunner({
      transport,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: jest.fn().mockResolvedValue(undefined),
    });

    const handle = runner.start({
      ...INVOCATION,
      cliCapabilities: { addDir: false, printTimeout: false, streamJson: true },
    }, { onAssistantText: text => streamed.push(text) });
    child.exit.resolve({ code: 0 });
    const outcome = await handle.completed;

    expect(transport.specs[0]?.args).toEqual(expect.arrayContaining([
      '--input-format', 'stream-json', '--output-format', 'stream-json',
    ]));
    expect(transport.specs[0]?.args).not.toContain('--print');
    expect(transport.specs[0]?.stdin).toBe('pipe');
    expect(child.stdinWrites).toEqual([
      expect.stringContaining('"event":"user"'),
    ]);
    expect(outcome.stdout).toBe('partial answer');
    // And the pieces reached the caller while the run was still open, rather
    // than only as the finished whole.
    expect(streamed).toEqual(['par', 'tial']);
  });

  it('counts a growing log as a sign of life, and asks agy to stop before we do', async () => {
    // **The only signal a silent tool call gives.** `agy` emits frames on step
    // transitions rather than continuously, so a healthy call — one measured at
    // about five minutes in the wild — keeps both pipes quiet while its log
    // keeps growing (#70). Without this, the run reads as hung.
    const child = new FakeManagedChild();
    const transport = new FakeTransport(child);
    const activity: string[] = [];
    let poll: (() => void) | undefined;
    const sizes = [0, 0, 512, 512];
    const runner = new AntigravityPrintProcessRunner({
      transport,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: jest.fn().mockResolvedValue(undefined),
      setPoll: (callback) => { poll = callback; return 1; },
      clearPoll: () => undefined,
      logSize: async () => sizes.shift() ?? 512,
    });

    const handle = runner.start({
      ...INVOCATION,
      cliCapabilities: { addDir: false, printTimeout: true, streamJson: false },
    }, { onActivity: () => activity.push('alive') });
    poll?.();
    poll?.();
    poll?.();
    await Promise.resolve();
    await Promise.resolve();
    child.exit.resolve({ code: 0 });
    await handle.completed;

    // Once, for the poll that saw growth — not for the two that saw none.
    expect(activity).toEqual(['alive']);
    expect(transport.specs[0]?.args).toEqual(expect.arrayContaining(['--print-timeout', '29m']));
  });

  it('signals a combined byte overflow instead of silently truncating provider output', async () => {
    const child = new FakeManagedChild({
      stdout: ['123', '4567'],
    });
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      outputByteLimit: 6,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
    });
    const handle = runner.start(INVOCATION);
    child.exit.resolve({ code: 0 });

    await expect(handle.outputLimitExceeded).resolves.toBeUndefined();
    await expect(handle.completed).resolves.toMatchObject({
      stdout: '123',
      outputLimitExceeded: true,
    });
  });

  it('lets a turn print far more than the old buffer size on the configured budget', async () => {
    // The budget is what the product actually runs with, not a test value: it
    // used to be a *sliding buffer* size (`.slice(-64_000)`), and carrying the
    // number over to a cumulative budget turned "keep the last 64 KB" into
    // "kill any turn that says more than 64 KB". A trivial agy probe already
    // writes ~30 KB, so real turns died and stored an empty answer.
    const spoken = 200_000;
    const child = new FakeManagedChild({
      stdout: ['x'.repeat(spoken)],
    });
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      outputByteLimit: ANTIGRAVITY_OUTPUT_BYTE_LIMIT,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
    });
    const handle = runner.start(INVOCATION);
    child.exit.resolve({ code: 0 });

    const outcome = await handle.completed;
    expect(outcome.outputLimitExceeded).toBeUndefined();
    expect(outcome.stdout).toHaveLength(spoken);
  });

  it('finishes a turn whose pipes an orphan still holds after the process exited', async () => {
    // 1.3.2 gave `close` a grace period after `exit` and then forced the
    // streams shut, because "an orphaned grandchild holding the pipes would
    // otherwise hold the whole run hostage". Waiting on the streams with no
    // deadline brings the hostage back: agy answers, exits, and the tab spins
    // forever on a pipe nobody will close.
    const child = new FakeManagedChild();
    // A stdout that never ends, the way a held pipe behaves.
    (child as { stdout: AsyncIterable<Uint8Array> }).stdout = {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
    } as AsyncIterable<Uint8Array>;
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      outputByteLimit: ANTIGRAVITY_OUTPUT_BYTE_LIMIT,
      drainGraceMs: 1,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
      recoverTranscript: async () => ({ output: 'answered', outputLimitExceeded: false }),
    });
    const handle = runner.start(INVOCATION);
    child.exit.resolve({ code: 0 });

    await expect(handle.completed).resolves.toMatchObject({ exitCode: 0 });
  });

  it('ends a turn on the result frame even when the CLI never leaves', async () => {
    // Observed live: `agy` answered and stayed resident. Treating process exit
    // as the end of the turn leaves the tab spinning on an answer it already
    // has. The turn is over when the last `result` frame arrives.
    const child = new FakeManagedChild({
      stdout: [
        '{"event":"result","result":{"status":"ok","response":"done","error":null}}\n',
      ],
    });
    // `exit` is never resolved: the process outlives its own answer.
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      drainGraceMs: 1,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
    });

    const handle = runner.start({
      ...INVOCATION,
      cliCapabilities: { addDir: false, printTimeout: false, streamJson: true },
    });

    await expect(handle.completed).resolves.toMatchObject({ stdout: 'done' });
    expect(child.terminationModes.length).toBeGreaterThan(0);
  });

  it('ends a turn on the result frame while the CLI still holds its pipe open', async () => {
    // The case the previous test cannot reach. Its fake stdout *ends* after the
    // result frame, so the drain resolves and the wait is released by the pipe
    // rather than by the frame. A resident `agy` closes neither: it answers,
    // keeps stdout open, and does not exit. Then `Promise.race([drained,
    // exited])` has nothing to settle it, the frame is parsed but never
    // examined, and the run spins until the user cancels it — the reported
    // symptom, with a visible complete answer and an active run (#139).
    const child = new FakeManagedChild();
    (child as { stdout: AsyncIterable<Uint8Array> }).stdout = residentStdout([
      '{"event":"step_update","step_update":{"step_type":"text","text_delta":"done"}}\n',
      '{"event":"result","result":{"status":"ok","response":"done","error":null}}\n',
    ]);
    // `exit` is never resolved and the pipe never closes: both boundaries the
    // wait knows about are absent, which is what a resident CLI looks like.
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      drainGraceMs: 1,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
    });

    const handle = runner.start({
      ...INVOCATION,
      cliCapabilities: { addDir: false, printTimeout: false, streamJson: true },
    });

    await expect(settledWithin(handle.completed, 250)).resolves.toMatchObject({
      stdout: 'done',
    });
    expect(child.terminationModes.length).toBeGreaterThan(0);
  });

  it('stops calling a growing log a sign of life once no tool call is open', async () => {
    // The log tells a long tool call apart from a hang (#70), but it is the
    // CLI's own file: a resident `agy` keeps appending to it after the answer
    // is delivered. Reported as activity regardless, it re-arms the backend's
    // inactivity timeout forever, so the one mechanism that could end a turn
    // with no `result` frame never fires and only cancellation ends the run
    // (#139). Growth counts while a call is out; silence after it is silence.
    const poll = new ManualPoll();
    const child = new FakeManagedChild();
    (child as { stdout: AsyncIterable<Uint8Array> }).stdout = residentStdout([
      '{"event":"step_update","step_update":{"step_type":"text","text_delta":"done"}}\n',
    ]);
    let logBytes = 0;
    const onActivity = jest.fn();
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      drainGraceMs: 1,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
      setPoll: poll.set,
      clearPoll: poll.clear,
      logSize: async () => logBytes,
    });

    runner.start(
      { ...INVOCATION, cliCapabilities: { addDir: false, printTimeout: false, streamJson: true } },
      { onActivity },
    );
    // Let the text frame arrive, then ignore the activity it legitimately
    // reported: what follows is only the log growing on its own.
    await flush();
    onActivity.mockClear();

    logBytes += 4_096;
    await poll.fire();

    expect(onActivity).not.toHaveBeenCalled();
  });

  it('still calls a growing log a sign of life while a tool call is out', async () => {
    // The other half, and the reason the log is watched at all: a tool call can
    // keep both pipes quiet for minutes (#70). While its `ACTIVE` frame has no
    // `DONE`, growth is the only evidence the run is alive.
    const poll = new ManualPoll();
    const child = new FakeManagedChild();
    (child as { stdout: AsyncIterable<Uint8Array> }).stdout = residentStdout([
      '{"event":"step_update","step_update":{"step_type":"tool","state":"ACTIVE","step_index":1,'
        + '"tool_name":"run","tool_info":{"parameters":{}}}}\n',
    ]);
    let logBytes = 0;
    const onActivity = jest.fn();
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      drainGraceMs: 1,
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
      setPoll: poll.set,
      clearPoll: poll.clear,
      logSize: async () => logBytes,
    });

    runner.start(
      { ...INVOCATION, cliCapabilities: { addDir: false, printTimeout: false, streamJson: true } },
      { onActivity },
    );
    await flush();
    onActivity.mockClear();

    logBytes += 4_096;
    await poll.fire();

    expect(onActivity).toHaveBeenCalled();
  });

  it('recovers the Windows transcript only after a successful empty stdout', async () => {
    const child = new FakeManagedChild();
    const recoverTranscript = jest.fn().mockResolvedValue({
      output: 'transcript result',
      outputLimitExceeded: false,
    });
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      createLogPath: () => '/tmp/antigravity.log',
      recoverTranscript,
      removeLog: async () => undefined,
    });
    const handle = runner.start(INVOCATION);
    child.exit.resolve({ code: 0 });

    await expect(handle.completed).resolves.toMatchObject({
      exitCode: 0,
      stdout: '',
      transcriptOutput: 'transcript result',
    });
    expect(recoverTranscript).toHaveBeenCalledWith(
      '/tmp/antigravity.log',
      INVOCATION.environment,
      64_000,
    );
  });

  it('maps a real runner overflow through the backend to failed/output-limit', async () => {
    const child = new FakeManagedChild({ stdout: ['12345', '67890'] });
    const resultSink = { storeResult: jest.fn() };
    const backend = new AntigravityExecutionBackend({
      requestResolver: { resolve: async () => INVOCATION },
      processRunner: new AntigravityPrintProcessRunner({
        transport: new FakeTransport(child),
        outputByteLimit: 6,
        createLogPath: () => '/tmp/antigravity.log',
        removeLog: async () => undefined,
      }),
      resultSink,
      scheduler: new ImmediateScheduler(),
      sessionInstanceIdFactory: () => sessionInstanceId(`si-${'a'.repeat(32)}`),
      inactivityTimeoutMs: 1_000,
      gracefulTerminationMs: 1,
      forcedTerminationMs: 1,
    });
    const session = await backend.createSession({
      executionSessionId: executionSessionId(`es-${'b'.repeat(32)}`),
      owner: { kind: 'conversation', ownerId: 'runner-composition' },
      backendGeneration: 1,
    });
    const run = session.createRun({
      runId: runId(`run-${'c'.repeat(32)}`),
      owner: { kind: 'conversation', ownerId: 'runner-composition' },
      requestRef: 'opaque-request',
      resultExpectation: 'required',
    });

    const events = [];
    for await (const event of run.events) {
      events.push(event);
    }
    expect(events.at(-1)).toMatchObject({
      event: { kind: 'terminal', terminal: 'failed', reason: 'output-limit' },
    });
    expect(resultSink.storeResult).not.toHaveBeenCalled();
  });

  it('delegates complete-tree confirmation and termination to application infrastructure', async () => {
    const child = new FakeManagedChild();
    child.confirmed = false;
    const runner = new AntigravityPrintProcessRunner({
      transport: new FakeTransport(child),
      createLogPath: () => '/tmp/antigravity.log',
      removeLog: async () => undefined,
    });
    const handle = runner.start(INVOCATION);

    await expect(handle.confirmTerminated()).resolves.toBe(false);
    await expect(handle.terminate('graceful')).resolves.toBe('unconfirmed');
    await expect(handle.terminate('forced')).resolves.toBe('confirmed');
    expect(child.terminationModes).toEqual(['graceful', 'forced']);
  });
});

const INVOCATION: AntigravityInvocation = {
  command: process.platform === 'win32' ? 'C:\\agy.exe' : '/usr/local/bin/agy',
  cwd: '/vault',
  environment: { PATH: '/usr/local/bin' },
  model: 'Gemini 3.5 Flash (High)',
  permissionMode: 'full_access',
  prompt: 'hello && keep this as one argument',
};

class FakeTransport {
  readonly specs: AntigravityProcessTransportSpec[] = [];

  constructor(readonly child: AntigravityManagedChildProcess) {}

  launch(spec: AntigravityProcessTransportSpec): AntigravityManagedChildProcess {
    this.specs.push(spec);
    return this.child;
  }
}

class FakeManagedChild implements AntigravityManagedChildProcess {
  readonly started = Promise.resolve();
  readonly stdout: AsyncIterable<Uint8Array>;
  readonly stderr: AsyncIterable<Uint8Array>;
  readonly exited: Promise<{ readonly code: number | null; readonly signal?: string }>;
  readonly exit = deferred<{ readonly code: number | null; readonly signal?: string }>();
  readonly terminationModes: Array<'graceful' | 'forced'> = [];
  readonly stdinWrites: string[] = [];
  confirmed = true;

  async sendInput(text: string): Promise<void> {
    this.stdinWrites.push(text);
  }

  constructor(output: { readonly stdout?: string[]; readonly stderr?: string[] } = {}) {
    this.stdout = chunks(output.stdout ?? []);
    this.stderr = chunks(output.stderr ?? []);
    this.exited = this.exit.promise;
  }

  confirmTerminated(): Promise<boolean> {
    return Promise.resolve(this.confirmed);
  }

  terminate(mode: 'graceful' | 'forced'): Promise<'confirmed' | 'unconfirmed'> {
    this.terminationModes.push(mode);
    return Promise.resolve(mode === 'forced' ? 'confirmed' : 'unconfirmed');
  }
}

class ImmediateScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown {
    if (delayMs <= 1) {
      queueMicrotask(callback);
    }
    return callback;
  }

  clearTimeout(): void {}
}

function chunks(values: readonly string[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield Buffer.from(value, 'utf8');
      }
    },
  };
}

/**
 * Frames on a pipe that never closes, the way a resident CLI leaves stdout.
 *
 * Deliberately different from `chunks`: that helper ends its iteration, which
 * closes the stream and releases anything waiting on the drain. Nothing here
 * ever ends, so only the frames themselves can end the turn.
 */
function residentStdout(values: readonly string[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield Buffer.from(value, 'utf8');
      }
      await new Promise<never>(() => {});
    },
  };
}

/**
 * Fails loudly instead of hanging the suite: a run that never settles is the
 * defect under test, and jest's own timeout would report it as an unhelpful
 * whole-test expiry rather than as this assertion.
 */
function settledWithin<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`run did not settle within ${ms}ms`)), ms).unref?.();
    }),
  ]);
}

/** The liveness poll, driven by the test rather than by a clock. */
class ManualPoll {
  private callback: (() => void) | undefined;

  readonly set = (callback: () => void): unknown => {
    this.callback = callback;
    return 'poll';
  };

  readonly clear = (): void => {
    this.callback = undefined;
  };

  /** Runs one tick and lets the size read it awaits settle. */
  async fire(): Promise<void> {
    this.callback?.();
    await flush();
  }
}

/** Drains the microtask queue so awaited reads and frames land. */
async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}
