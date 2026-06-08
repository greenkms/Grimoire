export interface CodexDiscoveredModel {
  description?: string;
  id: string;
  isDefault?: boolean;
  label: string;
}

interface CodexModelDiscoveryState {
  discoveredModels: CodexDiscoveredModel[];
}

const CODEX_MODEL_DISCOVERY_STATE = Symbol('codexModelDiscoveryState');

type SettingsBag = Record<string | symbol, unknown>;

function ensureDiscoveryState(settings: Record<string, unknown>): CodexModelDiscoveryState {
  const bag = settings as SettingsBag;
  const existing = bag[CODEX_MODEL_DISCOVERY_STATE];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const state = existing as Partial<CodexModelDiscoveryState>;
    state.discoveredModels = normalizeCodexDiscoveredModels(state.discoveredModels);
    return state as CodexModelDiscoveryState;
  }

  const next: CodexModelDiscoveryState = {
    discoveredModels: [],
  };
  Object.defineProperty(bag, CODEX_MODEL_DISCOVERY_STATE, {
    configurable: true,
    enumerable: false,
    value: next,
    writable: true,
  });
  return next;
}

function cloneDiscoveredModels(models: CodexDiscoveredModel[]): CodexDiscoveredModel[] {
  return models.map((model) => ({ ...model }));
}

export function normalizeCodexDiscoveredModels(value: unknown): CodexDiscoveredModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: CodexDiscoveredModel[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const label = typeof record.label === 'string' ? record.label.trim() : id;
    const description = typeof record.description === 'string'
      ? record.description.trim()
      : '';

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    normalized.push({
      ...(description ? { description } : {}),
      id,
      ...(record.isDefault === true ? { isDefault: true } : {}),
      label: label || id,
    });
  }

  return normalized;
}

export function getCodexModelDiscoveryState(
  settings: Record<string, unknown>,
): CodexModelDiscoveryState {
  const state = ensureDiscoveryState(settings);
  return {
    discoveredModels: cloneDiscoveredModels(state.discoveredModels),
  };
}

export function updateCodexModelDiscoveryState(
  settings: Record<string, unknown>,
  updates: Partial<CodexModelDiscoveryState>,
): boolean {
  const state = ensureDiscoveryState(settings);
  const nextDiscoveredModels = 'discoveredModels' in updates
    ? normalizeCodexDiscoveredModels(updates.discoveredModels)
    : state.discoveredModels;

  if (sameDiscoveredModels(state.discoveredModels, nextDiscoveredModels)) {
    return false;
  }

  state.discoveredModels = cloneDiscoveredModels(nextDiscoveredModels);
  return true;
}

function sameDiscoveredModels(
  left: CodexDiscoveredModel[],
  right: CodexDiscoveredModel[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftModel, index) => {
    const rightModel = right[index];
    return rightModel
      && leftModel.id === rightModel.id
      && leftModel.label === rightModel.label
      && leftModel.description === rightModel.description
      && leftModel.isDefault === rightModel.isDefault;
  });
}
