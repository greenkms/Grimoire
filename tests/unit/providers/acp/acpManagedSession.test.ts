import { JsonRpcTransportClosedError } from '@/providers/acp/AcpJsonRpcTransport';
import {
  bindAcpManagedSession,
  isAcpRetryableTransportClose,
  planAcpEnsureReadySessionPhase,
  runAcpEnsureReadyForQuery,
  shouldRetryAcpClosedTransport,
} from '@/providers/acp/acpManagedSession';

describe('acpManagedSession', () => {
  describe('planAcpEnsureReadySessionPhase', () => {
    it('loads a saved session that is not yet bound', () => {
      expect(planAcpEnsureReadySessionPhase({
        allowSessionCreation: true,
        loadedSessionId: null,
        sessionId: 'session-1',
        sessionInvalidated: false,
        targetSessionId: 'session-1',
      })).toEqual({ type: 'load', sessionId: 'session-1' });
    });

    it('is a noop when the target session is already loaded', () => {
      expect(planAcpEnsureReadySessionPhase({
        allowSessionCreation: true,
        loadedSessionId: 'session-1',
        sessionId: 'session-1',
        sessionInvalidated: false,
        targetSessionId: 'session-1',
      })).toEqual({ type: 'noop' });
    });

    it('creates a session when none exists and creation is allowed', () => {
      expect(planAcpEnsureReadySessionPhase({
        allowSessionCreation: true,
        loadedSessionId: null,
        sessionId: null,
        sessionInvalidated: false,
        targetSessionId: null,
      })).toEqual({ type: 'create' });
    });

    it('skips create when creation is disabled or the session was invalidated', () => {
      expect(planAcpEnsureReadySessionPhase({
        allowSessionCreation: false,
        loadedSessionId: null,
        sessionId: null,
        sessionInvalidated: false,
        targetSessionId: null,
      })).toEqual({ type: 'noop' });

      expect(planAcpEnsureReadySessionPhase({
        allowSessionCreation: true,
        loadedSessionId: null,
        sessionId: null,
        sessionInvalidated: true,
        targetSessionId: null,
      })).toEqual({ type: 'noop' });
    });
  });

  it('binds session ids after a successful new/load', () => {
    const state = {
      loadedSessionId: null as string | null,
      sessionId: null as string | null,
      sessionInvalidated: true,
    };
    bindAcpManagedSession(state, 'session-9');
    expect(state).toEqual({
      loadedSessionId: 'session-9',
      sessionId: 'session-9',
      sessionInvalidated: false,
    });
  });

  it('detects retryable transport close errors', () => {
    expect(isAcpRetryableTransportClose(new JsonRpcTransportClosedError())).toBe(true);
    const named = new Error('closed');
    named.name = 'JsonRpcTransportClosedError';
    expect(isAcpRetryableTransportClose(named)).toBe(true);
    expect(isAcpRetryableTransportClose(new Error('other'))).toBe(false);
  });

  it('retries closed transport only before output and on a live lifecycle', () => {
    expect(shouldRetryAcpClosedTransport({
      activeLifecycleGeneration: 2,
      error: new JsonRpcTransportClosedError(),
      runtimeLifecycleGeneration: 2,
      sawOutput: false,
    })).toBe(true);

    expect(shouldRetryAcpClosedTransport({
      activeLifecycleGeneration: 1,
      error: new JsonRpcTransportClosedError(),
      runtimeLifecycleGeneration: 2,
      sawOutput: false,
    })).toBe(false);

    expect(shouldRetryAcpClosedTransport({
      activeLifecycleGeneration: 2,
      error: new JsonRpcTransportClosedError(),
      runtimeLifecycleGeneration: 2,
      sawOutput: true,
    })).toBe(false);
  });

  it('runAcpEnsureReadyForQuery retries once on transport close', async () => {
    const ensureReady = jest.fn()
      .mockRejectedValueOnce(new JsonRpcTransportClosedError())
      .mockResolvedValueOnce(true);

    await expect(runAcpEnsureReadyForQuery({
      ensureReady,
      isLifecycleCurrent: () => true,
      lifecycleGeneration: 1,
    })).resolves.toEqual({ ready: true, stale: false });

    expect(ensureReady).toHaveBeenNthCalledWith(1);
    expect(ensureReady).toHaveBeenNthCalledWith(2, { force: true });
  });

  it('runAcpEnsureReadyForQuery treats lifecycle churn as stale', async () => {
    let generation = 1;
    const ensureReady = jest.fn().mockImplementation(async () => {
      generation = 2;
      return true;
    });

    await expect(runAcpEnsureReadyForQuery({
      ensureReady,
      isLifecycleCurrent: (expected) => expected === generation,
      lifecycleGeneration: 1,
    })).resolves.toEqual({ ready: false, stale: true });
  });
});
