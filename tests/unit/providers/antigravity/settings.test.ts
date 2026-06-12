import {
  DEFAULT_ANTIGRAVITY_PROVIDER_SETTINGS,
  getAntigravityProviderSettings,
  updateAntigravityProviderSettings,
} from '@/providers/antigravity/settings';

describe('Antigravity provider settings', () => {
  it('is disabled by default and falls back to agy from PATH', () => {
    const settings = getAntigravityProviderSettings({});

    expect(settings.enabled).toBe(false);
    expect(settings.cliPath).toBe('');
    expect(settings.cliPathsByHost).toEqual({});
    expect(settings.environmentVariables).toBe('');
    expect(settings.visibleModels).toEqual([]);
    expect(settings.modelAliases).toEqual({});
    expect(settings.discoveredModels).toEqual([]);
    expect(DEFAULT_ANTIGRAVITY_PROVIDER_SETTINGS.enabled).toBe(false);
  });

  it('round-trips provider settings through providerConfigs.antigravity', () => {
    const root: Record<string, unknown> = {};
    const next = updateAntigravityProviderSettings(root, {
      cliPath: '/usr/local/bin/agy',
      enabled: true,
      environmentVariables: 'GOOGLE_CLOUD_PROJECT=test',
      modelAliases: { 'Claude Sonnet 4.6 (Thinking)': 'Sonnet Thinking' },
      visibleModels: ['Claude Sonnet 4.6 (Thinking)'],
    });

    expect(next.enabled).toBe(true);
    expect(getAntigravityProviderSettings(root).cliPath).toBe('');
    expect(Object.values(getAntigravityProviderSettings(root).cliPathsByHost)).toContain('/usr/local/bin/agy');
    expect(getAntigravityProviderSettings(root).environmentVariables).toBe('GOOGLE_CLOUD_PROJECT=test');
    expect(getAntigravityProviderSettings(root).visibleModels).toEqual(['Claude Sonnet 4.6 (Thinking)']);
    expect(getAntigravityProviderSettings(root).modelAliases).toEqual({
      'Claude Sonnet 4.6 (Thinking)': 'Sonnet Thinking',
    });
  });
});
