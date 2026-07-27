/**
 * Model type definitions and constants.
 */

/** Model identifier (string to support custom models via environment variables). */
export type ClaudeModel = string;

export const DEFAULT_CLAUDE_MODELS: { value: ClaudeModel; label: string; description: string }[] = [
  { value: 'best', label: 'Best', description: 'Fable 5 when available, otherwise latest Opus' },
  { value: 'fable', label: 'Fable 5', description: 'Hardest and longest-running tasks' },
  { value: 'opus', label: 'Opus 5', description: 'Complex reasoning' },
  { value: 'opus[1m]', label: 'Opus 5 · 1M', description: 'Complex reasoning (1M context window)' },
  { value: 'opusplan', label: 'Opus Plan', description: 'Opus for planning, Sonnet for execution' },
  { value: 'sonnet', label: 'Sonnet 5', description: 'Daily coding' },
  { value: 'sonnet[1m]', label: 'Sonnet 5 · 1M', description: 'Daily coding (1M context window)' },
  { value: 'haiku', label: 'Haiku 4.5', description: 'Fast and efficient' },
];

/** Effort levels for adaptive thinking models. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const EFFORT_LEVELS: { value: EffortLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
  { value: 'max', label: 'Max' },
];

/** Default effort level per model tier. */
export const DEFAULT_EFFORT_LEVEL: Record<string, EffortLevel> = {
  'best': 'high',
  'fable': 'high',
  'haiku': 'high',
  'sonnet': 'high',
  'sonnet[1m]': 'high',
  'opus': 'high',
  'opus[1m]': 'high',
  'opusplan': 'high',
  'claude-opus-4-7': 'xhigh',
  'claude-opus-4-8': 'xhigh',
  'claude-fable-5': 'high',
  'claude-sonnet-5': 'high',
  'claude-haiku-4-5': 'high',
};

const ONE_M_SUFFIX = '[1m]';
const DEFAULT_MODEL_VALUES = new Set(DEFAULT_CLAUDE_MODELS.map(m => m.value.toLowerCase()));

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

function has1MContextSuffix(model: string): boolean {
  return normalizeModelId(model).endsWith(ONE_M_SUFFIX);
}

function isBuiltInFamilyVariant(model: string, family: 'sonnet' | 'opus'): boolean {
  const normalized = normalizeModelId(model);
  return normalized === family || normalized === `${family}${ONE_M_SUFFIX}`;
}

function isValidContextLimit(limit: unknown): limit is number {
  return typeof limit === 'number' && limit > 0 && !isNaN(limit) && isFinite(limit);
}

function resolveCustomContextLimit(
  model: string,
  customLimits?: Record<string, number>,
): number | null {
  if (!customLimits) {
    return null;
  }

  const exactLimit = customLimits[model];
  if (isValidContextLimit(exactLimit)) {
    return exactLimit;
  }

  const normalizedModel = normalizeModelId(model);
  const matchingLimits = Object.entries(customLimits)
    .filter(([key, limit]) => key !== model && normalizeModelId(key) === normalizedModel && isValidContextLimit(limit))
    .map(([, limit]) => limit);

  return matchingLimits.length === 1 ? matchingLimits[0] : null;
}

export function isDefaultClaudeModel(model: string): boolean {
  return DEFAULT_MODEL_VALUES.has(normalizeModelId(model));
}

/**
 * Whether the model supports the `xhigh` effort level. Opus 4.7+ only — the SDK
 * silently falls back to `high` on other models.
 */
export function supportsXHighEffort(model: string): boolean {
  const normalized = normalizeModelId(model);
  if (normalized === 'opusplan') return true;
  if (isBuiltInFamilyVariant(normalized, 'opus')) return true;
  return /claude-opus-(4-[7-9]|[5-9])/.test(normalized);
}

/**
 * Returns the canonical effort levels the selected model may use. Runtime
 * discovery is authoritative when it supplies capability metadata; without
 * it, keep the conservative built-in fallback (and never invent `max`).
 */
export function getAllowedEffortLevels(
  model: string,
  supportedEffortLevels?: readonly EffortLevel[],
): EffortLevel[] {
  if (supportedEffortLevels !== undefined) {
    const supported = new Set(supportedEffortLevels);
    return EFFORT_LEVELS
      .map(level => level.value)
      .filter((level): level is EffortLevel => supported.has(level));
  }

  return EFFORT_LEVELS
    .map(level => level.value)
    .filter(level => level !== 'max' && (level !== 'xhigh' || supportsXHighEffort(model)));
}

/** Clamp stored effort values to what the selected model actually supports. */
export function normalizeEffortLevel(
  model: string,
  effortLevel: unknown,
  supportedEffortLevels?: readonly EffortLevel[],
): EffortLevel {
  const allowedLevels = getAllowedEffortLevels(model, supportedEffortLevels);
  if (allowedLevels.includes(effortLevel as EffortLevel)) {
    return effortLevel as EffortLevel;
  }

  const modelDefault = DEFAULT_EFFORT_LEVEL[normalizeModelId(model)] ?? 'high';
  return allowedLevels.includes('high')
    ? 'high'
    : allowedLevels.includes(modelDefault)
      ? modelDefault
      : allowedLevels[0] ?? modelDefault;
}

export function resolveEffortLevel(
  model: string,
  effortLevel: unknown,
  supportedEffortLevels?: readonly EffortLevel[],
): EffortLevel {
  return normalizeEffortLevel(model, effortLevel, supportedEffortLevels);
}

export const CONTEXT_WINDOW_STANDARD = 200_000;
export const CONTEXT_WINDOW_1M = 1_000_000;

/** The small subset of runtime discovery metadata needed to resolve context. */
export interface ClaudeContextModelMetadata {
  id: string;
  resolvedModel?: string;
  maxInputTokens?: number;
}

function findDiscoveredModel(
  selectedModel: string,
  discoveredModels: readonly ClaudeContextModelMetadata[],
): ClaudeContextModelMetadata | undefined {
  const normalizedSelectedModel = normalizeModelId(selectedModel);
  return discoveredModels.find(model => normalizeModelId(model.id) === normalizedSelectedModel);
}

/**
 * Resolves the selected model's context window without maintaining a second
 * model catalog. Discovery is authoritative when it supplies a token limit.
 */
export function resolveClaudeContextWindowSize(
  selectedModel: string,
  customLimits?: Record<string, number>,
  discoveredModels: readonly ClaudeContextModelMetadata[] = [],
): number {
  const selectedLimit = resolveCustomContextLimit(selectedModel, customLimits);
  if (selectedLimit !== null) {
    return selectedLimit;
  }

  const discoveredModel = findDiscoveredModel(selectedModel, discoveredModels);
  const resolvedModel = discoveredModel?.resolvedModel;
  if (resolvedModel) {
    const resolvedLimit = resolveCustomContextLimit(resolvedModel, customLimits);
    if (resolvedLimit !== null) {
      return resolvedLimit;
    }
  }

  if (isValidContextLimit(discoveredModel?.maxInputTokens)) {
    return discoveredModel.maxInputTokens;
  }

  const capabilityModel = resolvedModel ?? selectedModel;
  if (
    normalizeModelId(capabilityModel) === 'claude-sonnet-5'
    || (discoveredModel !== undefined && normalizeModelId(selectedModel) === 'sonnet')
    || has1MContextSuffix(capabilityModel)
  ) {
    return CONTEXT_WINDOW_1M;
  }

  return CONTEXT_WINDOW_STANDARD;
}

export function getContextWindowSize(
  model: string,
  customLimits?: Record<string, number>
): number {
  return resolveClaudeContextWindowSize(model, customLimits);
}
