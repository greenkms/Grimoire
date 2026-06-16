import type { AcpSessionModelState } from '../../acp';

type GrokAcpModelRecord = {
  description?: string | null;
  id?: string;
  modelId?: string;
  name: string;
};

export function normalizeGrokAcpSessionModels(
  models: AcpSessionModelState | null | undefined,
): AcpSessionModelState | null {
  if (!models) {
    return null;
  }

  const availableModels = (models.availableModels as GrokAcpModelRecord[])
    .map((model) => ({
      ...(model.description ? { description: model.description } : {}),
      id: (model.id ?? model.modelId ?? '').trim(),
      name: model.name,
    }))
    .filter((model) => model.id.length > 0);

  return {
    availableModels,
    currentModelId: models.currentModelId,
  };
}