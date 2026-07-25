import { DEFAULT_GRIMOIRE_SETTINGS } from '@/app/settings/defaultSettings';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '@/providers/codex/types/models';

describe('DEFAULT_GRIMOIRE_SETTINGS', () => {
  it('does not store a Grimoire-specific appearance theme', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS).not.toHaveProperty('appearanceTheme');
  });

  it('starts first-run chat on Codex with the primary Codex model', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.settingsProvider).toBe('codex');
    expect(DEFAULT_GRIMOIRE_SETTINGS.model).toBe(DEFAULT_CODEX_PRIMARY_MODEL);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.claude?.enabled).toBe(false);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.codex?.enabled).toBe(true);
    expect(DEFAULT_GRIMOIRE_SETTINGS.providerConfigs.antigravity?.enabled).toBe(false);
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

  it('starts with no excluded folders', () => {
    expect(DEFAULT_GRIMOIRE_SETTINGS.excludedFolders).toEqual([]);
  });
});
