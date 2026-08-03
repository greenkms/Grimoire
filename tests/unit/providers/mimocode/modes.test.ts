import {
  getEffectiveMimocodeModes,
  getManagedMimocodeModes,
  MIMOCODE_BUILD_MODE_ID,
  MIMOCODE_FALLBACK_MODES,
  MIMOCODE_FULL_ACCESS_MODE_ID,
  MIMOCODE_LEGACY_YOLO_MODE_ID,
  MIMOCODE_SAFE_MODE_ID,
  normalizeManagedMimocodeSelectedMode,
  normalizeMimocodeAvailableModes,
  normalizeMimocodeSelectedMode,
  resolveMimocodeModeForPermissionMode,
  resolvePermissionModeForManagedMimocodeMode,
} from '../../../../src/providers/mimocode/modes';
import { mimocodeChatUIConfig } from '../../../../src/providers/mimocode/ui/MimocodeChatUIConfig';

describe('MiMoCode mode settings', () => {
  it('normalizes duplicate/invalid mode entries', () => {
    expect(normalizeMimocodeAvailableModes([
      { id: 'build', name: 'Build' },
      { id: 'build', name: 'Duplicate build' },
      { id: 'plan', name: 'Plan', description: 'Planning-first agent' },
      null,
    ])).toEqual([
      { id: 'build', name: 'Build' },
      { description: 'Planning-first agent', id: 'plan', name: 'Plan' },
    ]);
  });

  it('preserves a saved mode string until fresh discovery decides whether it is valid', () => {
    expect(normalizeMimocodeSelectedMode('plan')).toBe('plan');
  });

  it('falls back to the built-in primary modes before ACP discovery finishes', () => {
    expect(getEffectiveMimocodeModes([])).toEqual(MIMOCODE_FALLBACK_MODES);
  });

  it('keeps Grimoire on managed full-access/safe/plan modes even when discovery only reports custom agents', () => {
    expect(getManagedMimocodeModes([
      { id: 'compaction', name: 'compaction' },
      { id: 'summary', name: 'summary' },
    ])).toEqual(MIMOCODE_FALLBACK_MODES);
  });

  it('normalizes saved custom mode selections back to the managed full-access mode', () => {
    expect(normalizeManagedMimocodeSelectedMode('compaction')).toBe(MIMOCODE_FULL_ACCESS_MODE_ID);
  });

  it('normalizes the legacy build id back to the managed full-access mode', () => {
    expect(normalizeManagedMimocodeSelectedMode(MIMOCODE_BUILD_MODE_ID)).toBe(MIMOCODE_FULL_ACCESS_MODE_ID);
  });

  it('normalizes the legacy yolo mode id back to the managed full-access mode', () => {
    expect(normalizeManagedMimocodeSelectedMode(MIMOCODE_LEGACY_YOLO_MODE_ID)).toBe(MIMOCODE_FULL_ACCESS_MODE_ID);
  });

  it('maps shared permission modes onto managed MiMoCode modes', () => {
    expect(resolveMimocodeModeForPermissionMode('full_access')).toBe(MIMOCODE_FULL_ACCESS_MODE_ID);
    expect(resolveMimocodeModeForPermissionMode('normal')).toBe(MIMOCODE_SAFE_MODE_ID);
    expect(resolveMimocodeModeForPermissionMode('plan')).toBe('plan');
  });

  it('maps managed MiMoCode modes back to shared permission modes', () => {
    expect(resolvePermissionModeForManagedMimocodeMode(MIMOCODE_BUILD_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedMimocodeMode(MIMOCODE_FULL_ACCESS_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedMimocodeMode(MIMOCODE_LEGACY_YOLO_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedMimocodeMode(MIMOCODE_SAFE_MODE_ID)).toBe('normal');
    expect(resolvePermissionModeForManagedMimocodeMode('plan')).toBe('plan');
    expect(resolvePermissionModeForManagedMimocodeMode('summary')).toBeNull();
  });
});

describe('mimocodeChatUIConfig permission mode wiring', () => {
  it('exposes the shared Safe/Auto-approve/Plan toggle instead of a provider-owned mode selector', () => {
    expect(mimocodeChatUIConfig.getModeSelector?.({
      providerConfigs: {
        mimocode: {
          availableModes: [
            { id: MIMOCODE_FULL_ACCESS_MODE_ID, name: 'Auto-approve' },
            { id: MIMOCODE_SAFE_MODE_ID, name: 'Safe' },
            { id: 'plan', name: 'Plan' },
          ],
          selectedMode: MIMOCODE_SAFE_MODE_ID,
        },
      },
    }) ?? null).toBeNull();

    expect(mimocodeChatUIConfig.getPermissionModeToggle?.()).toEqual({
      activeLabel: 'Auto-approve',
      activeValue: 'full_access',
      inactiveLabel: 'Safe',
      inactiveValue: 'normal',
      planLabel: 'Plan',
      planValue: 'plan',
    });
  });

  it('derives shared permission mode from the saved managed MiMoCode mode', () => {
    expect(mimocodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        mimocode: {
          selectedMode: MIMOCODE_BUILD_MODE_ID,
        },
      },
    })).toBe('full_access');

    expect(mimocodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        mimocode: {
          selectedMode: MIMOCODE_SAFE_MODE_ID,
        },
      },
    })).toBe('normal');

    expect(mimocodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        mimocode: {
          selectedMode: MIMOCODE_FULL_ACCESS_MODE_ID,
        },
      },
    })).toBe('full_access');

    expect(mimocodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        mimocode: {
          selectedMode: 'plan',
        },
      },
    })).toBe('plan');
  });

  it('maps shared permission mode changes back into managed MiMoCode modes', () => {
    const settings: Record<string, unknown> = {
      permissionMode: 'full_access',
      providerConfigs: {
        mimocode: {
          availableModes: [
            { id: MIMOCODE_FULL_ACCESS_MODE_ID, name: 'Auto-approve' },
            { id: MIMOCODE_SAFE_MODE_ID, name: 'Safe' },
            { id: 'plan', name: 'Plan' },
          ],
          selectedMode: MIMOCODE_FULL_ACCESS_MODE_ID,
        },
      },
    };

    mimocodeChatUIConfig.applyPermissionMode?.('normal', settings);
    expect(settings.permissionMode).toBe('normal');
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).mimocode.selectedMode).toBe(MIMOCODE_SAFE_MODE_ID);

    mimocodeChatUIConfig.applyPermissionMode?.('plan', settings);
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).mimocode.selectedMode).toBe('plan');

    mimocodeChatUIConfig.applyPermissionMode?.('full_access', settings);
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).mimocode.selectedMode).toBe(MIMOCODE_FULL_ACCESS_MODE_ID);
  });
});
