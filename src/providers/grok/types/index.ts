export interface GrokProviderState {
  databasePath?: string;
}

export function getGrokState(
  providerState?: Record<string, unknown>,
): GrokProviderState {
  return (providerState ?? {});
}
