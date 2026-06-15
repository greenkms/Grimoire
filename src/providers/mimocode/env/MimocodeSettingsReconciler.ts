import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import { clearMimocodeDiscoveryState } from '../discoveryState';
import { sameStringList, sameStringMap } from '../internal/compareCollections';
import { ensureProviderProjectionMap } from '../internal/providerProjection';
import {
  decodeMimocodeModelId,
  encodeMimocodeModelId,
  extractMimocodeModelVariantValue,
  isMimocodeModelSelectionId,
  MIMOCODE_DEFAULT_THINKING_LEVEL,
  resolveMimocodeBaseModelRawId,
} from '../models';
import {
  getMimocodeProviderSettings,
  hasLegacyMimocodeDiscoveryFields,
  normalizeMimocodePreferredThinkingByModel,
  normalizeMimocodeVisibleModels,
  updateMimocodeProviderSettings,
} from '../settings';
import { getMimocodeState } from '../types';

interface NormalizedSelection {
  baseModelId: string | null;
  variant: string | null;
}

const MIMOCODE_ENV_HASH_KEYS = [
  'MIMOCODE_CONFIG',
  'MIMOCODE_DB',
  'MIMOCODE_DISABLE_PROJECT_CONFIG',
  'XDG_DATA_HOME',
] as const;

function computeMimocodeEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return MIMOCODE_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const mimocodeSettingsReconciler: ProviderSettingsReconciler = {
  handleEnvironmentChange(settings: Record<string, unknown>): boolean {
    return clearMimocodeDiscoveryState(settings);
  },

  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, 'mimocode');
    const currentHash = computeMimocodeEnvHash(envText);
    const savedHash = getMimocodeProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations: Conversation[] = [];
    for (const conversation of conversations) {
      if (conversation.providerId !== 'mimocode') {
        continue;
      }

      const state = getMimocodeState(conversation.providerState);
      if (!conversation.sessionId && !state.databasePath) {
        continue;
      }

      conversation.sessionId = null;
      conversation.providerState = undefined;
      invalidatedConversations.push(conversation);
    }

    updateMimocodeProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    const hadLegacyDiscoveryFields = hasLegacyMimocodeDiscoveryFields(settings);
    if (hadLegacyDiscoveryFields) {
      updateMimocodeProviderSettings(settings, {});
    }

    const mimocodeSettings = getMimocodeProviderSettings(settings);
    let changed = hadLegacyDiscoveryFields;

    const normalizeSelection = (value: unknown): NormalizedSelection => {
      if (typeof value !== 'string' || !isMimocodeModelSelectionId(value)) {
        return { baseModelId: null, variant: null };
      }

      const rawModelId = decodeMimocodeModelId(value);
      if (!rawModelId) {
        return { baseModelId: value, variant: null };
      }

      const baseRawId = resolveMimocodeBaseModelRawId(rawModelId, mimocodeSettings.discoveredModels);
      return {
        baseModelId: encodeMimocodeModelId(baseRawId),
        variant: extractMimocodeModelVariantValue(rawModelId, mimocodeSettings.discoveredModels),
      };
    };

    const modelSelection = normalizeSelection(settings.model);
    if (typeof settings.model === 'string' && modelSelection.baseModelId && settings.model !== modelSelection.baseModelId) {
      settings.model = modelSelection.baseModelId;
      changed = true;
    }
    if (
      modelSelection.variant
      && (typeof settings.effortLevel !== 'string' || settings.effortLevel.trim().length === 0)
    ) {
      settings.effortLevel = modelSelection.variant;
      changed = true;
    }

    const titleModelSelection = normalizeSelection(settings.titleGenerationModel);
    if (
      typeof settings.titleGenerationModel === 'string'
      && titleModelSelection.baseModelId
      && settings.titleGenerationModel !== titleModelSelection.baseModelId
    ) {
      settings.titleGenerationModel = titleModelSelection.baseModelId;
      changed = true;
    }

    const savedProviderModelRaw = settings.savedProviderModel;
    if (savedProviderModelRaw && typeof savedProviderModelRaw === 'object' && !Array.isArray(savedProviderModelRaw)) {
      const savedProviderModel = savedProviderModelRaw as Record<string, unknown>;
      const savedSelection = normalizeSelection(savedProviderModel.mimocode);
      if (
        typeof savedProviderModel.mimocode === 'string'
        && savedSelection.baseModelId
        && savedProviderModel.mimocode !== savedSelection.baseModelId
      ) {
        savedProviderModel.mimocode = savedSelection.baseModelId;
        changed = true;
      }
      if (savedSelection.variant) {
        const savedEffort = ensureProviderProjectionMap(settings, 'savedProviderEffort');
        if (typeof savedEffort.mimocode !== 'string') {
          savedEffort.mimocode = savedSelection.variant;
          changed = true;
        }
      }
    }

    const normalizedVisibleModels = normalizeMimocodeVisibleModels(
      mimocodeSettings.visibleModels,
      mimocodeSettings.discoveredModels,
    );
    const normalizedPreferredThinking = normalizeMimocodePreferredThinkingByModel(
      mimocodeSettings.preferredThinkingByModel,
      mimocodeSettings.discoveredModels,
    );
    const shouldUpdateProviderSettings = !sameStringList(normalizedVisibleModels, mimocodeSettings.visibleModels)
      || !sameStringMap(normalizedPreferredThinking, mimocodeSettings.preferredThinkingByModel);
    if (shouldUpdateProviderSettings) {
      updateMimocodeProviderSettings(settings, {
        preferredThinkingByModel: normalizedPreferredThinking,
        visibleModels: normalizedVisibleModels,
      });
      changed = true;
    }

    if (typeof settings.effortLevel === 'string' && !settings.effortLevel.trim()) {
      settings.effortLevel = MIMOCODE_DEFAULT_THINKING_LEVEL;
      changed = true;
    }

    return changed;
  },
};
