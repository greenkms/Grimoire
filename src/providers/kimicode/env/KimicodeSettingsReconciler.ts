import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import { clearKimicodeDiscoveryState } from '../discoveryState';
import { sameStringList, sameStringMap } from '../internal/compareCollections';
import { ensureProviderProjectionMap } from '../internal/providerProjection';
import {
  decodeKimicodeModelId,
  encodeKimicodeModelId,
  extractKimicodeModelVariantValue,
  isKimicodeModelSelectionId,
  KIMICODE_DEFAULT_THINKING_LEVEL,
  resolveKimicodeBaseModelRawId,
} from '../models';
import {
  getKimicodeProviderSettings,
  hasLegacyKimicodeDiscoveryFields,
  normalizeKimicodePreferredThinkingByModel,
  normalizeKimicodeVisibleModels,
  updateKimicodeProviderSettings,
} from '../settings';
import { getKimicodeState } from '../types';

interface NormalizedSelection {
  baseModelId: string | null;
  variant: string | null;
}

const KIMICODE_ENV_HASH_KEYS = [
  'KIMICODE_CONFIG',
  'KIMICODE_DB',
  'KIMICODE_DISABLE_PROJECT_CONFIG',
  'XDG_DATA_HOME',
] as const;

function computeKimicodeEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return KIMICODE_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const kimicodeSettingsReconciler: ProviderSettingsReconciler = {
  handleEnvironmentChange(settings: Record<string, unknown>): boolean {
    return clearKimicodeDiscoveryState(settings);
  },

  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, 'kimicode');
    const currentHash = computeKimicodeEnvHash(envText);
    const savedHash = getKimicodeProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations: Conversation[] = [];
    for (const conversation of conversations) {
      if (conversation.providerId !== 'kimicode') {
        continue;
      }

      const state = getKimicodeState(conversation.providerState);
      if (!conversation.sessionId && !state.databasePath) {
        continue;
      }

      conversation.sessionId = null;
      conversation.providerState = undefined;
      invalidatedConversations.push(conversation);
    }

    updateKimicodeProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    const hadLegacyDiscoveryFields = hasLegacyKimicodeDiscoveryFields(settings);
    if (hadLegacyDiscoveryFields) {
      updateKimicodeProviderSettings(settings, {});
    }

    const kimicodeSettings = getKimicodeProviderSettings(settings);
    let changed = hadLegacyDiscoveryFields;

    const normalizeSelection = (value: unknown): NormalizedSelection => {
      if (typeof value !== 'string' || !isKimicodeModelSelectionId(value)) {
        return { baseModelId: null, variant: null };
      }

      const rawModelId = decodeKimicodeModelId(value);
      if (!rawModelId) {
        return { baseModelId: value, variant: null };
      }

      const baseRawId = resolveKimicodeBaseModelRawId(rawModelId, kimicodeSettings.discoveredModels);
      return {
        baseModelId: encodeKimicodeModelId(baseRawId),
        variant: extractKimicodeModelVariantValue(rawModelId, kimicodeSettings.discoveredModels),
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
      const savedSelection = normalizeSelection(savedProviderModel.kimicode);
      if (
        typeof savedProviderModel.kimicode === 'string'
        && savedSelection.baseModelId
        && savedProviderModel.kimicode !== savedSelection.baseModelId
      ) {
        savedProviderModel.kimicode = savedSelection.baseModelId;
        changed = true;
      }
      if (savedSelection.variant) {
        const savedEffort = ensureProviderProjectionMap(settings, 'savedProviderEffort');
        if (typeof savedEffort.kimicode !== 'string') {
          savedEffort.kimicode = savedSelection.variant;
          changed = true;
        }
      }
    }

    const normalizedVisibleModels = normalizeKimicodeVisibleModels(
      kimicodeSettings.visibleModels,
      kimicodeSettings.discoveredModels,
    );
    const normalizedPreferredThinking = normalizeKimicodePreferredThinkingByModel(
      kimicodeSettings.preferredThinkingByModel,
      kimicodeSettings.discoveredModels,
    );
    const shouldUpdateProviderSettings = !sameStringList(normalizedVisibleModels, kimicodeSettings.visibleModels)
      || !sameStringMap(normalizedPreferredThinking, kimicodeSettings.preferredThinkingByModel);
    if (shouldUpdateProviderSettings) {
      updateKimicodeProviderSettings(settings, {
        preferredThinkingByModel: normalizedPreferredThinking,
        visibleModels: normalizedVisibleModels,
      });
      changed = true;
    }

    if (typeof settings.effortLevel === 'string' && !settings.effortLevel.trim()) {
      settings.effortLevel = KIMICODE_DEFAULT_THINKING_LEVEL;
      changed = true;
    }

    return changed;
  },
};
