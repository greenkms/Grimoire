import { coercePermissionMode } from '../../core/types/settings';

export interface MimocodeMode {
  description?: string;
  id: string;
  name: string;
}

export const MIMOCODE_BUILD_MODE_ID = 'build';
export const MIMOCODE_FULL_ACCESS_MODE_ID = 'grimoire-full-access';
export const MIMOCODE_LEGACY_YOLO_MODE_ID = 'grimoire-yolo';
export const MIMOCODE_SAFE_MODE_ID = 'grimoire-safe';
export const MIMOCODE_PLAN_MODE_ID = 'plan';

export const MIMOCODE_FALLBACK_MODES: ReadonlyArray<MimocodeMode> = Object.freeze([
  {
    description: 'Auto-approves tool actions.',
    id: MIMOCODE_FULL_ACCESS_MODE_ID,
    name: 'auto-approve',
  },
  {
    description: 'Safe mode. Asks before shell commands and file edits.',
    id: MIMOCODE_SAFE_MODE_ID,
    name: 'safe',
  },
  {
    description: 'Plan mode. Disallows all edit tools.',
    id: MIMOCODE_PLAN_MODE_ID,
    name: MIMOCODE_PLAN_MODE_ID,
  },
]);

const MIMOCODE_MANAGED_MODE_IDS = new Set([
  MIMOCODE_BUILD_MODE_ID,
  MIMOCODE_LEGACY_YOLO_MODE_ID,
  ...MIMOCODE_FALLBACK_MODES.map((mode) => mode.id),
]);

export function normalizeMimocodeAvailableModes(value: unknown): MimocodeMode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: MimocodeMode[] = [];
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

export function getEffectiveMimocodeModes(modes: MimocodeMode[]): MimocodeMode[] {
  return modes.length > 0 ? modes : [...MIMOCODE_FALLBACK_MODES];
}

export function isManagedMimocodeModeId(value: string): boolean {
  return MIMOCODE_MANAGED_MODE_IDS.has(value);
}

export function getManagedMimocodeModes(modes: MimocodeMode[]): MimocodeMode[] {
  const effectiveModes = getEffectiveMimocodeModes(modes);
  return MIMOCODE_FALLBACK_MODES.map((fallbackMode) => (
    effectiveModes.find((mode) => mode.id === fallbackMode.id) ?? fallbackMode
  ));
}

export function normalizeMimocodeSelectedMode(
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

export function normalizeManagedMimocodeSelectedMode(
  value: unknown,
  modes: MimocodeMode[] = [],
): string {
  const normalized = normalizeMimocodeSelectedMode(value);
  if (!normalized) {
    return '';
  }

  const canonicalModeId = normalized === MIMOCODE_BUILD_MODE_ID
    || normalized === MIMOCODE_LEGACY_YOLO_MODE_ID
    ? MIMOCODE_FULL_ACCESS_MODE_ID
    : normalized;
  const managedModes = getManagedMimocodeModes(modes);
  return managedModes.some((mode) => mode.id === canonicalModeId)
    ? canonicalModeId
    : (managedModes[0]?.id ?? '');
}

export function resolveMimocodeModeForPermissionMode(
  permissionMode: unknown,
  modes: MimocodeMode[] = [],
): string {
  const managedModes = getManagedMimocodeModes(modes);
  const managedModeIds = new Set(managedModes.map((mode) => mode.id));

  if (permissionMode === 'plan' && managedModeIds.has(MIMOCODE_PLAN_MODE_ID)) {
    return MIMOCODE_PLAN_MODE_ID;
  }
  if (permissionMode === 'normal' && managedModeIds.has(MIMOCODE_SAFE_MODE_ID)) {
    return MIMOCODE_SAFE_MODE_ID;
  }
  if (coercePermissionMode(permissionMode) === 'full_access' && managedModeIds.has(MIMOCODE_FULL_ACCESS_MODE_ID)) {
    return MIMOCODE_FULL_ACCESS_MODE_ID;
  }
  if (managedModeIds.has(MIMOCODE_FULL_ACCESS_MODE_ID)) {
    return MIMOCODE_FULL_ACCESS_MODE_ID;
  }

  return managedModes[0]?.id ?? '';
}

export function resolvePermissionModeForManagedMimocodeMode(
  modeId: unknown,
): 'normal' | 'plan' | 'full_access' | null {
  if (
    modeId === MIMOCODE_BUILD_MODE_ID
    || modeId === MIMOCODE_FULL_ACCESS_MODE_ID
    || modeId === MIMOCODE_LEGACY_YOLO_MODE_ID
  ) {
    return 'full_access';
  }
  if (modeId === MIMOCODE_SAFE_MODE_ID) {
    return 'normal';
  }
  if (modeId === MIMOCODE_PLAN_MODE_ID) {
    return 'plan';
  }
  return null;
}
