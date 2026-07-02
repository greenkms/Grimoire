import { resolveClaudeModelSelection } from '@/providers/claude/modelOptions';
import { claudeChatUIConfig } from '@/providers/claude/ui/ClaudeChatUIConfig';

describe('claudeChatUIConfig', () => {
  describe('getModelOptions', () => {
    it('includes the Claude Code project settings model when enabled', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            respectProjectSettings: true,
            projectSettingsSnapshot: {
              model: 'gateway/claude-sonnet-custom',
              env: {},
            },
          },
        },
      });

      expect(options.at(-1)).toEqual({
        value: 'gateway/claude-sonnet-custom',
        label: 'claude-sonnet-custom',
        description: 'Claude Code settings model',
      });
    });

    it('ignores the Claude Code project settings model when disabled', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            respectProjectSettings: false,
            projectSettingsSnapshot: {
              model: 'gateway/claude-sonnet-custom',
              env: {},
            },
          },
        },
      });

      expect(options.map(option => option.value)).not.toContain('gateway/claude-sonnet-custom');
    });

    it('uses Claude Code project settings env for environment-defined models when enabled', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            respectProjectSettings: true,
            projectSettingsSnapshot: {
              model: '',
              env: {
                ANTHROPIC_MODEL: 'settings-json-model',
              },
            },
          },
        },
      });

      expect(options).toEqual([
        {
          value: 'settings-json-model',
          label: 'Settings Json Model',
          description: 'Custom model (model)',
        },
      ]);
    });

    it('lets Grimoire Claude env override the same Claude Code project settings env key', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            environmentVariables: 'ANTHROPIC_MODEL=grimoire-model',
            respectProjectSettings: true,
            projectSettingsSnapshot: {
              model: '',
              env: {
                ANTHROPIC_MODEL: 'settings-json-model',
              },
            },
          },
        },
      });

      expect(options).toEqual([
        {
          value: 'grimoire-model',
          label: 'Grimoire Model',
          description: 'Custom model (model)',
        },
      ]);
    });

    it('appends settings-defined custom models after the built-in options', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            customModels: 'claude-opus-4-6\nclaude-opus-4-6[1m]',
          },
        },
      });

      expect(options.map(option => option.value)).toEqual([
        'best',
        'fable',
        'opus',
        'opusplan',
        'sonnet',
        'haiku',
        'claude-opus-4-6',
        'claude-opus-4-6[1m]',
      ]);
      expect(options.slice(-2)).toEqual([
        {
          value: 'claude-opus-4-6',
          label: 'Opus 4.6',
          description: 'Custom model',
        },
        {
          value: 'claude-opus-4-6[1m]',
          label: 'Opus 4.6 (1M)',
          description: 'Custom model',
        },
      ]);
    });

    it('deduplicates settings-defined custom models against exact duplicates', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            customModels: 'haiku\nclaude-opus-4-6\nclaude-opus-4-6\n',
          },
        },
      });

      expect(options.map(option => option.value)).toEqual([
        'best',
        'fable',
        'opus',
        'opusplan',
        'sonnet',
        'haiku',
        'claude-opus-4-6',
      ]);
    });

    it('uses current Claude Code aliases as the static fallback model list', () => {
      const options = claudeChatUIConfig.getModelOptions({});

      expect(options.map(option => option.value)).toEqual([
        'best',
        'fable',
        'opus',
        'opusplan',
        'sonnet',
        'haiku',
      ]);
      expect(options.find(option => option.value === 'sonnet')).toEqual({
        value: 'sonnet',
        label: 'Sonnet 5',
        description: 'Daily coding',
      });
    });

    it('prepends discovered Anthropic API models before static fallback aliases', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            discoveredModels: [
              {
                id: 'claude-fable-5',
                displayName: 'Claude Fable 5',
                maxInputTokens: 1_000_000,
              },
              {
                id: 'claude-sonnet-5',
                displayName: 'Claude Sonnet 5',
                maxInputTokens: 1_000_000,
              },
            ],
          },
        },
      });

      expect(options.slice(0, 2)).toEqual([
        {
          value: 'claude-fable-5',
          label: 'Claude Fable 5',
          description: 'Anthropic API model · 1M context',
        },
        {
          value: 'claude-sonnet-5',
          label: 'Claude Sonnet 5',
          description: 'Anthropic API model · 1M context',
        },
      ]);
      expect(options.map(option => option.value)).toContain('fable');
      expect(options.map(option => option.value)).toContain('sonnet');
    });

    it('formats dated settings-defined custom models with shortened date tags', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            customModels: 'claude-opus-4-5-20251101',
          },
        },
      });

      expect(options.at(-1)).toEqual({
        value: 'claude-opus-4-5-20251101',
        label: 'Opus 4.5 (2511)',
        description: 'Custom model',
      });
    });

    it('uses custom model aliases for settings-defined custom model labels', () => {
      const options = claudeChatUIConfig.getModelOptions({
        customModelAliases: {
          'claude-opus-4-6': 'Work Opus',
        },
        providerConfigs: {
          claude: {
            customModels: 'claude-opus-4-6',
          },
        },
      });

      expect(options.at(-1)).toEqual({
        value: 'claude-opus-4-6',
        label: 'Work Opus',
        description: 'Custom model',
      });
    });

    it('keeps environment-defined custom models as a full override', () => {
      const options = claudeChatUIConfig.getModelOptions({
        providerConfigs: {
          claude: {
            customModels: 'claude-opus-4-6',
            environmentVariables: 'ANTHROPIC_MODEL=claude-sonnet-4-5',
          },
        },
      });

      expect(options).toEqual([
        {
          value: 'claude-sonnet-4-5',
          label: 'Sonnet 4.5',
          description: 'Custom model (model)',
        },
      ]);
    });

    it('uses custom model aliases for environment-defined custom model labels', () => {
      const options = claudeChatUIConfig.getModelOptions({
        customModelAliases: {
          'claude-sonnet-4-5': 'Gateway Sonnet',
        },
        providerConfigs: {
          claude: {
            environmentVariables: 'ANTHROPIC_MODEL=claude-sonnet-4-5',
          },
        },
      });

      expect(options).toEqual([
        {
          value: 'claude-sonnet-4-5',
          label: 'Gateway Sonnet',
          description: 'Custom model (model)',
        },
      ]);
    });
  });

  describe('getReasoningOptions', () => {
    it('hides xhigh on models that do not support it', () => {
      const options = claudeChatUIConfig.getReasoningOptions('claude-sonnet-4-5', {});

      expect(options.map(option => option.value)).toEqual(['low', 'medium', 'high', 'max']);
    });

    it('keeps xhigh on supported opus models', () => {
      const options = claudeChatUIConfig.getReasoningOptions('claude-opus-4-7', {});

      expect(options.map(option => option.value)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    });

    it('uses effort options for custom model ids', () => {
      const options = claudeChatUIConfig.getReasoningOptions('custom-model', {});

      expect(options.map(option => option.value)).toEqual(['low', 'medium', 'high', 'max']);
      expect(options.some(option => option.tokens !== undefined)).toBe(false);
    });
  });

  describe('resolveClaudeModelSelection', () => {
    it('falls back to the Claude Code project settings model before saved built-ins', () => {
      const settings = {
        providerConfigs: {
          claude: {
            lastModel: 'sonnet',
            respectProjectSettings: true,
            projectSettingsSnapshot: {
              model: 'settings-json-model',
              env: {},
            },
          },
        },
      };

      expect(resolveClaudeModelSelection(settings, 'removed-custom-model')).toBe('settings-json-model');
    });
  });

  describe('applyModelDefaults', () => {
    it('clamps stale xhigh effort when switching to a custom sonnet model', () => {
      const settings: Record<string, unknown> = {
        effortLevel: 'xhigh',
        providerConfigs: {},
      };

      claudeChatUIConfig.applyModelDefaults('claude-sonnet-4-5', settings);

      expect(settings.effortLevel).toBe('high');
      expect(settings.lastCustomModel).toBe('claude-sonnet-4-5');
    });

    it('preserves xhigh on custom opus models that support it', () => {
      const settings: Record<string, unknown> = {
        effortLevel: 'xhigh',
        providerConfigs: {},
      };

      claudeChatUIConfig.applyModelDefaults('claude-opus-4-7', settings);

      expect(settings.effortLevel).toBe('xhigh');
    });

    it('uses high as the default for the built-in Opus alias', () => {
      const settings: Record<string, unknown> = {
        effortLevel: 'xhigh',
        providerConfigs: {},
      };

      claudeChatUIConfig.applyModelDefaults('opus', settings);

      expect(settings.effortLevel).toBe('high');
    });
  });
});
