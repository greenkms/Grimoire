import { coercePermissionMode } from '../../core/types/settings';

export interface KimicodeMode {
  description?: string;
  id: string;
  name: string;
}

export const KIMICODE_BUILD_MODE_ID = 'build';
export const KIMICODE_FULL_ACCESS_MODE_ID = 'auto';
export const KIMICODE_LEGACY_YOLO_MODE_ID = 'grimoire-yolo';
export const KIMICODE_SAFE_MODE_ID = 'default';
export const KIMICODE_PLAN_MODE_ID = 'plan';

export const KIMICODE_FALLBACK_MODES: ReadonlyArray<KimicodeMode> = Object.freeze([
  {
    description: 'Manual approvals; tools execute normally.',
    id: KIMICODE_SAFE_MODE_ID,
    name: 'Default',
  },
  {
    description: 'Read-only planning; no tool execution.',
    id: KIMICODE_PLAN_MODE_ID,
    name: 'Plan',
  },
  {
    description: 'Auto-approve safe operations.',
    id: KIMICODE_FULL_ACCESS_MODE_ID,
    name: 'Auto',
  },
]);

const KIMICODE_MANAGED_MODE_IDS = new Set([
  KIMICODE_BUILD_MODE_ID,
  KIMICODE_LEGACY_YOLO_MODE_ID,
  ...KIMICODE_FALLBACK_MODES.map((mode) => mode.id),
]);

export function normalizeKimicodeAvailableModes(value: unknown): KimicodeMode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: KimicodeMode[] = [];
  const seen = new Set<string>();
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;

    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : id;
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
      name: name || id,
    });
  }

  return normalized;
}

export function getEffectiveKimicodeModes(modes: KimicodeMode[]): KimicodeMode[] {
  return modes.length > 0 ? modes : [...KIMICODE_FALLBACK_MODES];
}

export function isManagedKimicodeModeId(value: string): boolean {
  return KIMICODE_MANAGED_MODE_IDS.has(value);
}

export function getManagedKimicodeModes(modes: KimicodeMode[]): KimicodeMode[] {
  const effectiveModes = getEffectiveKimicodeModes(modes);
  return KIMICODE_FALLBACK_MODES.map((fallbackMode) => (
    effectiveModes.find((mode) => mode.id === fallbackMode.id) ?? fallbackMode
  ));
}

export function normalizeKimicodeSelectedMode(
  value: unknown,
): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed;
}

export function normalizeManagedKimicodeSelectedMode(
  value: unknown,
  modes: KimicodeMode[] = [],
): string {
  const normalized = normalizeKimicodeSelectedMode(value);
  if (!normalized) {
    return '';
  }

  const canonicalModeId = normalized === KIMICODE_BUILD_MODE_ID
    || normalized === KIMICODE_LEGACY_YOLO_MODE_ID
    ? KIMICODE_FULL_ACCESS_MODE_ID
    : normalized;
  const managedModes = getManagedKimicodeModes(modes);
  return managedModes.some((mode) => mode.id === canonicalModeId)
    ? canonicalModeId
    : (managedModes[0]?.id ?? '');
}

export function resolveKimicodeModeForPermissionMode(
  permissionMode: unknown,
  modes: KimicodeMode[] = [],
): string {
  const managedModes = getManagedKimicodeModes(modes);
  const managedModeIds = new Set(managedModes.map((mode) => mode.id));

  if (permissionMode === 'plan' && managedModeIds.has(KIMICODE_PLAN_MODE_ID)) {
    return KIMICODE_PLAN_MODE_ID;
  }
  if (permissionMode === 'normal' && managedModeIds.has(KIMICODE_SAFE_MODE_ID)) {
    return KIMICODE_SAFE_MODE_ID;
  }
  if (coercePermissionMode(permissionMode) === 'full_access' && managedModeIds.has(KIMICODE_FULL_ACCESS_MODE_ID)) {
    return KIMICODE_FULL_ACCESS_MODE_ID;
  }
  if (managedModeIds.has(KIMICODE_FULL_ACCESS_MODE_ID)) {
    return KIMICODE_FULL_ACCESS_MODE_ID;
  }

  return managedModes[0]?.id ?? '';
}

export function resolvePermissionModeForManagedKimicodeMode(
  modeId: unknown,
): 'normal' | 'plan' | 'full_access' | null {
  if (
    modeId === KIMICODE_BUILD_MODE_ID
    || modeId === KIMICODE_FULL_ACCESS_MODE_ID
    || modeId === KIMICODE_LEGACY_YOLO_MODE_ID
  ) {
    return 'full_access';
  }
  if (modeId === KIMICODE_SAFE_MODE_ID) {
    return 'normal';
  }
  if (modeId === KIMICODE_PLAN_MODE_ID) {
    return 'plan';
  }
  return null;
}
