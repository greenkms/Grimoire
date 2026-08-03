import { sameDiscoveredModels, sameModes, sameThinkingOptionsByModel } from '../../utils/collections';
import {
  type MimocodeDiscoveredModel,
  type MimocodeThinkingOptionsByModel,
  normalizeMimocodeDiscoveredModels,
  normalizeMimocodeThinkingOptionsByModel,
} from './models';
import {
  type MimocodeMode,
  normalizeMimocodeAvailableModes,
} from './modes';

const MIMOCODE_DISCOVERY_STATE = Symbol('mimocodeDiscoveryState');

interface MimocodeDiscoveryState {
  availableModes: MimocodeMode[];
  discoveredModels: MimocodeDiscoveredModel[];
  thinkingOptionsByModel: MimocodeThinkingOptionsByModel;
}

type SettingsBag = Record<string | symbol, unknown>;

function ensureDiscoveryState(settings: Record<string, unknown>): MimocodeDiscoveryState {
  const bag = settings as SettingsBag;
  const existing = bag[MIMOCODE_DISCOVERY_STATE];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const state = existing as Partial<MimocodeDiscoveryState>;
    state.availableModes ??= [];
    state.discoveredModels ??= [];
    state.thinkingOptionsByModel ??= {};
    return state as MimocodeDiscoveryState;
  }

  const next: MimocodeDiscoveryState = {
    availableModes: [],
    discoveredModels: [],
    thinkingOptionsByModel: {},
  };
  Object.defineProperty(bag, MIMOCODE_DISCOVERY_STATE, {
    configurable: true,
    enumerable: false,
    value: next,
    writable: true,
  });
  return next;
}

function cloneModes(modes: MimocodeMode[]): MimocodeMode[] {
  return modes.map((mode) => ({ ...mode }));
}

function cloneDiscoveredModels(models: MimocodeDiscoveredModel[]): MimocodeDiscoveredModel[] {
  return models.map((model) => ({ ...model }));
}

function cloneThinkingOptionsByModel(
  optionsByModel: MimocodeThinkingOptionsByModel,
): MimocodeThinkingOptionsByModel {
  return Object.fromEntries(
    Object.entries(optionsByModel).map(([rawId, options]) => [
      rawId,
      options.map((option) => ({ ...option })),
    ]),
  );
}

export function getMimocodeDiscoveryState(settings: Record<string, unknown>): MimocodeDiscoveryState {
  const state = ensureDiscoveryState(settings);
  return {
    availableModes: cloneModes(state.availableModes),
    discoveredModels: cloneDiscoveredModels(state.discoveredModels),
    thinkingOptionsByModel: cloneThinkingOptionsByModel(state.thinkingOptionsByModel),
  };
}

export function updateMimocodeDiscoveryState(
  settings: Record<string, unknown>,
  updates: Partial<MimocodeDiscoveryState>,
): boolean {
  const state = ensureDiscoveryState(settings);
  const nextAvailableModes = 'availableModes' in updates
    ? normalizeMimocodeAvailableModes(updates.availableModes)
    : state.availableModes;
  const nextDiscoveredModels = 'discoveredModels' in updates
    ? normalizeMimocodeDiscoveredModels(updates.discoveredModels)
    : state.discoveredModels;
  const nextThinkingOptionsByModel = 'thinkingOptionsByModel' in updates
    ? normalizeMimocodeThinkingOptionsByModel(updates.thinkingOptionsByModel, nextDiscoveredModels)
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

export function clearMimocodeDiscoveryState(settings: Record<string, unknown>): boolean {
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

export function seedMimocodeDiscoveryStateFromLegacyConfig(
  settings: Record<string, unknown>,
  legacyConfig: Record<string, unknown>,
): boolean {
  const state = ensureDiscoveryState(settings);
  const nextAvailableModes = state.availableModes.length > 0
    ? state.availableModes
    : normalizeMimocodeAvailableModes(legacyConfig.availableModes);
  const nextDiscoveredModels = state.discoveredModels.length > 0
    ? state.discoveredModels
    : normalizeMimocodeDiscoveredModels(legacyConfig.discoveredModels);
  const nextThinkingOptionsByModel = Object.keys(state.thinkingOptionsByModel).length > 0
    ? state.thinkingOptionsByModel
    : normalizeMimocodeThinkingOptionsByModel(legacyConfig.thinkingOptionsByModel, nextDiscoveredModels);

  return updateMimocodeDiscoveryState(settings, {
    availableModes: nextAvailableModes,
    discoveredModels: nextDiscoveredModels,
    thinkingOptionsByModel: nextThinkingOptionsByModel,
  });
}
