import type { AcpSessionModelState } from '../../acp';
import { type GrokThinkingOptionsByModel, normalizeGrokModelVariants } from '../models';

type GrokAcpModelRecord = {
  _meta?: unknown;
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

/**
 * Grok Build states, per available model, which reasoning levels that model
 * accepts - `session/new` and `session/load` both carry it in each model's
 * `_meta`, and for every model rather than only the current one. The
 * `thought_level` config option speaks for the active model alone, so without
 * this the picker has to guess from the model id for every other model, and a
 * guess is wrong whenever two native models differ: grok-4.6 takes `xhigh`
 * while grok-4.5 offers only high/medium/low. Reading the levels the agent
 * reports keeps the picker exact and lets a future model arrive with its own
 * set without a code change.
 */
export function readGrokAcpModelThinkingOptions(
  models: AcpSessionModelState | null | undefined,
): GrokThinkingOptionsByModel {
  const rawModels = Array.isArray(models?.availableModels)
    ? models.availableModels as GrokAcpModelRecord[]
    : [];

  const optionsByModel: GrokThinkingOptionsByModel = {};
  for (const model of rawModels) {
    const rawId = readNonEmptyString(model.id) ?? readNonEmptyString(model.modelId);
    const meta = model._meta;
    if (!rawId || !meta || typeof meta !== 'object' || Array.isArray(meta)) {
      continue;
    }

    const variants = normalizeGrokModelVariants((meta as Record<string, unknown>).reasoningEfforts);
    if (variants.length > 0) {
      optionsByModel[rawId] = variants;
    }
  }

  return optionsByModel;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}
