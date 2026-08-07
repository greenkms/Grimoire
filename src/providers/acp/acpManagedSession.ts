/**
 * Shared session attach / ensureReady phase helpers for ACP managed CLIs.
 *
 * Provider runtimes still own process launch, config options, and tool
 * normalization; this module standardizes the load-vs-create decision tree and
 * transport-close retry gates so OpenCode-family clones do not drift.
 */

import { JsonRpcTransportClosedError } from './AcpJsonRpcTransport';

export interface AcpManagedSessionBinding {
  loadedSessionId: string | null;
  sessionId: string | null;
  sessionInvalidated: boolean;
}

export interface AcpEnsureReadySessionPhaseInput {
  allowSessionCreation: boolean;
  loadedSessionId: string | null;
  sessionId: string | null;
  sessionInvalidated: boolean;
  targetSessionId: string | null;
}

export type AcpEnsureReadySessionPhaseAction =
  | { type: 'noop' }
  | { type: 'load'; sessionId: string }
  | { type: 'create' };

/**
 * Decide the next ACP session step after the process/transport is ready.
 *
 * - Saved target session → load when not already loaded.
 * - No session and not invalidated → create (unless creation is disabled).
 * - Invalidated with no live session → wait for the next query bootstrap.
 */
export function planAcpEnsureReadySessionPhase(
  input: AcpEnsureReadySessionPhaseInput,
): AcpEnsureReadySessionPhaseAction {
  if (input.targetSessionId) {
    if (input.loadedSessionId !== input.targetSessionId) {
      return { type: 'load', sessionId: input.targetSessionId };
    }
    return { type: 'noop' };
  }

  if (!input.sessionId && !input.sessionInvalidated) {
    if (input.allowSessionCreation === false) {
      return { type: 'noop' };
    }
    return { type: 'create' };
  }

  return { type: 'noop' };
}

/** Bind runtime state after a successful session/new or session/load. */
export function bindAcpManagedSession(
  state: AcpManagedSessionBinding,
  sessionId: string,
): void {
  state.sessionInvalidated = false;
  state.loadedSessionId = sessionId;
  state.sessionId = sessionId;
}

export function isAcpRetryableTransportClose(error: unknown): boolean {
  return error instanceof JsonRpcTransportClosedError
    || (error instanceof Error && error.name === 'JsonRpcTransportClosedError');
}

export interface AcpClosedTransportRetryGateInput {
  activeLifecycleGeneration: number;
  error: unknown;
  runtimeLifecycleGeneration: number;
  sawOutput: boolean;
}

/**
 * Whether a closed-transport error should trigger a one-shot reconnect before
 * the user sees a hard failure. Skips retries after partial output or when the
 * runtime was torn down mid-turn.
 */
export function shouldRetryAcpClosedTransport(
  input: AcpClosedTransportRetryGateInput,
): boolean {
  if (input.activeLifecycleGeneration !== input.runtimeLifecycleGeneration) {
    return false;
  }
  if (input.sawOutput) {
    return false;
  }
  return isAcpRetryableTransportClose(input.error);
}

export interface AcpEnsureReadyForQueryResult {
  ready: boolean;
  stale: boolean;
}

/**
 * ensureReady wrapper used by query(): retry once on transport-close errors,
 * and treat lifecycle generation changes as cancellation.
 */
export async function runAcpEnsureReadyForQuery(params: {
  ensureReady: (options?: { force?: boolean }) => Promise<boolean>;
  isRetryableTransportClose?: (error: unknown) => boolean;
  lifecycleGeneration: number;
  isLifecycleCurrent: (generation: number) => boolean;
}): Promise<AcpEnsureReadyForQueryResult> {
  const isRetryable = params.isRetryableTransportClose ?? isAcpRetryableTransportClose;

  try {
    const ready = await params.ensureReady();
    if (!params.isLifecycleCurrent(params.lifecycleGeneration)) {
      return { ready: false, stale: true };
    }
    return { ready, stale: false };
  } catch (error) {
    if (!params.isLifecycleCurrent(params.lifecycleGeneration)) {
      return { ready: false, stale: true };
    }
    if (!isRetryable(error)) {
      throw error;
    }
  }

  try {
    const ready = await params.ensureReady({ force: true });
    if (!params.isLifecycleCurrent(params.lifecycleGeneration)) {
      return { ready: false, stale: true };
    }
    return { ready, stale: false };
  } catch (error) {
    if (
      !params.isLifecycleCurrent(params.lifecycleGeneration)
      || isRetryable(error)
    ) {
      return { ready: false, stale: true };
    }
    throw error;
  }
}
