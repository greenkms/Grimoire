import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import {
  getHostnameKey,
  getLegacyHostnameKey,
  migrateLegacyHostnameKeyedMap,
} from '../../utils/env';
import {
  getKimicodeDiscoveryState,
  seedKimicodeDiscoveryStateFromLegacyConfig,
  updateKimicodeDiscoveryState,
} from './discoveryState';
import { ensureProviderProjectionMap } from './internal/providerProjection';
import {
  decodeKimicodeModelId,
  encodeKimicodeModelId,
  isKimicodeModelSelectionId,
  KIMICODE_DEFAULT_THINKING_LEVEL,
  type KimicodeDiscoveredModel,
  type KimicodeThinkingOptionsByModel,
  normalizeKimicodeThinkingOptionsByModel,
  resolveKimicodeBaseModelRawId,
} from './models';
import {
  type KimicodeMode,
  normalizeManagedKimicodeSelectedMode,
} from './modes';

export interface PersistedKimicodeProviderSettings {
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  enabled: boolean;
  environmentHash: string;
  environmentVariables: string;
  modelAliases: Record<string, string>;
  preferredThinkingByModel: Record<string, string>;
  selectedMode: string;
  thinkingOptionsByModel: KimicodeThinkingOptionsByModel;
  visibleModels: string[];
}

export interface KimicodeProviderSettings extends PersistedKimicodeProviderSettings {
  availableModes: KimicodeMode[];
  discoveredModels: KimicodeDiscoveredModel[];
}

export const KIMICODE_DEFAULT_ENVIRONMENT_VARIABLES = 'KIMICODE_ENABLE_EXA=1';

export const DEFAULT_KIMICODE_PROVIDER_SETTINGS: Readonly<PersistedKimicodeProviderSettings> = Object.freeze({
  cliPath: '',
  cliPathsByHost: {},
  enabled: false,
  environmentHash: '',
  environmentVariables: KIMICODE_DEFAULT_ENVIRONMENT_VARIABLES,
  modelAliases: {},
  preferredThinkingByModel: {},
  selectedMode: '',
  thinkingOptionsByModel: {},
  visibleModels: [],
});

function normalizeHostnameCliPaths(value: unknown): HostnameCliPaths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: HostnameCliPaths = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) {
      result[key] = entry.trim();
    }
  }
  return result;
}

export function normalizeKimicodeVisibleModels(
  value: unknown,
  discoveredModels: KimicodeDiscoveredModel[] = [],
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = resolveKimicodeBaseModelRawId(entry.trim(), discoveredModels);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizeKimicodeModelAliases(
  value: unknown,
  discoveredModels: KimicodeDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [rawId, alias] of Object.entries(value as Record<string, unknown>)) {
    if (typeof alias !== 'string') {
      continue;
    }

    const normalizedRawId = resolveKimicodeBaseModelRawId(rawId.trim(), discoveredModels);
    const normalizedAlias = alias.trim();
    if (!normalizedRawId || !normalizedAlias) {
      continue;
    }

    normalized[normalizedRawId] = normalizedAlias;
  }

  return normalized;
}

export function normalizeKimicodePreferredThinkingByModel(
  value: unknown,
  discoveredModels: KimicodeDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [rawId, thinkingLevel] of Object.entries(value as Record<string, unknown>)) {
    if (typeof thinkingLevel !== 'string') {
      continue;
    }

    const normalizedRawId = resolveKimicodeBaseModelRawId(rawId.trim(), discoveredModels);
    const normalizedThinkingLevel = thinkingLevel.trim();
    if (!normalizedRawId || !normalizedThinkingLevel) {
      continue;
    }

    normalized[normalizedRawId] = normalizedThinkingLevel;
  }

  return normalized;
}

export function getKimicodeProviderSettings(
  settings: Record<string, unknown>,
): KimicodeProviderSettings {
  const config = getProviderConfig(settings, 'kimicode');
  const normalizedCliPathsByHost = normalizeHostnameCliPaths(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(normalizedCliPathsByHost).length > 0
    ? migrateLegacyHostnameKeyedMap(
      normalizedCliPathsByHost,
      getHostnameKey(),
      getLegacyHostnameKey(),
    )
    : normalizedCliPathsByHost;
  seedKimicodeDiscoveryStateFromLegacyConfig(settings, config);
  const discoveryState = getKimicodeDiscoveryState(settings);
  const availableModes = discoveryState.availableModes;
  const discoveredModels = discoveryState.discoveredModels;
  const persistedThinkingOptionsByModel = normalizeKimicodeThinkingOptionsByModel(
    config.thinkingOptionsByModel,
    discoveredModels,
  );
  const thinkingOptionsByModel = normalizeKimicodeThinkingOptionsByModel({
    ...persistedThinkingOptionsByModel,
    ...discoveryState.thinkingOptionsByModel,
  }, discoveredModels);

  return {
    availableModes,
    cliPath: (config.cliPath as string | undefined)
      ?? DEFAULT_KIMICODE_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost,
    discoveredModels,
    enabled: (config.enabled as boolean | undefined)
      ?? DEFAULT_KIMICODE_PROVIDER_SETTINGS.enabled,
    environmentHash: (config.environmentHash as string | undefined)
      ?? DEFAULT_KIMICODE_PROVIDER_SETTINGS.environmentHash,
    environmentVariables: (config.environmentVariables as string | undefined)
      ?? getProviderEnvironmentVariables(settings, 'kimicode')
      ?? DEFAULT_KIMICODE_PROVIDER_SETTINGS.environmentVariables,
    modelAliases: normalizeKimicodeModelAliases(config.modelAliases, discoveredModels),
    preferredThinkingByModel: normalizeKimicodePreferredThinkingByModel(
      config.preferredThinkingByModel,
      discoveredModels,
    ),
    selectedMode: normalizeManagedKimicodeSelectedMode(config.selectedMode, availableModes),
    thinkingOptionsByModel,
    visibleModels: normalizeKimicodeVisibleModels(config.visibleModels, discoveredModels),
  };
}

export function updateKimicodeProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<KimicodeProviderSettings>,
): KimicodeProviderSettings {
  const current = getKimicodeProviderSettings(settings);
  const hostnameKey = getHostnameKey();
  if ('availableModes' in updates || 'discoveredModels' in updates || 'thinkingOptionsByModel' in updates) {
    updateKimicodeDiscoveryState(settings, {
      ...(updates.availableModes !== undefined ? { availableModes: updates.availableModes } : {}),
      ...(updates.discoveredModels !== undefined ? { discoveredModels: updates.discoveredModels } : {}),
      ...(updates.thinkingOptionsByModel !== undefined
        ? { thinkingOptionsByModel: updates.thinkingOptionsByModel }
        : {}),
    });
  }
  const discoveryState = getKimicodeDiscoveryState(settings);
  const nextAvailableModes = discoveryState.availableModes;
  const nextDiscoveredModels = discoveryState.discoveredModels;
  const nextThinkingOptionsByModel = updates.thinkingOptionsByModel !== undefined
    ? discoveryState.thinkingOptionsByModel
    : normalizeKimicodeThinkingOptionsByModel(
      current.thinkingOptionsByModel,
      nextDiscoveredModels,
    );
  const nextSelectedMode = normalizeManagedKimicodeSelectedMode(
    updates.selectedMode ?? current.selectedMode,
    nextAvailableModes,
  );
  const nextVisibleModels = normalizeKimicodeVisibleModels(
    updates.visibleModels ?? current.visibleModels,
    nextDiscoveredModels,
  );
  const nextModelAliases = pruneModelAliasesToVisible(
    normalizeKimicodeModelAliases(
      updates.modelAliases ?? current.modelAliases,
      nextDiscoveredModels,
    ),
    nextVisibleModels,
  );
  const nextCliPathsByHost = 'cliPathsByHost' in updates
    ? normalizeHostnameCliPaths(updates.cliPathsByHost)
    : { ...current.cliPathsByHost };
  let nextCliPath = 'cliPathsByHost' in updates
    ? (
      typeof updates.cliPath === 'string'
        ? updates.cliPath.trim()
        : DEFAULT_KIMICODE_PROVIDER_SETTINGS.cliPath
    )
    : current.cliPath.trim();

  if ('cliPath' in updates && !('cliPathsByHost' in updates)) {
    const trimmedCliPath = typeof updates.cliPath === 'string' ? updates.cliPath.trim() : '';
    if (trimmedCliPath) {
      nextCliPathsByHost[hostnameKey] = trimmedCliPath;
    } else {
      delete nextCliPathsByHost[hostnameKey];
    }
    nextCliPath = DEFAULT_KIMICODE_PROVIDER_SETTINGS.cliPath;
  }

  const next: KimicodeProviderSettings = {
    ...current,
    ...updates,
    availableModes: nextAvailableModes,
    cliPath: nextCliPath,
    cliPathsByHost: nextCliPathsByHost,
    discoveredModels: nextDiscoveredModels,
    modelAliases: nextModelAliases,
    preferredThinkingByModel: normalizeKimicodePreferredThinkingByModel(
      updates.preferredThinkingByModel ?? current.preferredThinkingByModel,
      nextDiscoveredModels,
    ),
    selectedMode: nextSelectedMode,
    thinkingOptionsByModel: nextThinkingOptionsByModel,
    visibleModels: nextVisibleModels,
  };

  if (updates.visibleModels !== undefined) {
    retargetRemovedKimicodeSelections(settings, next);
  }

  const persistedThinkingOptionsByModel = pruneThinkingOptionsToPersistedSelections(
    settings,
    next,
  );

  setProviderConfig(settings, 'kimicode', {
    cliPath: next.cliPath,
    cliPathsByHost: next.cliPathsByHost,
    enabled: next.enabled,
    environmentHash: next.environmentHash,
    environmentVariables: next.environmentVariables,
    modelAliases: next.modelAliases,
    preferredThinkingByModel: next.preferredThinkingByModel,
    selectedMode: next.selectedMode,
    thinkingOptionsByModel: persistedThinkingOptionsByModel,
    visibleModels: next.visibleModels,
  });

  return next;
}

export function hasLegacyKimicodeDiscoveryFields(settings: Record<string, unknown>): boolean {
  const config = getProviderConfig(settings, 'kimicode');
  return 'availableModes' in config || 'discoveredModels' in config;
}

function pruneModelAliasesToVisible(
  aliases: Record<string, string>,
  visibleModels: string[],
): Record<string, string> {
  if (visibleModels.length === 0 || Object.keys(aliases).length === 0) {
    return {};
  }

  const visibleSet = new Set(visibleModels);
  const pruned: Record<string, string> = {};
  for (const [rawId, alias] of Object.entries(aliases)) {
    if (visibleSet.has(rawId)) {
      pruned[rawId] = alias;
    }
  }
  return pruned;
}

function pruneThinkingOptionsToPersistedSelections(
  settings: Record<string, unknown>,
  next: KimicodeProviderSettings,
): KimicodeThinkingOptionsByModel {
  const persistableRawIds = new Set(next.visibleModels);
  addPersistableSelection(persistableRawIds, settings.model, next.discoveredModels);
  addPersistableSelection(persistableRawIds, settings.titleGenerationModel, next.discoveredModels);

  const savedProviderModel = settings.savedProviderModel;
  if (savedProviderModel && typeof savedProviderModel === 'object' && !Array.isArray(savedProviderModel)) {
    addPersistableSelection(
      persistableRawIds,
      (savedProviderModel as Record<string, unknown>).kimicode,
      next.discoveredModels,
    );
  }

  const pruned: KimicodeThinkingOptionsByModel = {};
  for (const rawId of persistableRawIds) {
    const options = next.thinkingOptionsByModel[rawId];
    if (options?.length) {
      pruned[rawId] = options.map((option) => ({ ...option }));
    }
  }
  return pruned;
}

function addPersistableSelection(
  target: Set<string>,
  value: unknown,
  discoveredModels: KimicodeDiscoveredModel[],
): void {
  if (typeof value !== 'string' || !isKimicodeModelSelectionId(value)) {
    return;
  }

  const rawModelId = decodeKimicodeModelId(value);
  if (!rawModelId) {
    return;
  }

  const baseRawId = resolveKimicodeBaseModelRawId(rawModelId, discoveredModels);
  if (baseRawId) {
    target.add(baseRawId);
  }
}

function retargetRemovedKimicodeSelections(
  settings: Record<string, unknown>,
  next: KimicodeProviderSettings,
): void {
  if (next.visibleModels.length === 0) {
    if (
      typeof settings.titleGenerationModel === 'string'
      && isKimicodeModelSelectionId(settings.titleGenerationModel)
    ) {
      settings.titleGenerationModel = '';
    }
    return;
  }

  const visibleSet = new Set(next.visibleModels);
  const fallbackRawId = next.visibleModels[0];
  const fallbackModelId = encodeKimicodeModelId(fallbackRawId);
  const fallbackEffort = next.preferredThinkingByModel[fallbackRawId] ?? KIMICODE_DEFAULT_THINKING_LEVEL;

  const maybeRetargetModel = (value: unknown): string | null => {
    if (typeof value !== 'string' || !isKimicodeModelSelectionId(value)) {
      return null;
    }

    const rawModelId = decodeKimicodeModelId(value);
    if (!rawModelId) {
      return fallbackModelId;
    }

    const baseRawId = resolveKimicodeBaseModelRawId(rawModelId, next.discoveredModels);
    return visibleSet.has(baseRawId) ? null : fallbackModelId;
  };

  const savedProviderModel = ensureProviderProjectionMap(settings, 'savedProviderModel');
  const nextSavedModel = maybeRetargetModel(savedProviderModel.kimicode);
  if (nextSavedModel) {
    savedProviderModel.kimicode = nextSavedModel;
    ensureProviderProjectionMap(settings, 'savedProviderEffort').kimicode = fallbackEffort;
  }

  const nextTopLevelModel = maybeRetargetModel(settings.model);
  if (nextTopLevelModel) {
    settings.model = nextTopLevelModel;
    settings.effortLevel = fallbackEffort;
  }

  const nextTitleGenerationModel = maybeRetargetModel(settings.titleGenerationModel);
  if (nextTitleGenerationModel) {
    settings.titleGenerationModel = nextTitleGenerationModel;
  }
}
