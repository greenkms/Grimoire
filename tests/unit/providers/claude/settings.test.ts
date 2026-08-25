import {
  DEFAULT_CLAUDE_PROVIDER_SETTINGS,
  getClaudeProviderSettings,
  snapshotClaudeCodeSettings,
} from '@/providers/claude/settings';

describe('Claude provider settings', () => {
  describe('snapshotClaudeCodeSettings', () => {
    it('merges user settings with project settings and lets project values win', () => {
      const snapshot = snapshotClaudeCodeSettings({
        includeUserSettings: true,
        user: {
          model: 'user-model',
          env: {
            ANTHROPIC_MODEL: 'user-env-model',
            ANTHROPIC_BASE_URL: 'https://user.example.com',
          },
        },
        project: {
          model: 'project-model',
          env: {
            ANTHROPIC_MODEL: 'project-env-model',
          },
        },
      });

      expect(snapshot.model).toBe('project-model');
      expect(snapshot.env).toEqual({
        ANTHROPIC_MODEL: 'project-env-model',
        ANTHROPIC_BASE_URL: 'https://user.example.com',
      });
    });

    it('ignores user settings when user settings are disabled', () => {
      const snapshot = snapshotClaudeCodeSettings({
        includeUserSettings: false,
        user: {
          model: 'user-model',
          env: {
            ANTHROPIC_MODEL: 'user-env-model',
          },
        },
        project: {
          model: '',
          env: {},
        },
      });

      expect(snapshot.model).toBe('');
      expect(snapshot.env).toEqual({});
    });
  });
});

describe('Claude auto-ping settings', () => {
  it('defaults to disabled with a 40-minute interval, a 6-ping cap, active-tab scope, and an 80% utilization guard', () => {
    const resolved = getClaudeProviderSettings({});
    expect(resolved.autoPingEnabled).toBe(false);
    expect(resolved.autoPingIntervalMinutes).toBe(40);
    expect(resolved.autoPingMaxConsecutive).toBe(6);
    expect(resolved.autoPingScope).toBe('active');
    expect(resolved.autoPingSkipAboveUtilizationPct).toBe(80);
  });

  it('reads overrides from provider config', () => {
    const resolved = getClaudeProviderSettings({
      providerConfigs: {
        claude: {
          autoPingEnabled: true,
          autoPingIntervalMinutes: 25,
          autoPingMaxConsecutive: 0,
          autoPingScope: 'all',
          autoPingSkipAboveUtilizationPct: 50,
        },
      },
    });
    expect(resolved.autoPingEnabled).toBe(true);
    expect(resolved.autoPingIntervalMinutes).toBe(25);
    expect(resolved.autoPingMaxConsecutive).toBe(0);
    expect(resolved.autoPingScope).toBe('all');
    expect(resolved.autoPingSkipAboveUtilizationPct).toBe(50);
  });

  it('DEFAULT_CLAUDE_PROVIDER_SETTINGS carries the same defaults', () => {
    expect(DEFAULT_CLAUDE_PROVIDER_SETTINGS.autoPingEnabled).toBe(false);
    expect(DEFAULT_CLAUDE_PROVIDER_SETTINGS.autoPingIntervalMinutes).toBe(40);
    expect(DEFAULT_CLAUDE_PROVIDER_SETTINGS.autoPingMaxConsecutive).toBe(6);
    expect(DEFAULT_CLAUDE_PROVIDER_SETTINGS.autoPingScope).toBe('active');
    expect(DEFAULT_CLAUDE_PROVIDER_SETTINGS.autoPingSkipAboveUtilizationPct).toBe(80);
  });
});
