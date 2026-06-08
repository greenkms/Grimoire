export const GEMINI_SYNTHETIC_MODEL_ID = 'gemini';
export const GEMINI_MODEL_PREFIX = 'gemini:';
export const GEMINI_DEFAULT_THINKING_LEVEL = 'default';

export function encodeGeminiModelId(rawModelId: string): string {
  const normalized = rawModelId.trim();
  return normalized ? `${GEMINI_MODEL_PREFIX}${normalized}` : GEMINI_SYNTHETIC_MODEL_ID;
}

export function decodeGeminiModelId(model: string): string | null {
  if (!model.startsWith(GEMINI_MODEL_PREFIX)) {
    return model === GEMINI_SYNTHETIC_MODEL_ID ? null : null;
  }

  const rawModelId = model.slice(GEMINI_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function isGeminiModelSelectionId(model: string): boolean {
  return model === GEMINI_SYNTHETIC_MODEL_ID || model.startsWith(GEMINI_MODEL_PREFIX);
}
