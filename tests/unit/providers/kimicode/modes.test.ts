import {
  getEffectiveKimicodeModes,
  getManagedKimicodeModes,
  KIMICODE_BUILD_MODE_ID,
  KIMICODE_FALLBACK_MODES,
  KIMICODE_FULL_ACCESS_MODE_ID,
  KIMICODE_LEGACY_YOLO_MODE_ID,
  KIMICODE_SAFE_MODE_ID,
  normalizeKimicodeAvailableModes,
  normalizeKimicodeSelectedMode,
  normalizeManagedKimicodeSelectedMode,
  resolveKimicodeModeForPermissionMode,
  resolvePermissionModeForManagedKimicodeMode,
} from '../../../../src/providers/kimicode/modes';
import { kimicodeChatUIConfig } from '../../../../src/providers/kimicode/ui/KimicodeChatUIConfig';

describe('Kimi Code mode settings', () => {
  it('normalizes duplicate/invalid mode entries', () => {
    expect(normalizeKimicodeAvailableModes([
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
    expect(normalizeKimicodeSelectedMode('plan')).toBe('plan');
  });

  it('falls back to the built-in primary modes before ACP discovery finishes', () => {
    expect(getEffectiveKimicodeModes([])).toEqual(KIMICODE_FALLBACK_MODES);
  });

  it('keeps Grimoire on managed full-access/safe/plan modes even when discovery only reports custom agents', () => {
    expect(getManagedKimicodeModes([
      { id: 'compaction', name: 'compaction' },
      { id: 'summary', name: 'summary' },
    ])).toEqual(KIMICODE_FALLBACK_MODES);
  });

  it('normalizes saved custom mode selections back to the managed full-access mode', () => {
    expect(normalizeManagedKimicodeSelectedMode('compaction')).toBe(KIMICODE_FULL_ACCESS_MODE_ID);
  });

  it('normalizes the legacy build id back to the managed full-access mode', () => {
    expect(normalizeManagedKimicodeSelectedMode(KIMICODE_BUILD_MODE_ID)).toBe(KIMICODE_FULL_ACCESS_MODE_ID);
  });

  it('normalizes the legacy yolo mode id back to the managed full-access mode', () => {
    expect(normalizeManagedKimicodeSelectedMode(KIMICODE_LEGACY_YOLO_MODE_ID)).toBe(KIMICODE_FULL_ACCESS_MODE_ID);
  });

  it('maps shared permission modes onto managed Kimi Code modes', () => {
    expect(resolveKimicodeModeForPermissionMode('full_access')).toBe(KIMICODE_FULL_ACCESS_MODE_ID);
    expect(resolveKimicodeModeForPermissionMode('normal')).toBe(KIMICODE_SAFE_MODE_ID);
    expect(resolveKimicodeModeForPermissionMode('plan')).toBe('plan');
  });

  it('maps managed Kimi Code modes back to shared permission modes', () => {
    expect(resolvePermissionModeForManagedKimicodeMode(KIMICODE_BUILD_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedKimicodeMode(KIMICODE_FULL_ACCESS_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedKimicodeMode(KIMICODE_LEGACY_YOLO_MODE_ID)).toBe('full_access');
    expect(resolvePermissionModeForManagedKimicodeMode(KIMICODE_SAFE_MODE_ID)).toBe('normal');
    expect(resolvePermissionModeForManagedKimicodeMode('plan')).toBe('plan');
    expect(resolvePermissionModeForManagedKimicodeMode('summary')).toBeNull();
  });
});

describe('kimicodeChatUIConfig permission mode wiring', () => {
  it('exposes the shared Safe/Auto-approve/Plan toggle instead of a provider-owned mode selector', () => {
    expect(kimicodeChatUIConfig.getModeSelector?.({
      providerConfigs: {
        kimicode: {
          availableModes: [
            { id: KIMICODE_FULL_ACCESS_MODE_ID, name: 'Auto-approve' },
            { id: KIMICODE_SAFE_MODE_ID, name: 'Safe' },
            { id: 'plan', name: 'Plan' },
          ],
          selectedMode: KIMICODE_SAFE_MODE_ID,
        },
      },
    }) ?? null).toBeNull();

    expect(kimicodeChatUIConfig.getPermissionModeToggle?.()).toEqual({
      activeLabel: 'Auto-approve',
      activeValue: 'full_access',
      inactiveLabel: 'Safe',
      inactiveValue: 'normal',
      planLabel: 'Plan',
      planValue: 'plan',
    });
  });

  it('derives shared permission mode from the saved managed Kimi Code mode', () => {
    expect(kimicodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        kimicode: {
          selectedMode: KIMICODE_BUILD_MODE_ID,
        },
      },
    })).toBe('full_access');

    expect(kimicodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        kimicode: {
          selectedMode: KIMICODE_SAFE_MODE_ID,
        },
      },
    })).toBe('normal');

    expect(kimicodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        kimicode: {
          selectedMode: KIMICODE_FULL_ACCESS_MODE_ID,
        },
      },
    })).toBe('full_access');

    expect(kimicodeChatUIConfig.resolvePermissionMode?.({
      providerConfigs: {
        kimicode: {
          selectedMode: 'plan',
        },
      },
    })).toBe('plan');
  });

  it('maps shared permission mode changes back into managed Kimi Code modes', () => {
    const settings: Record<string, unknown> = {
      permissionMode: 'full_access',
      providerConfigs: {
        kimicode: {
          availableModes: [
            { id: KIMICODE_FULL_ACCESS_MODE_ID, name: 'Auto-approve' },
            { id: KIMICODE_SAFE_MODE_ID, name: 'Safe' },
            { id: 'plan', name: 'Plan' },
          ],
          selectedMode: KIMICODE_FULL_ACCESS_MODE_ID,
        },
      },
    };

    kimicodeChatUIConfig.applyPermissionMode?.('normal', settings);
    expect(settings.permissionMode).toBe('normal');
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).kimicode.selectedMode).toBe(KIMICODE_SAFE_MODE_ID);

    kimicodeChatUIConfig.applyPermissionMode?.('plan', settings);
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).kimicode.selectedMode).toBe('plan');

    kimicodeChatUIConfig.applyPermissionMode?.('full_access', settings);
    expect((settings.providerConfigs as Record<string, Record<string, unknown>>).kimicode.selectedMode).toBe(KIMICODE_FULL_ACCESS_MODE_ID);
  });
});
