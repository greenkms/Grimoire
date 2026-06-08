export interface GeminiProviderState {
  sessionId?: string;
}

export function getGeminiState(value: unknown): GeminiProviderState {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as GeminiProviderState
    : {};
}
