export interface MimocodeProviderState {
  databasePath?: string;
}

export function getMimocodeState(
  providerState?: Record<string, unknown>,
): MimocodeProviderState {
  return (providerState ?? {});
}
