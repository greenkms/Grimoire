export interface KimicodeProviderState {
  databasePath?: string;
}

export function getKimicodeState(
  providerState?: Record<string, unknown>,
): KimicodeProviderState {
  return (providerState ?? {});
}
