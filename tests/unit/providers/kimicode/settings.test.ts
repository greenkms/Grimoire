const mockGetHostnameKey = jest.fn(() => 'host-a');
const mockGetLegacyHostnameKey = jest.fn(() => 'legacy-host');

jest.mock('../../../../src/utils/env', () => ({
  ...jest.requireActual('../../../../src/utils/env'),
  getHostnameKey: () => mockGetHostnameKey(),
  getLegacyHostnameKey: () => mockGetLegacyHostnameKey(),
}));

import {
  DEFAULT_KIMICODE_PROVIDER_SETTINGS,
  getKimicodeProviderSettings,
  normalizeKimicodeModelAliases,
  normalizeKimicodePreferredThinkingByModel,
  normalizeKimicodeVisibleModels,
  updateKimicodeProviderSettings,
} from '../../../../src/providers/kimicode/settings';

describe('Kimi Code settings normalization', () => {
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
    expect(DEFAULT_KIMICODE_PROVIDER_SETTINGS.environmentVariables).toBe('KIMICODE_ENABLE_EXA=1');
  });

  it('normalizes visible models to base model ids', () => {
    expect(normalizeKimicodeVisibleModels([
      'anthropic/claude-sonnet-4/high',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ], discoveredModels)).toEqual([
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
    ]);
  });

  it('normalizes preferred thinking keys to base model ids', () => {
    expect(normalizeKimicodePreferredThinkingByModel({
      'anthropic/claude-sonnet-4/high': 'high',
      'google/gemini-2.5-pro': 'max',
    }, discoveredModels)).toEqual({
      'anthropic/claude-sonnet-4': 'high',
      'google/gemini-2.5-pro': 'max',
    });
  });

  it('hydrates provider settings with normalized base models and preferred thinking', () => {
    expect(getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
          cliPath: '/legacy/kimicode',
          cliPathsByHost: {
            'host-a': '/host-a/kimicode',
            'host-b': '/host-b/kimicode',
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
      cliPath: '/legacy/kimicode',
      cliPathsByHost: {
        'host-a': '/host-a/kimicode',
        'host-b': '/host-b/kimicode',
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

    const settings = getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
          cliPathsByHost: {
            'host-a': '/host-a/kimicode',
            'host-b': '/host-b/kimicode',
          },
        },
      },
    });

    expect(settings.cliPathsByHost).toEqual({
      'device:current': '/host-a/kimicode',
      'host-b': '/host-b/kimicode',
    });
  });

  it('normalizes model aliases to base model ids and trims values', () => {
    expect(normalizeKimicodeModelAliases({
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
    expect(normalizeKimicodeModelAliases(null, discoveredModels)).toEqual({});
    expect(normalizeKimicodeModelAliases(['alias'], discoveredModels)).toEqual({});
    expect(normalizeKimicodeModelAliases({ 'anthropic/claude-sonnet-4': 123 }, discoveredModels)).toEqual({});
  });

  it('prunes aliases whose rawId is no longer visible when updating settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
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

    const next = updateKimicodeProviderSettings(settings, {
      visibleModels: ['anthropic/claude-sonnet-4'],
    });

    expect(next.visibleModels).toEqual(['anthropic/claude-sonnet-4']);
    expect(next.modelAliases).toEqual({ 'anthropic/claude-sonnet-4': 'Sonnet' });
    expect((settings.providerConfigs as Record<string, any>).kimicode.discoveredModels).toBeUndefined();
  });

  it('falls back active and saved Kimi Code selections when the current model is removed from visible models', () => {
    const settings: Record<string, unknown> = {
      effortLevel: 'high',
      model: 'kimicode:google/gemini-2.5-pro',
      providerConfigs: {
        kimicode: {
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
        kimicode: 'high',
      },
      savedProviderModel: {
        kimicode: 'kimicode:google/gemini-2.5-pro',
      },
      titleGenerationModel: 'kimicode:google/gemini-2.5-pro',
    };

    const next = updateKimicodeProviderSettings(settings, {
      visibleModels: ['openai/gpt-5'],
    });

    expect(next.visibleModels).toEqual(['openai/gpt-5']);
    expect(settings.model).toBe('kimicode:openai/gpt-5');
    expect(settings.effortLevel).toBe('high');
    expect((settings.savedProviderModel as Record<string, string>).kimicode).toBe('kimicode:openai/gpt-5');
    expect((settings.savedProviderEffort as Record<string, string>).kimicode).toBe('high');
    expect(settings.titleGenerationModel).toBe('kimicode:openai/gpt-5');
  });

  it('clears the Kimi Code title model when all visible models are removed', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          discoveredModels,
          visibleModels: ['google/gemini-2.5-pro'],
        },
      },
      titleGenerationModel: 'kimicode:google/gemini-2.5-pro',
    };

    const next = updateKimicodeProviderSettings(settings, {
      visibleModels: [],
    });

    expect(next.visibleModels).toEqual([]);
    expect(settings.titleGenerationModel).toBe('');
  });

  it('keeps runtime discovery in memory when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          availableModes: [
            { id: 'build', name: 'Build' },
          ],
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
    };

    const next = updateKimicodeProviderSettings(settings, {
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
    expect((settings.providerConfigs as Record<string, any>).kimicode.availableModes).toBeUndefined();
    expect((settings.providerConfigs as Record<string, any>).kimicode.discoveredModels).toBeUndefined();
  });

  it('persists thinking options only for visible or selected Kimi Code models', () => {
    const settings: Record<string, unknown> = {
      model: 'kimicode:google/gemini-2.5-pro',
      providerConfigs: {
        kimicode: {
          discoveredModels,
          visibleModels: ['anthropic/claude-sonnet-4'],
        },
      },
      savedProviderModel: {
        kimicode: 'kimicode:google/gemini-2.5-pro',
      },
    };

    const next = updateKimicodeProviderSettings(settings, {
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
    expect((settings.providerConfigs as Record<string, any>).kimicode.thinkingOptionsByModel).toEqual({
      'anthropic/claude-sonnet-4': [
        { label: 'High', value: 'high' },
      ],
      'google/gemini-2.5-pro': [
        { label: 'Low', value: 'low' },
      ],
    });
    expect((settings.providerConfigs as Record<string, any>).kimicode.discoveredModels).toBeUndefined();
  });

  it('hydrates persisted thinking options without requiring the full discovered model catalog', () => {
    const settings = getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
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
        kimicode: {
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

    updateKimicodeProviderSettings(settings, {
      environmentHash: 'KIMICODE_DB=/tmp/kimicode.db',
    });

    expect((settings.providerConfigs as Record<string, any>).kimicode.thinkingOptionsByModel).toEqual({
      'deepseek/deepseek-v4-pro': [
        { label: 'Low', value: 'low' },
        { label: 'Max', value: 'max' },
      ],
    });
  });

  it('normalizes saved custom Kimi Code modes back to the managed full-access mode', () => {
    expect(getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
          availableModes: [],
          selectedMode: 'compaction',
        },
      },
    }).selectedMode).toBe('auto');
  });

  it('normalizes the legacy build alias back to the managed full-access mode', () => {
    expect(getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
          availableModes: [],
          selectedMode: 'build',
        },
      },
    }).selectedMode).toBe('auto');
  });

  it('preserves legacy cliPath when no host-scoped path exists', () => {
    expect(getKimicodeProviderSettings({
      providerConfigs: {
        kimicode: {
          cliPath: '/legacy/kimicode',
          cliPathsByHost: {
            'host-b': '/other-host/kimicode',
          },
        },
      },
    })).toMatchObject({
      cliPath: '/legacy/kimicode',
      cliPathsByHost: {
        'host-b': '/other-host/kimicode',
      },
    });
  });

  it('writes host-scoped cli paths when updating provider settings', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          cliPath: '/legacy/kimicode',
        },
      },
    };

    const next = updateKimicodeProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/kimicode',
      },
    });

    expect(next.cliPathsByHost).toEqual({
      'host-a': '/custom/kimicode',
    });
    expect((settings.providerConfigs as Record<string, any>).kimicode.cliPathsByHost).toEqual({
      'host-a': '/custom/kimicode',
    });
  });

  it('preserves legacy cliPath when applying a full settings snapshot', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          cliPath: '/legacy/kimicode',
          cliPathsByHost: {
            'host-b': '/other-host/kimicode',
          },
        },
      },
    };

    const snapshot = getKimicodeProviderSettings(settings);
    const next = updateKimicodeProviderSettings(settings, snapshot);

    expect(next.cliPath).toBe('/legacy/kimicode');
    expect((settings.providerConfigs as Record<string, any>).kimicode).toMatchObject({
      cliPath: '/legacy/kimicode',
      cliPathsByHost: {
        'host-b': '/other-host/kimicode',
      },
    });
  });

  it('drops the legacy cliPath once host-scoped paths are explicitly edited', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          cliPath: '/legacy/kimicode',
        },
      },
    };

    const next = updateKimicodeProviderSettings(settings, {
      cliPathsByHost: {
        'host-a': '/custom/kimicode',
      },
    });

    expect(next.cliPath).toBe('');
    expect((settings.providerConfigs as Record<string, any>).kimicode.cliPath).toBe('');

    const cleared = updateKimicodeProviderSettings(settings, {
      cliPathsByHost: {},
    });

    expect(cleared.cliPath).toBe('');
    expect(cleared.cliPathsByHost).toEqual({});
    expect((settings.providerConfigs as Record<string, any>).kimicode).toMatchObject({
      cliPath: '',
      cliPathsByHost: {},
    });
  });
});
