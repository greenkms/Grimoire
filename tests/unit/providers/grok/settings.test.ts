const mockGetHostnameKey = jest.fn(() => 'host-a');
const mockGetLegacyHostnameKey = jest.fn(() => 'legacy-host');

jest.mock('../../../../src/utils/env', () => ({
  ...jest.requireActual('../../../../src/utils/env'),
  getHostnameKey: () => mockGetHostnameKey(),
  getLegacyHostnameKey: () => mockGetLegacyHostnameKey(),
}));

import {
  DEFAULT_GROK_PROVIDER_SETTINGS,
  getGrokProviderSettings,
  normalizeGrokModelAliases,
  normalizeGrokPreferredThinkingByModel,
  normalizeGrokVisibleModels,
  updateGrokProviderSettings,
} from '../../../../src/providers/grok/settings';

describe('Grok Build settings normalization', () => {
  const discoveredModels = [
    { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
    { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
    { label: 'Google/Gemini 2.5 Pro', rawId: 'google/gemini-2.5-pro' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHostnameKey.mockReturnValue('host-a');
    mockGetLegacyHostnameKey.mockReturnValue('legacy-host');
  });

  it('starts with an empty default provider env', () => {
    expect(DEFAULT_GROK_PROVIDER_SETTINGS.environmentVariables).toBe('');
  });

  it('normalizes visible models to base model ids', () => {
    expect(normalizeGrokVisibleModels([
      'anthropic/claude-sonnet-4/high',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ], discoveredModels)).toEqual([
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ]);
  });

  it('normalizes preferred thinking keys to base model ids', () => {
    expect(normalizeGrokPreferredThinkingByModel({
      'anthropic/claude-sonnet-4/high': 'high',
      'google/gemini-2.5-pro': 'max',
    }, discoveredModels)).toEqual({
      'anthropic/claude-sonnet-4': 'high',
      'google/gemini-2.5-pro': 'max',
    });
  });

  it('hydrates provider settings with normalized base models and preferred thinking', () => {
    expect(getGrokProviderSettings({
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
          cliPathsByHost: {
            'host-a': '/host-a/grok',
            'host-b': '/host-b/grok',
          },
          discoveredModels,
          preferredThinkingByModel: {
            'anthropic/claude-sonnet-4/high': 'high',
          },
          visibleModels: [
            'anthropic/claude-sonnet-4/high',
            'google/gemini-2.5-pro',
          ],
        },
      },
    })).toMatchObject({
      preferredThinkingByModel: {
        'anthropic/claude-sonnet-4': 'high',
      },
      cliPath: '/legacy/grok',
      cliPathsByHost: {
        'host-a': '/host-a/grok',
        'host-b': '/host-b/grok',
      },
      visibleModels: [
        'anthropic/claude-sonnet-4',
        'google/gemini-2.5-pro',
      ],
    });
  });

  it('migrates current legacy hostname-scoped CLI paths to the opaque device key', () => {
    mockGetHostnameKey.mockReturnValue('device:current');
    mockGetLegacyHostnameKey.mockReturnValue('host-a');

    const settings = getGrokProviderSettings({
      providerConfigs: {
        grok: {
          cliPathsByHost: {
            'host-a': '/host-a/grok',
            'host-b': '/host-b/grok',
          },
        },
      },
    });

    expect(settings.cliPathsByHost).toEqual({
      'device:current': '/host-a/grok',
      'host-b': '/host-b/grok',
    });
  });

  it('normalizes model aliases to base model ids and trims values', () => {
    expect(normalizeGrokModelAliases({
      'anthropic/claude-sonnet-4/high': '  Sonnet  ',
      'google/gemini-2.5-pro': 'Gemini Pro',
      'unknown/model': 'ignored',
      'anthropic/claude-sonnet-4': '',
    }, discoveredModels)).toEqual({
      'anthropic/claude-sonnet-4': 'Sonnet',
      'google/gemini-2.5-pro': 'Gemini Pro',
      'unknown/model': 'ignored',
    });
  });

  it('ignores non-string and non-object alias payloads', () => {
    expect(normalizeGrokModelAliases(null, discoveredModels)).toEqual({});
    expect(normalizeGrokModelAliases(['alias'], discoveredModels)).toEqual({});
    expect(normalizeGrokModelAliases({ 'anthropic/claude-sonnet-4': 123 }, discoveredModels)).toEqual({});
  });

  it('prunes aliases whose rawId is no longer visible when updating settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          discoveredModels,
          modelAliases: {
            'anthropic/claude-sonnet-4': 'Sonnet',
            'google/gemini-2.5-pro': 'Gemini',
          },
          visibleModels: [
            'anthropic/claude-sonnet-4',
            'google/gemini-2.5-pro',
          ],
        },
      },
    };

    const next = updateGrokProviderSettings(settings, {
      visibleModels: ['anthropic/claude-sonnet-4'],
    });

    expect(next.visibleModels).toEqual(['anthropic/claude-sonnet-4']);
    expect(next.modelAliases).toEqual({ 'anthropic/claude-sonnet-4': 'Sonnet' });
    expect((settings.providerConfigs as Record<string, any>).grok.discoveredModels).toBeUndefined();
  });

  it('falls back active and saved Grok Build selections when the current model is removed from visible models', () => {
    const settings: Record<string, unknown> = {
      effortLevel: 'high',
      model: 'grok:google/gemini-2.5-pro',
      providerConfigs: {
        grok: {
          discoveredModels: [
            ...discoveredModels,
            { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
            { label: 'OpenAI/GPT-5 (high)', rawId: 'openai/gpt-5/high' },
          ],
          preferredThinkingByModel: {
            'openai/gpt-5': 'high',
          },
          visibleModels: [
            'google/gemini-2.5-pro',
            'openai/gpt-5',
          ],
        },
      },
      savedProviderEffort: {
        grok: 'high',
      },
      savedProviderModel: {
        grok: 'grok:google/gemini-2.5-pro',
      },
      titleGenerationModel: 'grok:google/gemini-2.5-pro',
    };

    const next = updateGrokProviderSettings(settings, {
      visibleModels: ['openai/gpt-5'],
    });

    expect(next.visibleModels).toEqual(['openai/gpt-5']);
    expect(settings.model).toBe('grok:openai/gpt-5');
    expect(settings.effortLevel).toBe('high');
    expect((settings.savedProviderModel as Record<string, string>).grok).toBe('grok:openai/gpt-5');
    expect((settings.savedProviderEffort as Record<string, string>).grok).toBe('high');
    expect(settings.titleGenerationModel).toBe('grok:openai/gpt-5');
  });

  it('clears the Grok Build title model when all visible models are removed', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          discoveredModels,
          visibleModels: ['google/gemini-2.5-pro'],
        },
      },
      titleGenerationModel: 'grok:google/gemini-2.5-pro',
    };

    const next = updateGrokProviderSettings(settings, {
      visibleModels: [],
    });

    expect(next.visibleModels).toEqual([]);
    expect(settings.titleGenerationModel).toBe('');
  });

  it('keeps runtime discovery in memory when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          availableModes: [
            { id: 'build', name: 'Build' },
          ],
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
    };

    const next = updateGrokProviderSettings(settings, {
      availableModes: [
        { id: 'build', name: 'Build' },
        { id: 'plan', name: 'Plan' },
      ],
      discoveredModels: [
        ...discoveredModels,
        { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
      ],
    });

    expect(next.availableModes).toEqual([
      { id: 'build', name: 'Build' },
      { id: 'plan', name: 'Plan' },
    ]);
    expect(next.discoveredModels).toEqual([
      ...discoveredModels,
      { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
    ]);
    expect((settings.providerConfigs as Record<string, any>).grok.availableModes).toBeUndefined();
    expect((settings.providerConfigs as Record<string, any>).grok.discoveredModels).toBeUndefined();
  });

  it('persists thinking options only for visible or selected Grok Build models', () => {
    const settings: Record<string, unknown> = {
      model: 'grok:google/gemini-2.5-pro',
      providerConfigs: {
        grok: {
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
      savedProviderModel: {
        grok: 'grok:google/gemini-2.5-pro',
      },
    };

    const next = updateGrokProviderSettings(settings, {
      thinkingOptionsByModel: {
        'anthropic/claude-sonnet-4': [
          { label: 'High', value: 'high' },
        ],
        'google/gemini-2.5-pro': [
          { label: 'Low', value: 'low' },
        ],
        'openai/gpt-5': [
          { label: 'Max', value: 'max' },
        ],
      },
    });

    expect(next.thinkingOptionsByModel).toMatchObject({
      'anthropic/claude-sonnet-4': [
        { label: 'High', value: 'high' },
      ],
      'google/gemini-2.5-pro': [
        { label: 'Low', value: 'low' },
      ],
    });
    expect((settings.providerConfigs as Record<string, any>).grok.thinkingOptionsByModel).toEqual({
      'anthropic/claude-sonnet-4': [
        { label: 'High', value: 'high' },
      ],
      'google/gemini-2.5-pro': [
        { label: 'Low', value: 'low' },
      ],
    });
    expect((settings.providerConfigs as Record<string, any>).grok.discoveredModels).toBeUndefined();
  });

  it('hydrates persisted thinking options without requiring the full discovered model catalog', () => {
    const settings = getGrokProviderSettings({
      providerConfigs: {
        grok: {
          thinkingOptionsByModel: {
            'deepseek/deepseek-v4-pro': [
              { label: 'Low', value: 'low' },
              { label: 'Max', value: 'max' },
            ],
          },
          visibleModels: ['deepseek/deepseek-v4-pro'],
        },
      },
    });

    expect(settings.discoveredModels).toEqual([]);
    expect(settings.thinkingOptionsByModel).toEqual({
      'deepseek/deepseek-v4-pro': [
        { label: 'Low', value: 'low' },
        { label: 'Max', value: 'max' },
      ],
    });
  });

  it('preserves persisted thinking options when unrelated provider settings are updated', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          environmentHash: '',
          thinkingOptionsByModel: {
            'deepseek/deepseek-v4-pro': [
              { label: 'Low', value: 'low' },
              { label: 'Max', value: 'max' },
            ],
          },
          visibleModels: ['deepseek/deepseek-v4-pro'],
        },
      },
    };

    updateGrokProviderSettings(settings, {
      environmentHash: 'GROK_DB=/tmp/grok.db',
    });

    expect((settings.providerConfigs as Record<string, any>).grok.thinkingOptionsByModel).toEqual({
      'deepseek/deepseek-v4-pro': [
        { label: 'Low', value: 'low' },
        { label: 'Max', value: 'max' },
      ],
    });
  });

  it('normalizes saved custom Grok Build modes back to the managed full-access mode', () => {
    expect(getGrokProviderSettings({
      providerConfigs: {
        grok: {
          availableModes: [],
          selectedMode: 'compaction',
        },
      },
    }).selectedMode).toBe('grimoire-full-access');
  });

  it('normalizes the legacy build alias back to the managed full-access mode', () => {
    expect(getGrokProviderSettings({
      providerConfigs: {
        grok: {
          availableModes: [],
          selectedMode: 'build',
        },
      },
    }).selectedMode).toBe('grimoire-full-access');
  });

  it('preserves legacy cliPath when no host-scoped path exists', () => {
    expect(getGrokProviderSettings({
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
          cliPathsByHost: {
            'host-b': '/other-host/grok',
          },
        },
      },
    })).toMatchObject({
      cliPath: '/legacy/grok',
      cliPathsByHost: {
        'host-b': '/other-host/grok',
      },
    });
  });

  it('writes host-scoped cli paths when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
        },
      },
    };

    const next = updateGrokProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/grok',
      },
    });

    expect(next.cliPathsByHost).toEqual({
      'host-a': '/custom/grok',
    });
    expect((settings.providerConfigs as Record<string, any>).grok.cliPathsByHost).toEqual({
      'host-a': '/custom/grok',
    });
  });

  it('preserves legacy cliPath when applying a full settings snapshot', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
          cliPathsByHost: {
            'host-b': '/other-host/grok',
          },
        },
      },
    };

    const snapshot = getGrokProviderSettings(settings);
    const next = updateGrokProviderSettings(settings, snapshot);

    expect(next.cliPath).toBe('/legacy/grok');
    expect((settings.providerConfigs as Record<string, any>).grok).toMatchObject({
      cliPath: '/legacy/grok',
      cliPathsByHost: {
        'host-b': '/other-host/grok',
      },
    });
  });

  it('drops the legacy cliPath once host-scoped paths are explicitly edited', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
        },
      },
    };

    const next = updateGrokProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/grok',
      },
    });

    expect(next.cliPath).toBe('');
    expect((settings.providerConfigs as Record<string, any>).grok.cliPath).toBe('');

    const cleared = updateGrokProviderSettings(settings, {
      cliPathsByHost: {},
    });

    expect(cleared.cliPath).toBe('');
    expect(cleared.cliPathsByHost).toEqual({});
    expect((settings.providerConfigs as Record<string, any>).grok).toMatchObject({
      cliPath: '',
      cliPathsByHost: {},
    });
  });
});
