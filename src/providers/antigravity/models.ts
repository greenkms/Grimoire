export const ANTIGRAVITY_SYNTHETIC_MODEL_ID = 'antigravity';
export const ANTIGRAVITY_MODEL_PREFIX = 'antigravity:';
export const ANTIGRAVITY_DEFAULT_REASONING_LEVEL = 'default';

export function encodeAntigravityModelId(rawModelId: string): string {
  const normalized = rawModelId.trim();
  return normalized ? `${ANTIGRAVITY_MODEL_PREFIX}${normalized}` : ANTIGRAVITY_SYNTHETIC_MODEL_ID;
}

export function decodeAntigravityModelId(model: string): string | null {
  if (!model.startsWith(ANTIGRAVITY_MODEL_PREFIX)) {
    return model === ANTIGRAVITY_SYNTHETIC_MODEL_ID ? null : null;
  }

  const rawModelId = model.slice(ANTIGRAVITY_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function isAntigravityModelSelectionId(model: string): boolean {
  return model === ANTIGRAVITY_SYNTHETIC_MODEL_ID || model.startsWith(ANTIGRAVITY_MODEL_PREFIX);
}
