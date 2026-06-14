import { snapshotClaudeCodeSettings } from '@/providers/claude/settings';

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
