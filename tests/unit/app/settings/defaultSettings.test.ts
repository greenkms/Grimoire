import { DEFAULT_GRIMOIRE_SETTINGS } from '@/app/settings/defaultSettings';
import { GRIMOIRE_APPEARANCE_THEMES } from '@/core/types/settings';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '@/providers/codex/types/models';

describe('DEFAULT_GRIMOIRE_SETTINGS', () => {
  it('uses the design handoff theme ids', () => {
    expect(GRIMOIRE_APPEARANCE_THEMES).toEqual([
      'violet',
      'graphite',
      'rune',
      'verdant',
    ]);
  });

  it('uses Violet as the default appearance theme', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.appearanceTheme).toBe('violet');
  });

  it('starts first-run chat on Codex with the primary Codex model', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.settingsProvider).toBe('codex');
    expect(DEFAULT_GRIMOIRE_SETTINGS.model).toBe(DEFAULT_CODEX_PRIMARY_MODEL);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.claude?.enabled).toBe(false);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.codex?.enabled).toBe(true);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.gemini?.enabled).toBe(false);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.opencode?.enabled).toBe(false);
  });

  it('starts every advanced settings disclosure collapsed', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.advancedSectionsOpen).toEqual({});
  });

  it('keeps debug file logging disabled by default', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.debugLoggingEnabled).toBe(false);
  });

  it('shows usage indicators by default', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.usageIndicatorsEnabled).toBe(true);
  });
});
