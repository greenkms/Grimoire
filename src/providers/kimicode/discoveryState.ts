import { sameDiscoveredModels, sameModes, sameThinkingOptionsByModel } from './internal/compareCollections';
import {
  type KimicodeDiscoveredModel,
  type KimicodeThinkingOptionsByModel,
  normalizeKimicodeDiscoveredModels,
  normalizeKimicodeThinkingOptionsByModel,
} from './models';
import {
  type KimicodeMode,
  normalizeKimicodeAvailableModes,
} from './modes';

const KIMICODE_DISCOVERY_STATE = Symbol('kimicodeDiscoveryState');

interface KimicodeDiscoveryState {
  availableModes: KimicodeMode[];
  discoveredModels: KimicodeDiscoveredModel[];
  thinkingOptionsByModel: KimicodeThinkingOptionsByModel;
}

type SettingsBag = Record<string | symbol, unknown>;

function ensureDiscoveryState(settings: Record<string, unknown>): KimicodeDiscoveryState {
  const bag = settings as SettingsBag;
  const existing = bag[KIMICODE_DISCOVERY_STATE];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const state = existing as Partial<KimicodeDiscoveryState>;
    state.availableModes ??= [];
    state.discoveredModels ??= [];
    state.thinkingOptionsByModel ??= {};
    return state as KimicodeDiscoveryState;
  }

  const next: KimicodeDiscoveryState = {
    availableModes: [],
    discoveredModels: [],
    thinkingOptionsByModel: {},
  };
  Object.defineProperty(bag, KIMICODE_DISCOVERY_STATE, {
    configurable: true,
    enumerable: false,
    value: next,
    writable: true,
  });
  return next;
}

function cloneModes(modes: KimicodeMode[]): KimicodeMode[] {
  return modes.map((mode) => ({ ...mode }));
}

function cloneDiscoveredModels(models: KimicodeDiscoveredModel[]): KimicodeDiscoveredModel[] {
  return models.map((model) => ({ ...model }));
}

function cloneThinkingOptionsByModel(
  optionsByModel: KimicodeThinkingOptionsByModel,
): KimicodeThinkingOptionsByModel {
  return Object.fromEntries(
    Object.entries(optionsByModel).map(([rawId, options]) => [
      rawId,
      options.map((option) => ({ ...option })),
    ]),
  );
}

export function getKimicodeDiscoveryState(settings: Record<string, unknown>): KimicodeDiscoveryState {
  const state = ensureDiscoveryState(settings);
  return {
    availableModes: cloneModes(state.availableModes),
    discoveredModels: cloneDiscoveredModels(state.discoveredModels),
    thinkingOptionsByModel: cloneThinkingOptionsByModel(state.thinkingOptionsByModel),
  };
}

export function updateKimicodeDiscoveryState(
  settings: Record<string, unknown>,
  updates: Partial<KimicodeDiscoveryState>,
): boolean {
  const state = ensureDiscoveryState(settings);
  const nextAvailableModes = 'availableModes' in updates
    ? normalizeKimicodeAvailableModes(updates.availableModes)
    : state.availableModes;
  const nextDiscoveredModels = 'discoveredModels' in updates
    ? normalizeKimicodeDiscoveredModels(updates.discoveredModels)
    : state.discoveredModels;
  const nextThinkingOptionsByModel = 'thinkingOptionsByModel' in updates
    ? normalizeKimicodeThinkingOptionsByModel(updates.thinkingOptionsByModel, nextDiscoveredModels)
    : state.thinkingOptionsByModel;
  const changed = !sameModes(state.availableModes, nextAvailableModes)
    || !sameDiscoveredModels(state.discoveredModels, nextDiscoveredModels)
    || !sameThinkingOptionsByModel(state.thinkingOptionsByModel, nextThinkingOptionsByModel);

  if (!changed) {
    return false;
  }

  state.availableModes = cloneModes(nextAvailableModes);
  state.discoveredModels = cloneDiscoveredModels(nextDiscoveredModels);
  state.thinkingOptionsByModel = cloneThinkingOptionsByModel(nextThinkingOptionsByModel);
  return true;
}

export function clearKimicodeDiscoveryState(settings: Record<string, unknown>): boolean {
  const state = ensureDiscoveryState(settings);
  if (
    state.availableModes.length === 0
    && state.discoveredModels.length === 0
    && Object.keys(state.thinkingOptionsByModel).length === 0
  ) {
    return false;
  }

  state.availableModes = [];
  state.discoveredModels = [];
  state.thinkingOptionsByModel = {};
  return true;
}

export function seedKimicodeDiscoveryStateFromLegacyConfig(
  settings: Record<string, unknown>,
  legacyConfig: Record<string, unknown>,
): boolean {
  const state = ensureDiscoveryState(settings);
  const nextAvailableModes = state.availableModes.length > 0
    ? state.availableModes
    : normalizeKimicodeAvailableModes(legacyConfig.availableModes);
  const nextDiscoveredModels = state.discoveredModels.length > 0
    ? state.discoveredModels
    : normalizeKimicodeDiscoveredModels(legacyConfig.discoveredModels);
  const nextThinkingOptionsByModel = Object.keys(state.thinkingOptionsByModel).length > 0
    ? state.thinkingOptionsByModel
    : normalizeKimicodeThinkingOptionsByModel(legacyConfig.thinkingOptionsByModel, nextDiscoveredModels);

  return updateKimicodeDiscoveryState(settings, {
    availableModes: nextAvailableModes,
    discoveredModels: nextDiscoveredModels,
    thinkingOptionsByModel: nextThinkingOptionsByModel,
  });
}
