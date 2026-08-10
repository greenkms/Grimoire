import { JsonRpcErrorResponse } from './AcpJsonRpcTransport';

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

const MISSING_SESSION_REASON_PATTERN = /^(?:invalid[_ -]?session(?:[_ -]?id)?|missing[_ -]?session|session[_ -]?(?:missing|not[_ -]?found|unknown))$/i;
const MISSING_SESSION_MESSAGE_PATTERNS = [
  /\bsession\b.{0,80}\b(?:does not exist|missing|not found|unknown)\b/i,
  /\b(?:missing|no|unknown)\b.{0,40}\bsession\b/i,
  /\bcould not find\b.{0,40}\bsession\b/i,
  /\binvalid session(?: id)?\b/i,
];

/**
 * Return true only when session/load explicitly reports that the persisted
 * session no longer exists. Transport, authentication, and configuration
 * failures must propagate without invalidating the saved binding.
 */
export function isAcpMissingSessionError(error: unknown): boolean {
  if (!(error instanceof JsonRpcErrorResponse)) {
    return false;
  }
  if (error.method !== 'session/load' && error.method !== 'loadSession') {
    return false;
  }

  return collectDiagnosticStrings(error.message, error.data).some((value) => {
    const normalized = value.trim();
    return MISSING_SESSION_REASON_PATTERN.test(normalized)
      || MISSING_SESSION_MESSAGE_PATTERNS.some(pattern => pattern.test(normalized));
  });
}

function collectDiagnosticStrings(...values: unknown[]): string[] {
  const result: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (typeof value === 'string') {
      result.push(value);
      return;
    }
    if (depth >= 3 || value === null || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 20)) visit(entry, depth + 1);
      return;
    }
    for (const entry of Object.values(value as Record<string, unknown>).slice(0, 20)) {
      visit(entry, depth + 1);
    }
  };

  for (const value of values) visit(value, 0);
  return result;
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
