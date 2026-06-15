import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import {
  getHostnameKey,
  getLegacyHostnameKey,
  migrateLegacyHostnameKeyedMap,
} from '../../utils/env';
import {
  getMimocodeDiscoveryState,
  seedMimocodeDiscoveryStateFromLegacyConfig,
  updateMimocodeDiscoveryState,
} from './discoveryState';
import { ensureProviderProjectionMap } from './internal/providerProjection';
import {
  decodeMimocodeModelId,
  encodeMimocodeModelId,
  isMimocodeModelSelectionId,
  MIMOCODE_DEFAULT_THINKING_LEVEL,
  type MimocodeDiscoveredModel,
  type MimocodeThinkingOptionsByModel,
  normalizeMimocodeThinkingOptionsByModel,
  resolveMimocodeBaseModelRawId,
} from './models';
import {
  type MimocodeMode,
  normalizeManagedMimocodeSelectedMode,
} from './modes';

export interface PersistedMimocodeProviderSettings {
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  enabled: boolean;
  environmentHash: string;
  environmentVariables: string;
  modelAliases: Record<string, string>;
  preferredThinkingByModel: Record<string, string>;
  selectedMode: string;
  thinkingOptionsByModel: MimocodeThinkingOptionsByModel;
  visibleModels: string[];
}

export interface MimocodeProviderSettings extends PersistedMimocodeProviderSettings {
  availableModes: MimocodeMode[];
  discoveredModels: MimocodeDiscoveredModel[];
}

export const MIMOCODE_DEFAULT_ENVIRONMENT_VARIABLES = 'MIMOCODE_ENABLE_EXA=1';

export const DEFAULT_MIMOCODE_PROVIDER_SETTINGS: Readonly<PersistedMimocodeProviderSettings> = Object.freeze({
  cliPath: '',
  cliPathsByHost: {},
  enabled: false,
  environmentHash: '',
  environmentVariables: MIMOCODE_DEFAULT_ENVIRONMENT_VARIABLES,
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

export function normalizeMimocodeVisibleModels(
  value: unknown,
  discoveredModels: MimocodeDiscoveredModel[] = [],
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

    const trimmed = resolveMimocodeBaseModelRawId(entry.trim(), discoveredModels);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizeMimocodeModelAliases(
  value: unknown,
  discoveredModels: MimocodeDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [rawId, alias] of Object.entries(value as Record<string, unknown>)) {
    if (typeof alias !== 'string') {
      continue;
    }

    const normalizedRawId = resolveMimocodeBaseModelRawId(rawId.trim(), discoveredModels);
    const normalizedAlias = alias.trim();
    if (!normalizedRawId || !normalizedAlias) {
      continue;
    }

    normalized[normalizedRawId] = normalizedAlias;
  }

  return normalized;
}

export function normalizeMimocodePreferredThinkingByModel(
  value: unknown,
  discoveredModels: MimocodeDiscoveredModel[] = [],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [rawId, thinkingLevel] of Object.entries(value as Record<string, unknown>)) {
    if (typeof thinkingLevel !== 'string') {
      continue;
    }

    const normalizedRawId = resolveMimocodeBaseModelRawId(rawId.trim(), discoveredModels);
    const normalizedThinkingLevel = thinkingLevel.trim();
    if (!normalizedRawId || !normalizedThinkingLevel) {
      continue;
    }

    normalized[normalizedRawId] = normalizedThinkingLevel;
  }

  return normalized;
}

export function getMimocodeProviderSettings(
  settings: Record<string, unknown>,
): MimocodeProviderSettings {
  const config = getProviderConfig(settings, 'mimocode');
  const normalizedCliPathsByHost = normalizeHostnameCliPaths(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(normalizedCliPathsByHost).length > 0
    ? migrateLegacyHostnameKeyedMap(
      normalizedCliPathsByHost,
      getHostnameKey(),
      getLegacyHostnameKey(),
    )
    : normalizedCliPathsByHost;
  seedMimocodeDiscoveryStateFromLegacyConfig(settings, config);
  const discoveryState = getMimocodeDiscoveryState(settings);
  const availableModes = discoveryState.availableModes;
  const discoveredModels = discoveryState.discoveredModels;
  const persistedThinkingOptionsByModel = normalizeMimocodeThinkingOptionsByModel(
    config.thinkingOptionsByModel,
    discoveredModels,
  );
  const thinkingOptionsByModel = normalizeMimocodeThinkingOptionsByModel({
    ...persistedThinkingOptionsByModel,
    ...discoveryState.thinkingOptionsByModel,
  }, discoveredModels);

  return {
    availableModes,
    cliPath: (config.cliPath as string | undefined)
      ?? DEFAULT_MIMOCODE_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost,
    discoveredModels,
    enabled: (config.enabled as boolean | undefined)
      ?? DEFAULT_MIMOCODE_PROVIDER_SETTINGS.enabled,
    environmentHash: (config.environmentHash as string | undefined)
      ?? DEFAULT_MIMOCODE_PROVIDER_SETTINGS.environmentHash,
    environmentVariables: (config.environmentVariables as string | undefined)
      ?? getProviderEnvironmentVariables(settings, 'mimocode')
      ?? DEFAULT_MIMOCODE_PROVIDER_SETTINGS.environmentVariables,
    modelAliases: normalizeMimocodeModelAliases(config.modelAliases, discoveredModels),
    preferredThinkingByModel: normalizeMimocodePreferredThinkingByModel(
      config.preferredThinkingByModel,
      discoveredModels,
    ),
    selectedMode: normalizeManagedMimocodeSelectedMode(config.selectedMode, availableModes),
    thinkingOptionsByModel,
    visibleModels: normalizeMimocodeVisibleModels(config.visibleModels, discoveredModels),
  };
}

export function updateMimocodeProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<MimocodeProviderSettings>,
): MimocodeProviderSettings {
  const current = getMimocodeProviderSettings(settings);
  const hostnameKey = getHostnameKey();
  if ('availableModes' in updates || 'discoveredModels' in updates || 'thinkingOptionsByModel' in updates) {
    updateMimocodeDiscoveryState(settings, {
      ...(updates.availableModes !== undefined ? { availableModes: updates.availableModes } : {}),
      ...(updates.discoveredModels !== undefined ? { discoveredModels: updates.discoveredModels } : {}),
      ...(updates.thinkingOptionsByModel !== undefined
        ? { thinkingOptionsByModel: updates.thinkingOptionsByModel }
        : {}),
    });
  }
  const discoveryState = getMimocodeDiscoveryState(settings);
  const nextAvailableModes = discoveryState.availableModes;
  const nextDiscoveredModels = discoveryState.discoveredModels;
  const nextThinkingOptionsByModel = updates.thinkingOptionsByModel !== undefined
    ? discoveryState.thinkingOptionsByModel
    : normalizeMimocodeThinkingOptionsByModel(
      current.thinkingOptionsByModel,
      nextDiscoveredModels,
    );
  const nextSelectedMode = normalizeManagedMimocodeSelectedMode(
    updates.selectedMode ?? current.selectedMode,
    nextAvailableModes,
  );
  const nextVisibleModels = normalizeMimocodeVisibleModels(
    updates.visibleModels ?? current.visibleModels,
    nextDiscoveredModels,
  );
  const nextModelAliases = pruneModelAliasesToVisible(
    normalizeMimocodeModelAliases(
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
        : DEFAULT_MIMOCODE_PROVIDER_SETTINGS.cliPath
    )
    : current.cliPath.trim();

  if ('cliPath' in updates && !('cliPathsByHost' in updates)) {
    const trimmedCliPath = typeof updates.cliPath === 'string' ? updates.cliPath.trim() : '';
    if (trimmedCliPath) {
      nextCliPathsByHost[hostnameKey] = trimmedCliPath;
    } else {
      delete nextCliPathsByHost[hostnameKey];
    }
    nextCliPath = DEFAULT_MIMOCODE_PROVIDER_SETTINGS.cliPath;
  }

  const next: MimocodeProviderSettings = {
    ...current,
    ...updates,
    availableModes: nextAvailableModes,
    cliPath: nextCliPath,
    cliPathsByHost: nextCliPathsByHost,
    discoveredModels: nextDiscoveredModels,
    modelAliases: nextModelAliases,
    preferredThinkingByModel: normalizeMimocodePreferredThinkingByModel(
      updates.preferredThinkingByModel ?? current.preferredThinkingByModel,
      nextDiscoveredModels,
    ),
    selectedMode: nextSelectedMode,
    thinkingOptionsByModel: nextThinkingOptionsByModel,
    visibleModels: nextVisibleModels,
  };

  if (updates.visibleModels !== undefined) {
    retargetRemovedMimocodeSelections(settings, next);
  }

  const persistedThinkingOptionsByModel = pruneThinkingOptionsToPersistedSelections(
    settings,
    next,
  );

  setProviderConfig(settings, 'mimocode', {
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

export function hasLegacyMimocodeDiscoveryFields(settings: Record<string, unknown>): boolean {
  const config = getProviderConfig(settings, 'mimocode');
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
  next: MimocodeProviderSettings,
): MimocodeThinkingOptionsByModel {
  const persistableRawIds = new Set(next.visibleModels);
  addPersistableSelection(persistableRawIds, settings.model, next.discoveredModels);
  addPersistableSelection(persistableRawIds, settings.titleGenerationModel, next.discoveredModels);

  const savedProviderModel = settings.savedProviderModel;
  if (savedProviderModel && typeof savedProviderModel === 'object' && !Array.isArray(savedProviderModel)) {
    addPersistableSelection(
      persistableRawIds,
      (savedProviderModel as Record<string, unknown>).mimocode,
      next.discoveredModels,
    );
  }

  const pruned: MimocodeThinkingOptionsByModel = {};
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
  discoveredModels: MimocodeDiscoveredModel[],
): void {
  if (typeof value !== 'string' || !isMimocodeModelSelectionId(value)) {
    return;
  }

  const rawModelId = decodeMimocodeModelId(value);
  if (!rawModelId) {
    return;
  }

  const baseRawId = resolveMimocodeBaseModelRawId(rawModelId, discoveredModels);
  if (baseRawId) {
    target.add(baseRawId);
  }
}

function retargetRemovedMimocodeSelections(
  settings: Record<string, unknown>,
  next: MimocodeProviderSettings,
): void {
  if (next.visibleModels.length === 0) {
    if (
      typeof settings.titleGenerationModel === 'string'
      && isMimocodeModelSelectionId(settings.titleGenerationModel)
    ) {
      settings.titleGenerationModel = '';
    }
    return;
  }

  const visibleSet = new Set(next.visibleModels);
  const fallbackRawId = next.visibleModels[0];
  const fallbackModelId = encodeMimocodeModelId(fallbackRawId);
  const fallbackEffort = next.preferredThinkingByModel[fallbackRawId] ?? MIMOCODE_DEFAULT_THINKING_LEVEL;

  const maybeRetargetModel = (value: unknown): string | null => {
    if (typeof value !== 'string' || !isMimocodeModelSelectionId(value)) {
      return null;
    }

    const rawModelId = decodeMimocodeModelId(value);
    if (!rawModelId) {
      return fallbackModelId;
    }

    const baseRawId = resolveMimocodeBaseModelRawId(rawModelId, next.discoveredModels);
    return visibleSet.has(baseRawId) ? null : fallbackModelId;
  };

  const savedProviderModel = ensureProviderProjectionMap(settings, 'savedProviderModel');
  const nextSavedModel = maybeRetargetModel(savedProviderModel.mimocode);
  if (nextSavedModel) {
    savedProviderModel.mimocode = nextSavedModel;
    ensureProviderProjectionMap(settings, 'savedProviderEffort').mimocode = fallbackEffort;
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
