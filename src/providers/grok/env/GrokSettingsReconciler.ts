import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import { clearGrokDiscoveryState } from '../discoveryState';
import { sameStringList, sameStringMap } from '../internal/compareCollections';
import { ensureProviderProjectionMap } from '../internal/providerProjection';
import {
  decodeGrokModelId,
  encodeGrokModelId,
  extractGrokModelVariantValue,
  GROK_DEFAULT_THINKING_LEVEL,
  isGrokModelSelectionId,
  resolveGrokBaseModelRawId,
} from '../models';
import {
  getGrokProviderSettings,
  hasLegacyGrokDiscoveryFields,
  normalizeGrokPreferredThinkingByModel,
  normalizeGrokVisibleModels,
  updateGrokProviderSettings,
} from '../settings';
import { getGrokState } from '../types';

interface NormalizedSelection {
  baseModelId: string | null;
  variant: string | null;
}

const GROK_ENV_HASH_KEYS = [
  'GROK_HOME',
  'XAI_API_KEY',
] as const;

function computeGrokEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return GROK_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const grokSettingsReconciler: ProviderSettingsReconciler = {
  handleEnvironmentChange(settings: Record<string, unknown>): boolean {
    return clearGrokDiscoveryState(settings);
  },

  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, 'grok');
    const currentHash = computeGrokEnvHash(envText);
    const savedHash = getGrokProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations: Conversation[] = [];
    for (const conversation of conversations) {
      if (conversation.providerId !== 'grok') {
        continue;
      }

      const state = getGrokState(conversation.providerState);
      if (!conversation.sessionId && !state.sessionDirPath && !state.workspacePath) {
        continue;
      }

      conversation.sessionId = null;
      conversation.providerState = undefined;
      invalidatedConversations.push(conversation);
    }

    updateGrokProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    const hadLegacyDiscoveryFields = hasLegacyGrokDiscoveryFields(settings);
    if (hadLegacyDiscoveryFields) {
      updateGrokProviderSettings(settings, {});
    }

    const grokSettings = getGrokProviderSettings(settings);
    let changed = hadLegacyDiscoveryFields;

    const normalizeSelection = (value: unknown): NormalizedSelection => {
      if (typeof value !== 'string' || !isGrokModelSelectionId(value)) {
        return { baseModelId: null, variant: null };
      }

      const rawModelId = decodeGrokModelId(value);
      if (!rawModelId) {
        return { baseModelId: value, variant: null };
      }

      const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
      return {
        baseModelId: encodeGrokModelId(baseRawId),
        variant: extractGrokModelVariantValue(rawModelId, grokSettings.discoveredModels),
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
      const savedSelection = normalizeSelection(savedProviderModel.grok);
      if (
        typeof savedProviderModel.grok === 'string'
        && savedSelection.baseModelId
        && savedProviderModel.grok !== savedSelection.baseModelId
      ) {
        savedProviderModel.grok = savedSelection.baseModelId;
        changed = true;
      }
      if (savedSelection.variant) {
        const savedEffort = ensureProviderProjectionMap(settings, 'savedProviderEffort');
        if (typeof savedEffort.grok !== 'string') {
          savedEffort.grok = savedSelection.variant;
          changed = true;
        }
      }
    }

    const normalizedVisibleModels = normalizeGrokVisibleModels(
      grokSettings.visibleModels,
      grokSettings.discoveredModels,
    );
    const normalizedPreferredThinking = normalizeGrokPreferredThinkingByModel(
      grokSettings.preferredThinkingByModel,
      grokSettings.discoveredModels,
    );
    const shouldUpdateProviderSettings = !sameStringList(normalizedVisibleModels, grokSettings.visibleModels)
      || !sameStringMap(normalizedPreferredThinking, grokSettings.preferredThinkingByModel);
    if (shouldUpdateProviderSettings) {
      updateGrokProviderSettings(settings, {
        preferredThinkingByModel: normalizedPreferredThinking,
        visibleModels: normalizedVisibleModels,
      });
      changed = true;
    }

    if (typeof settings.effortLevel === 'string' && !settings.effortLevel.trim()) {
      settings.effortLevel = GROK_DEFAULT_THINKING_LEVEL;
      changed = true;
    }

    return changed;
  },
};
