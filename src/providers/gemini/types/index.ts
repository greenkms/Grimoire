export interface GeminiProviderState {
  /**
   * Set when a saved session failed to load and no replacement was persisted.
   * Read back on the next load so a dropped session is not mistaken for a
   * conversation that never had one.
   */
  sessionDropped?: boolean;
  sessionId?: string;
}

export function getGeminiState(value: unknown): GeminiProviderState {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}
