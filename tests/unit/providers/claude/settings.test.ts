import {
  getClaudeProviderSettings,
  snapshotClaudeCodeSettings,
  updateClaudeProviderSettings,
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

  describe('discovered models fingerprint', () => {
    it('defaults to an empty string and keeps a persisted one', () => {
      const settings: Record<string, unknown> = {};

      expect(getClaudeProviderSettings(settings).discoveredModelsFingerprint).toBe('');

      updateClaudeProviderSettings(settings, { discoveredModelsFingerprint: 'a1b2c3d4' });

      expect(getClaudeProviderSettings(settings).discoveredModelsFingerprint).toBe('a1b2c3d4');
    });

    it('ignores a non-string persisted fingerprint', () => {
      const settings: Record<string, unknown> = {
        providerConfigs: { claude: { discoveredModelsFingerprint: 42 } },
      };

      expect(getClaudeProviderSettings(settings).discoveredModelsFingerprint).toBe('');
    });
  });
});
