import { JsonRpcErrorResponse } from '@/providers/acp/AcpJsonRpcTransport';
import {
  buildAcpPersistedSessionFields,
  buildAcpSessionLoadFailureDebugEvent,
  clearAcpManagedSessionState,
  isAcpMissingSessionError,
  markAcpSessionLoadFailed,
} from '@/providers/acp/acpSessionResume';

describe('acpSessionResume', () => {
  it('clears session bindings while optionally preserving the database path', () => {
    const state = {
      currentDatabasePath: '/data/opencode.db',
      loadedSessionId: 'loaded-1',
      sessionId: 'session-1',
      sessionInvalidated: false,
    };

    clearAcpManagedSessionState(state, { preserveDatabasePath: true });
    expect(state).toEqual({
      currentDatabasePath: '/data/opencode.db',
      loadedSessionId: null,
      sessionId: null,
      sessionInvalidated: false,
    });

    clearAcpManagedSessionState(state);
    expect(state.currentDatabasePath).toBeNull();
  });

  it('marks a failed load as invalidated without dropping the database path', () => {
    const state = {
      currentDatabasePath: '/data/opencode.db',
      loadedSessionId: 'loaded-1',
      sessionId: 'session-1',
      sessionInvalidated: false,
    };

    markAcpSessionLoadFailed(state);
    expect(state.sessionInvalidated).toBe(true);
    expect(state.sessionId).toBeNull();
    expect(state.currentDatabasePath).toBe('/data/opencode.db');
  });

  it('keeps databasePath when persisting an invalidated session without a replacement id', () => {
    expect(buildAcpPersistedSessionFields({
      conversationDatabasePath: '/old/opencode.db',
      currentDatabasePath: null,
      sessionId: null,
      sessionInvalidated: true,
    })).toEqual({
      databasePath: '/old/opencode.db',
      sessionId: null,
    });

    expect(buildAcpPersistedSessionFields({
      conversationDatabasePath: '/old/opencode.db',
      currentDatabasePath: '/new/opencode.db',
      sessionId: 'session-2',
      sessionInvalidated: false,
    })).toEqual({
      databasePath: '/new/opencode.db',
      sessionId: 'session-2',
    });
  });

  it('builds a structured debug event for session load failures', () => {
    const event = buildAcpSessionLoadFailureDebugEvent({
      cwd: '/vault',
      databasePath: '/data/opencode.db',
      error: new Error('session missing'),
      providerId: 'opencode',
      sessionId: 'abcdefghijklmno',
      stderr: 'boom',
    });

    expect(event.event).toBe('session.load_failed');
    expect(event.level).toBe('warn');
    expect(event.scope).toBe('provider.opencode');
    expect(event.data).toEqual(expect.objectContaining({
      cwdLabel: '/vault',
      errorSummary: 'session missing',
      provider: 'opencode',
      reason: 'session_load_failed',
      status: 'abcdefghijkl',
      stderrPreview: 'boom',
    }));
  });

  it.each([
    new JsonRpcErrorResponse('session/load', -32001, 'Session not found: session-1'),
    new JsonRpcErrorResponse('loadSession', -32000, 'Unable to load session', {
      reason: 'session_not_found',
    }),
    new JsonRpcErrorResponse('session/load', -32602, 'Invalid session id'),
  ])('recognizes explicit missing-session JSON-RPC errors', (error) => {
    expect(isAcpMissingSessionError(error)).toBe(true);
  });

  it.each([
    new JsonRpcErrorResponse('session/load', -32000, 'Authentication failed'),
    new JsonRpcErrorResponse('session/load', -32000, 'Connection timed out'),
    new JsonRpcErrorResponse('session/new', -32001, 'Session not found'),
    new Error('Session not found'),
  ])('does not classify transient or unrelated failures as missing sessions', (error) => {
    expect(isAcpMissingSessionError(error)).toBe(false);
  });
});
