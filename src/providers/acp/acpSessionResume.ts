/**
 * Shared helpers for ACP managed-CLI session resume.
 *
 * OpenCode-family providers (and Grok) persist `sessionId` + optional
 * `databasePath` in conversation meta. When `session/load` fails we must not
 * throw away the database path (history hydrate / OPENCODE_DB still need it)
 * and should surface a clear diagnostic rather than silently wiping state.
 */

export interface AcpSessionClearOptions {
  /** When true, keep the last known native DB path after a failed resume. */
  preserveDatabasePath?: boolean;
}

export interface AcpSessionRuntimeState {
  currentDatabasePath: string | null;
  loadedSessionId: string | null;
  sessionId: string | null;
  sessionInvalidated: boolean;
}

export interface AcpSessionLoadFailureContext {
  cwd?: string;
  databasePath?: string | null;
  error?: unknown;
  providerId: string;
  sessionId: string;
  stderr?: string;
}

export interface AcpPersistedSessionUpdateInput {
  conversationDatabasePath?: string | null;
  currentDatabasePath?: string | null;
  sessionId: string | null;
  sessionInvalidated: boolean;
}

/**
 * Clear in-memory ACP session bindings after a failed load or explicit reset.
 * Optionally retain `currentDatabasePath` so history hydrate and CLI env still
 * point at the native store.
 */
export function clearAcpManagedSessionState(
  state: AcpSessionRuntimeState,
  options: AcpSessionClearOptions = {},
): void {
  if (!options.preserveDatabasePath) {
    state.currentDatabasePath = null;
  }
  state.sessionId = null;
  state.loadedSessionId = null;
}

/**
 * Mark a saved session as unloadable and clear the active binding while
 * preserving the native database path for history and relaunch.
 */
export function markAcpSessionLoadFailed(
  state: AcpSessionRuntimeState,
): void {
  state.sessionInvalidated = true;
  clearAcpManagedSessionState(state, { preserveDatabasePath: true });
}

/**
 * Build conversation persistence fields after a turn/session change.
 *
 * On invalidation without a replacement session id we clear `sessionId` so the
 * next send creates a fresh ACP session, but we keep `databasePath` so SQLite
 * hydrate and OPENCODE_DB / equivalent env still resolve.
 */
export function buildAcpPersistedSessionFields(
  input: AcpPersistedSessionUpdateInput,
): {
  databasePath?: string;
  sessionId: string | null;
} {
  const databasePath = input.currentDatabasePath
    ?? input.conversationDatabasePath
    ?? null;

  if (input.sessionInvalidated && !input.sessionId) {
    return {
      ...(databasePath ? { databasePath } : {}),
      sessionId: null,
    };
  }

  return {
    ...(databasePath ? { databasePath } : {}),
    sessionId: input.sessionId,
  };
}

export function buildAcpSessionLoadFailureDebugEvent(
  context: AcpSessionLoadFailureContext,
): {
  data: Record<string, unknown>;
  error?: unknown;
  event: string;
  level: 'warn';
  scope: string;
} {
  const errorMessage = context.error instanceof Error
    ? context.error.message
    : context.error === undefined || context.error === null
      ? undefined
      : typeof context.error === 'string'
        ? context.error
        : undefined;

  return {
    data: {
      ...(context.cwd ? { cwdLabel: context.cwd } : {}),
      ...(context.databasePath ? { pathEntryCount: 1 } : {}),
      ...(errorMessage ? { errorSummary: errorMessage } : {}),
      provider: context.providerId,
      reason: 'session_load_failed',
      ...(context.stderr ? { stderrPreview: context.stderr.slice(0, 500) } : {}),
      // session ids are opaque provider tokens; keep short for diagnostics.
      status: context.sessionId.slice(0, 12),
    },
    error: context.error,
    event: 'session.load_failed',
    level: 'warn',
    scope: `provider.${context.providerId}`,
  };
}
