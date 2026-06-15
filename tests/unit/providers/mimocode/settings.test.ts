const mockGetHostnameKey = jest.fn(() => 'host-a');
const mockGetLegacyHostnameKey = jest.fn(() => 'legacy-host');

jest.mock('../../../../src/utils/env', () => ({
  ...jest.requireActual('../../../../src/utils/env'),
  getHostnameKey: () => mockGetHostnameKey(),
  getLegacyHostnameKey: () => mockGetLegacyHostnameKey(),
}));

import {
  DEFAULT_MIMOCODE_PROVIDER_SETTINGS,
  getMimocodeProviderSettings,
  normalizeMimocodeModelAliases,
  normalizeMimocodePreferredThinkingByModel,
  normalizeMimocodeVisibleModels,
  updateMimocodeProviderSettings,
} from '../../../../src/providers/mimocode/settings';

describe('MiMoCode settings normalization', () => {
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

  it('enables Exa-backed web search in the default provider env', () => {
    expect(DEFAULT_MIMOCODE_PROVIDER_SETTINGS.environmentVariables).toBe('MIMOCODE_ENABLE_EXA=1');
  });

  it('normalizes visible models to base model ids', () => {
    expect(normalizeMimocodeVisibleModels([
      'anthropic/claude-sonnet-4/high',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ], discoveredModels)).toEqual([
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ]);
  });

  it('normalizes preferred thinking keys to base model ids', () => {
    expect(normalizeMimocodePreferredThinkingByModel({
      'anthropic/claude-sonnet-4/high': 'high',
      'google/gemini-2.5-pro': 'max',
    }, discoveredModels)).toEqual({
      'anthropic/claude-sonnet-4': 'high',
      'google/gemini-2.5-pro': 'max',
    });
  });

  it('hydrates provider settings with normalized base models and preferred thinking', () => {
    expect(getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
          cliPath: '/legacy/mimocode',
          cliPathsByHost: {
            'host-a': '/host-a/mimocode',
            'host-b': '/host-b/mimocode',
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
      cliPath: '/legacy/mimocode',
      cliPathsByHost: {
        'host-a': '/host-a/mimocode',
        'host-b': '/host-b/mimocode',
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

    const settings = getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
          cliPathsByHost: {
            'host-a': '/host-a/mimocode',
            'host-b': '/host-b/mimocode',
          },
        },
      },
    });

    expect(settings.cliPathsByHost).toEqual({
      'device:current': '/host-a/mimocode',
      'host-b': '/host-b/mimocode',
    });
  });

  it('normalizes model aliases to base model ids and trims values', () => {
    expect(normalizeMimocodeModelAliases({
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
    expect(normalizeMimocodeModelAliases(null, discoveredModels)).toEqual({});
    expect(normalizeMimocodeModelAliases(['alias'], discoveredModels)).toEqual({});
    expect(normalizeMimocodeModelAliases({ 'anthropic/claude-sonnet-4': 123 }, discoveredModels)).toEqual({});
  });

  it('prunes aliases whose rawId is no longer visible when updating settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
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

    const next = updateMimocodeProviderSettings(settings, {
      visibleModels: ['anthropic/claude-sonnet-4'],
    });

    expect(next.visibleModels).toEqual(['anthropic/claude-sonnet-4']);
    expect(next.modelAliases).toEqual({ 'anthropic/claude-sonnet-4': 'Sonnet' });
    expect((settings.providerConfigs as Record<string, any>).mimocode.discoveredModels).toBeUndefined();
  });

  it('falls back active and saved MiMoCode selections when the current model is removed from visible models', () => {
    const settings: Record<string, unknown> = {
      effortLevel: 'high',
      model: 'mimocode:google/gemini-2.5-pro',
      providerConfigs: {
        mimocode: {
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
        mimocode: 'high',
      },
      savedProviderModel: {
        mimocode: 'mimocode:google/gemini-2.5-pro',
      },
      titleGenerationModel: 'mimocode:google/gemini-2.5-pro',
    };

    const next = updateMimocodeProviderSettings(settings, {
      visibleModels: ['openai/gpt-5'],
    });

    expect(next.visibleModels).toEqual(['openai/gpt-5']);
    expect(settings.model).toBe('mimocode:openai/gpt-5');
    expect(settings.effortLevel).toBe('high');
    expect((settings.savedProviderModel as Record<string, string>).mimocode).toBe('mimocode:openai/gpt-5');
    expect((settings.savedProviderEffort as Record<string, string>).mimocode).toBe('high');
    expect(settings.titleGenerationModel).toBe('mimocode:openai/gpt-5');
  });

  it('clears the MiMoCode title model when all visible models are removed', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          discoveredModels,
          visibleModels: ['google/gemini-2.5-pro'],
        },
      },
      titleGenerationModel: 'mimocode:google/gemini-2.5-pro',
    };

    const next = updateMimocodeProviderSettings(settings, {
      visibleModels: [],
    });

    expect(next.visibleModels).toEqual([]);
    expect(settings.titleGenerationModel).toBe('');
  });

  it('keeps runtime discovery in memory when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          availableModes: [
            { id: 'build', name: 'Build' },
          ],
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
    };

    const next = updateMimocodeProviderSettings(settings, {
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
    expect((settings.providerConfigs as Record<string, any>).mimocode.availableModes).toBeUndefined();
    expect((settings.providerConfigs as Record<string, any>).mimocode.discoveredModels).toBeUndefined();
  });

  it('persists thinking options only for visible or selected MiMoCode models', () => {
    const settings: Record<string, unknown> = {
      model: 'mimocode:google/gemini-2.5-pro',
      providerConfigs: {
        mimocode: {
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
      savedProviderModel: {
        mimocode: 'mimocode:google/gemini-2.5-pro',
      },
    };

    const next = updateMimocodeProviderSettings(settings, {
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
    expect((settings.providerConfigs as Record<string, any>).mimocode.thinkingOptionsByModel).toEqual({
      'anthropic/claude-sonnet-4': [
        { label: 'High', value: 'high' },
      ],
      'google/gemini-2.5-pro': [
        { label: 'Low', value: 'low' },
      ],
    });
    expect((settings.providerConfigs as Record<string, any>).mimocode.discoveredModels).toBeUndefined();
  });

  it('hydrates persisted thinking options without requiring the full discovered model catalog', () => {
    const settings = getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
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
        mimocode: {
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

    updateMimocodeProviderSettings(settings, {
      environmentHash: 'MIMOCODE_DB=/tmp/mimocode.db',
    });

    expect((settings.providerConfigs as Record<string, any>).mimocode.thinkingOptionsByModel).toEqual({
      'deepseek/deepseek-v4-pro': [
        { label: 'Low', value: 'low' },
        { label: 'Max', value: 'max' },
      ],
    });
  });

  it('normalizes saved custom MiMoCode modes back to the managed full-access mode', () => {
    expect(getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
          availableModes: [],
          selectedMode: 'compaction',
        },
      },
    }).selectedMode).toBe('grimoire-full-access');
  });

  it('normalizes the legacy build alias back to the managed full-access mode', () => {
    expect(getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
          availableModes: [],
          selectedMode: 'build',
        },
      },
    }).selectedMode).toBe('grimoire-full-access');
  });

  it('preserves legacy cliPath when no host-scoped path exists', () => {
    expect(getMimocodeProviderSettings({
      providerConfigs: {
        mimocode: {
          cliPath: '/legacy/mimocode',
          cliPathsByHost: {
            'host-b': '/other-host/mimocode',
          },
        },
      },
    })).toMatchObject({
      cliPath: '/legacy/mimocode',
      cliPathsByHost: {
        'host-b': '/other-host/mimocode',
      },
    });
  });

  it('writes host-scoped cli paths when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          cliPath: '/legacy/mimocode',
        },
      },
    };

    const next = updateMimocodeProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/mimocode',
      },
    });

    expect(next.cliPathsByHost).toEqual({
      'host-a': '/custom/mimocode',
    });
    expect((settings.providerConfigs as Record<string, any>).mimocode.cliPathsByHost).toEqual({
      'host-a': '/custom/mimocode',
    });
  });

  it('preserves legacy cliPath when applying a full settings snapshot', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          cliPath: '/legacy/mimocode',
          cliPathsByHost: {
            'host-b': '/other-host/mimocode',
          },
        },
      },
    };

    const snapshot = getMimocodeProviderSettings(settings);
    const next = updateMimocodeProviderSettings(settings, snapshot);

    expect(next.cliPath).toBe('/legacy/mimocode');
    expect((settings.providerConfigs as Record<string, any>).mimocode).toMatchObject({
      cliPath: '/legacy/mimocode',
      cliPathsByHost: {
        'host-b': '/other-host/mimocode',
      },
    });
  });

  it('drops the legacy cliPath once host-scoped paths are explicitly edited', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          cliPath: '/legacy/mimocode',
        },
      },
    };

    const next = updateMimocodeProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/mimocode',
      },
    });

    expect(next.cliPath).toBe('');
    expect((settings.providerConfigs as Record<string, any>).mimocode.cliPath).toBe('');

    const cleared = updateMimocodeProviderSettings(settings, {
      cliPathsByHost: {},
    });

    expect(cleared.cliPath).toBe('');
    expect(cleared.cliPathsByHost).toEqual({});
    expect((settings.providerConfigs as Record<string, any>).mimocode).toMatchObject({
      cliPath: '',
      cliPathsByHost: {},
    });
  });
});
