import type { AcpSessionModelState } from '../../acp';

type GrokAcpModelRecord = {
  description?: unknown;
  id?: unknown;
  modelId?: unknown;
  name?: unknown;
};

export function normalizeGrokAcpSessionModels(
  models: AcpSessionModelState | null | undefined,
): AcpSessionModelState | null {
  if (!models) {
    return null;
  }

  const rawModels = Array.isArray(models.availableModels)
    ? models.availableModels as GrokAcpModelRecord[]
    : [];
  const availableModels = rawModels.flatMap((model) => {
    const id = readNonEmptyString(model.id) ?? readNonEmptyString(model.modelId);
    if (!id) {
      return [];
    }

    const description = readNonEmptyString(model.description);
    return [{
      ...(description ? { description } : {}),
      id,
      name: readNonEmptyString(model.name) ?? id,
    }];
  });
  const currentModelId = readNonEmptyString(models.currentModelId)
    ?? availableModels[0]?.id
    ?? '';

  return {
    availableModels,
    currentModelId,
  };
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}
