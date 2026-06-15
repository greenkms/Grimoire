import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { GROK_PROVIDER_ICON } from '../../../shared/icons';
import {
  buildGrokBaseModels,
  decodeGrokModelId,
  encodeGrokModelId,
  GROK_DEFAULT_THINKING_LEVEL,
  GROK_SYNTHETIC_MODEL_ID,
  isGrokModelSelectionId,
  resolveGrokBaseModelRawId,
} from '../models';
import {
  resolveGrokModeForPermissionMode,
  resolvePermissionModeForManagedGrokMode,
} from '../modes';
import { GrokChatRuntime } from '../runtime/GrokChatRuntime';
import { getGrokProviderSettings, updateGrokProviderSettings } from '../settings';

const GROK_MODELS: ProviderUIOption[] = [
  { value: GROK_SYNTHETIC_MODEL_ID, label: 'Grok Build', description: 'ACP runtime' },
];
const GROK_FALLBACK_THINKING_OPTIONS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const GROK_FALLBACK_THINKING_DEFAULT = 'high';
const DEFAULT_CONTEXT_WINDOW = 200_000;
const GROK_METADATA_WARMUP_DB = ':memory:';
const GROK_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Safe',
  activeValue: 'full_access',
  activeLabel: 'Auto-approve',
  planValue: 'plan',
  planLabel: 'Plan',
};

export const grokChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings): ProviderUIOption[] {
    const grokSettings = getGrokProviderSettings(settings);
    const applyAlias = (rawId: string, option: ProviderUIOption): ProviderUIOption => {
      const alias = grokSettings.modelAliases[rawId];
      return alias ? { ...option, label: alias } : option;
    };
    const discoveredModels = new Map(buildGrokBaseModels(grokSettings.discoveredModels).map((model) => [
      encodeGrokModelId(model.rawId),
      applyAlias(model.rawId, {
        description: model.description ?? 'ACP runtime',
        label: model.label,
        value: encodeGrokModelId(model.rawId),
      }),
    ]));
    const savedProviderModel = (
      settings.savedProviderModel
      && typeof settings.savedProviderModel === 'object'
      && !Array.isArray(settings.savedProviderModel)
    )
      ? settings.savedProviderModel as Record<string, unknown>
      : null;

    const seenValues = new Set<string>();
    const options: ProviderUIOption[] = [];
    for (const rawModelId of grokSettings.visibleModels) {
      const encodedModelId = encodeGrokModelId(rawModelId);
      pushOption(
        options,
        seenValues,
        encodedModelId,
        discoveredModels.get(encodedModelId)
          ?? applyAlias(rawModelId, {
            description: 'Configured model',
            label: rawModelId,
            value: encodedModelId,
          }),
      );
    }

    const selectedModelValues = [
      typeof settings.model === 'string' ? settings.model : '',
      typeof savedProviderModel?.grok === 'string'
        ? savedProviderModel.grok
        : '',
    ];

    for (const model of selectedModelValues) {
      const rawModelId = decodeGrokModelId(model);
      if (
        !model
        || !isGrokModelSelectionId(model)
        || model === GROK_SYNTHETIC_MODEL_ID
        || !rawModelId
      ) {
        continue;
      }

      const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
      const baseModelId = encodeGrokModelId(baseRawId);
      pushOption(
        options,
        seenValues,
        baseModelId,
        discoveredModels.get(baseModelId)
          ?? applyAlias(baseRawId, {
            description: 'Selected in an existing session',
            label: baseRawId,
            value: baseModelId,
          }),
      );
    }

    return options.length > 0 ? options : [...GROK_MODELS];
  },

  ownsModel(model: string): boolean {
    return isGrokModelSelectionId(model);
  },

  isAdaptiveReasoningModel(model: string, settings: Record<string, unknown>): boolean {
    return getGrokThinkingOptions(model, settings).length > 0;
  },

  getReasoningOptions(model: string, settings: Record<string, unknown>): ProviderReasoningOption[] {
    return getGrokThinkingOptions(model, settings)
      .map((variant) => ({
        description: variant.description,
        label: variant.label,
        value: variant.value,
      }));
  },

  getDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
    const rawModelId = decodeGrokModelId(model);
    if (!rawModelId) {
      return GROK_FALLBACK_THINKING_DEFAULT;
    }

    const grokSettings = getGrokProviderSettings(settings);
    const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
    return getDefaultThinkingLevelForModel(baseRawId, settings);
  },

  getContextWindowSize(model: string, customLimits?: Record<string, number>): number {
    return customLimits?.[model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return isGrokModelSelectionId(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const rawModelId = decodeGrokModelId(model);
    if (!rawModelId) {
      settingsBag.effortLevel = GROK_FALLBACK_THINKING_DEFAULT;
      return;
    }

    const grokSettings = getGrokProviderSettings(settingsBag);
    const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
    settingsBag.model = encodeGrokModelId(baseRawId);
    settingsBag.effortLevel = getDefaultThinkingLevelForModel(baseRawId, settingsBag);
  },

  async prepareModelMetadata(model: string, _settings: Record<string, unknown>, context): Promise<void> {
    const rawModelId = decodeGrokModelId(model);
    if (!rawModelId) {
      return;
    }

    const grokSettings = getGrokProviderSettings(context.plugin.settings);
    const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
    if (baseRawId && grokSettings.thinkingOptionsByModel[baseRawId]) {
      return;
    }

    const runtime = new GrokChatRuntime(context.plugin);
    try {
      runtime.syncConversationState({
        providerState: { databasePath: GROK_METADATA_WARMUP_DB },
        sessionId: null,
      });
      await runtime.warmModelMetadata(model);
    } catch {
      // Metadata warmup is opportunistic; the first real turn can still discover it.
    } finally {
      runtime.cleanup();
    }
  },

  applyReasoningSelection(model: string, value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const rawModelId = decodeGrokModelId(model);
    if (!rawModelId) {
      return;
    }

    const grokSettings = getGrokProviderSettings(settingsBag);
    const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
    const supportedValues = new Set(getSupportedThinkingOptionsForModel(baseRawId, settingsBag)
      .map((variant) => variant.value));
    const nextPreferredThinkingByModel = {
      ...grokSettings.preferredThinkingByModel,
    };

    if (!value || value === GROK_DEFAULT_THINKING_LEVEL || !supportedValues.has(value)) {
      delete nextPreferredThinkingByModel[baseRawId];
    } else {
      nextPreferredThinkingByModel[baseRawId] = value;
    }

    updateGrokProviderSettings(settingsBag, {
      preferredThinkingByModel: nextPreferredThinkingByModel,
    });
  },

  normalizeModelVariant(model: string, settings: Record<string, unknown>): string {
    const rawModelId = decodeGrokModelId(model);
    if (!rawModelId) {
      return model;
    }

    const grokSettings = getGrokProviderSettings(settings);
    const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
    return encodeGrokModelId(baseRawId);
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getModeSelector(): null {
    return null;
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return GROK_PERMISSION_MODE_TOGGLE;
  },

  resolvePermissionMode(settings: Record<string, unknown>): string | null {
    const selectedMode = getGrokProviderSettings(settings).selectedMode;
    return resolvePermissionModeForManagedGrokMode(selectedMode);
  },

  applyPermissionMode(value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    settingsBag.permissionMode = value;
    updateGrokProviderSettings(settingsBag, {
      selectedMode: resolveGrokModeForPermissionMode(
        value,
        getGrokProviderSettings(settingsBag).availableModes,
      ),
    });
  },

  getProviderIcon() {
    return GROK_PROVIDER_ICON;
  },
};

function getDefaultThinkingLevelForModel(
  baseRawId: string,
  settings: Record<string, unknown>,
): string {
  const grokSettings = getGrokProviderSettings(settings);
  const preferred = grokSettings.preferredThinkingByModel[baseRawId];
  const options = getSupportedThinkingOptionsForModel(baseRawId, settings);
  const supportedValues = new Set(options.map((variant) => variant.value));
  if (preferred && supportedValues.has(preferred)) {
    return preferred;
  }

  return (supportedValues.has(GROK_FALLBACK_THINKING_DEFAULT)
    ? GROK_FALLBACK_THINKING_DEFAULT
    : options[0]?.value)
    ?? GROK_DEFAULT_THINKING_LEVEL;
}

function getSupportedThinkingOptionsForModel(
  baseRawId: string,
  settings: Record<string, unknown>,
): ProviderReasoningOption[] {
  const grokSettings = getGrokProviderSettings(settings);
  const discoveredOptions = grokSettings.thinkingOptionsByModel[baseRawId] ?? [];
  return discoveredOptions.length > 0
    ? discoveredOptions
    : GROK_FALLBACK_THINKING_OPTIONS;
}

function getGrokThinkingOptions(
  model: string,
  settings: Record<string, unknown>,
): ProviderReasoningOption[] {
  if (!isGrokModelSelectionId(model)) {
    return [];
  }

  const rawModelId = decodeGrokModelId(model);
  if (!rawModelId) {
    return GROK_FALLBACK_THINKING_OPTIONS;
  }

  const grokSettings = getGrokProviderSettings(settings);
  const baseRawId = resolveGrokBaseModelRawId(rawModelId, grokSettings.discoveredModels);
  return getSupportedThinkingOptionsForModel(baseRawId, settings);
}

function pushOption(
  target: ProviderUIOption[],
  seenValues: Set<string>,
  value: string,
  option: ProviderUIOption,
): void {
  if (seenValues.has(value)) {
    return;
  }

  seenValues.add(value);
  target.push(option);
}
