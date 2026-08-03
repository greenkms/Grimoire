import type { Conversation } from '../types';

/** Returns provider-owned state without exposing provider-specific fields to features. */
export function getOpaqueProviderState(
  conversation: Pick<Conversation, 'providerState'> | null | undefined,
): Record<string, unknown> | undefined {
  return conversation?.providerState;
}
