export const QWEN_SYNTHETIC_MODEL_ID = 'qwen';
export const QWEN_MODEL_PREFIX = 'qwen:';

export function encodeQwenModelId(rawModelId: string): string {
  const normalized = rawModelId.trim();
  return normalized ? `${QWEN_MODEL_PREFIX}${normalized}` : QWEN_SYNTHETIC_MODEL_ID;
}

export function decodeQwenModelId(model: string): string | null {
  if (!model.startsWith(QWEN_MODEL_PREFIX)) {
    return null;
  }

  const rawModelId = model.slice(QWEN_MODEL_PREFIX.length).trim();
  return rawModelId || null;
}

export function isQwenModelSelectionId(model: string): boolean {
  return model === QWEN_SYNTHETIC_MODEL_ID || model.startsWith(QWEN_MODEL_PREFIX);
}
