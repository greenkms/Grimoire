export interface GrokProviderState {
  sessionDirPath?: string;
  workspacePath?: string;
}

export function getGrokState(
  providerState?: Record<string, unknown>,
): GrokProviderState {
  if (!providerState || typeof providerState !== 'object') {
    return {};
  }

  const state: GrokProviderState = {};
  if (typeof providerState.sessionDirPath === 'string' && providerState.sessionDirPath.trim()) {
    state.sessionDirPath = providerState.sessionDirPath.trim();
  }
  if (typeof providerState.workspacePath === 'string' && providerState.workspacePath.trim()) {
    state.workspacePath = providerState.workspacePath.trim();
  }
  return state;
}