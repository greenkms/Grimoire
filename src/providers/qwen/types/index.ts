export interface QwenProviderState {
  sessionId?: string;
}

export function getQwenState(value: unknown): QwenProviderState {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}
