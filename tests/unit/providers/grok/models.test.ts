import {
  buildGrokBaseModels,
  combineGrokRawModelSelection,
  decodeGrokModelId,
  encodeGrokModelId,
  extractGrokModelVariantValue,
  getGrokModelVariants,
  groupGrokDiscoveredModels,
  isGrokModelSelectionId,
  GROK_DEFAULT_THINKING_LEVEL,
  GROK_SYNTHETIC_MODEL_ID,
  resolveGrokBaseModelRawId,
  splitGrokModelLabel,
} from '../../../../src/providers/grok/models';
import { grokChatUIConfig } from '../../../../src/providers/grok/ui/GrokChatUIConfig';

describe('Grok Build model identity', () => {
  it('namespaces provider-owned model ids for the shared selector', () => {
    expect(encodeGrokModelId('anthropic/claude-sonnet-4')).toBe('grok:anthropic/claude-sonnet-4');
    expect(decodeGrokModelId('grok:anthropic/claude-sonnet-4')).toBe('anthropic/claude-sonnet-4');
    expect(decodeGrokModelId(GROK_SYNTHETIC_MODEL_ID)).toBeNull();
    expect(isGrokModelSelectionId('grok:anthropic/claude-sonnet-4')).toBe(true);
    expect(isGrokModelSelectionId('claude-sonnet-4')).toBe(false);
  });
});

describe('Grok Build base model derivation', () => {
  const discoveredModels = [
    { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
    { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
    { label: 'Anthropic/Claude Sonnet 4 (max)', rawId: 'anthropic/claude-sonnet-4/max' },
    { label: 'Google/Gemini 2.5 Pro', rawId: 'google/gemini-2.5-pro' },
  ];

  it('collapses discovered variants into base models', () => {
    expect(buildGrokBaseModels(discoveredModels)).toEqual([
      {
        label: 'Anthropic/Claude Sonnet 4',
        rawId: 'anthropic/claude-sonnet-4',
        variants: [
          { label: 'High', value: 'high' },
          { label: 'Max', value: 'max' },
        ],
      },
      {
        label: 'Google/Gemini 2.5 Pro',
        rawId: 'google/gemini-2.5-pro',
        variants: [],
      },
    ]);
  });

  it('sorts thinking variants by semantic effort instead of alphabetically', () => {
    expect(buildGrokBaseModels([
      { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
      { label: 'OpenAI/GPT-5 (xhigh)', rawId: 'openai/gpt-5/xhigh' },
      { label: 'OpenAI/GPT-5 (medium)', rawId: 'openai/gpt-5/medium' },
      { label: 'OpenAI/GPT-5 (low)', rawId: 'openai/gpt-5/low' },
      { label: 'OpenAI/GPT-5 (high)', rawId: 'openai/gpt-5/high' },
      { label: 'OpenAI/GPT-5 (max)', rawId: 'openai/gpt-5/max' },
    ])).toEqual([
      {
        label: 'OpenAI/GPT-5',
        rawId: 'openai/gpt-5',
        variants: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Max', value: 'max' },
          { label: 'XHigh', value: 'xhigh' },
        ],
      },
    ]);
  });

  it('extracts and combines thinking variants from discovered model ids', () => {
    expect(resolveGrokBaseModelRawId(
      'anthropic/claude-sonnet-4/high',
      discoveredModels,
    )).toBe('anthropic/claude-sonnet-4');
    expect(extractGrokModelVariantValue(
      'anthropic/claude-sonnet-4/high',
      discoveredModels,
    )).toBe('high');
    expect(getGrokModelVariants(
      'anthropic/claude-sonnet-4',
      discoveredModels,
    )).toEqual([
      { label: 'High', value: 'high' },
      { label: 'Max', value: 'max' },
    ]);
    expect(combineGrokRawModelSelection(
      'anthropic/claude-sonnet-4',
      'high',
      discoveredModels,
    )).toBe('anthropic/claude-sonnet-4/high');
    expect(combineGrokRawModelSelection(
      'anthropic/claude-sonnet-4',
      GROK_DEFAULT_THINKING_LEVEL,
      discoveredModels,
    )).toBe('anthropic/claude-sonnet-4');
  });
});

describe('grokChatUIConfig', () => {
  it('keeps visible Grok Build model order stable and appends saved variant selections only when absent', () => {
    const options = grokChatUIConfig.getModelOptions({
      model: 'haiku',
      providerConfigs: {
        grok: {
          discoveredModels: [
            { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
            { label: 'OpenAI/GPT-5 (high)', rawId: 'openai/gpt-5/high' },
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
            { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
          ],
          visibleModels: [
            'openai/gpt-5',
          ],
          preferredThinkingByModel: {
            'anthropic/claude-sonnet-4': 'high',
          },
        },
      },
      savedProviderModel: {
        grok: 'grok:anthropic/claude-sonnet-4/high',
      },
    });

    expect(options).toEqual([
      {
        description: 'ACP runtime',
        label: 'OpenAI/GPT-5',
        value: 'grok:openai/gpt-5',
      },
      {
        description: 'ACP runtime',
        label: 'Anthropic/Claude Sonnet 4',
        value: 'grok:anthropic/claude-sonnet-4',
      },
    ]);
  });

  it('uses modelAliases to override the label in model selector options', () => {
    const options = grokChatUIConfig.getModelOptions({
      providerConfigs: {
        grok: {
          discoveredModels: [
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
            { label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' },
          ],
          modelAliases: {
            'anthropic/claude-sonnet-4': 'Sonnet',
          },
          visibleModels: [
            'anthropic/claude-sonnet-4',
            'openai/gpt-5',
          ],
        },
      },
    });

    expect(options).toEqual([
      {
        description: 'ACP runtime',
        label: 'Sonnet',
        value: 'grok:anthropic/claude-sonnet-4',
      },
      {
        description: 'ACP runtime',
        label: 'OpenAI/GPT-5',
        value: 'grok:openai/gpt-5',
      },
    ]);
  });

  it('shows configured base model ids even before discovery finishes', () => {
    expect(grokChatUIConfig.getModelOptions({
      providerConfigs: {
        grok: {
          visibleModels: [
            'google/gemini-2.5-pro',
          ],
        },
      },
    })).toEqual([
      {
        description: 'Configured model',
        label: 'google/gemini-2.5-pro',
        value: 'grok:google/gemini-2.5-pro',
      },
    ]);
  });

  it('falls back to the synthetic entry before models are discovered', () => {
    expect(grokChatUIConfig.getModelOptions({})).toEqual([
      { description: 'ACP runtime', label: 'Grok Build', value: 'grok' },
    ]);
  });

  it('returns per-model thinking options from ACP thought-level discovery', () => {
    const settings = {
      model: 'grok:anthropic/claude-sonnet-4',
      providerConfigs: {
        grok: {
          discoveredModels: [
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
          ],
          preferredThinkingByModel: {
            'anthropic/claude-sonnet-4': 'max',
          },
          thinkingOptionsByModel: {
            'anthropic/claude-sonnet-4': [
              { label: 'Low', value: 'low' },
              { label: 'High', value: 'high' },
              { label: 'Max', value: 'max' },
            ],
          },
        },
      },
    };

    expect(grokChatUIConfig.getReasoningOptions(
      'grok:anthropic/claude-sonnet-4',
      settings,
    )).toEqual([
      { label: 'Low', value: 'low' },
      { label: 'High', value: 'high' },
      { label: 'Max', value: 'max' },
    ]);
    expect(grokChatUIConfig.getDefaultReasoningValue(
      'grok:anthropic/claude-sonnet-4',
      settings,
    )).toBe('max');
  });

  it('keeps at least three Grok Build effort choices before thought-level discovery finishes', () => {
    const settings = {
      model: 'grok:minimax-token-plan/minimax-m2',
      providerConfigs: {
        grok: {
          discoveredModels: [
            { label: 'MiniMax Token Plan (minimax.io)/MiniMax-M2', rawId: 'minimax-token-plan/minimax-m2' },
          ],
          visibleModels: ['minimax-token-plan/minimax-m2'],
          thinkingOptionsByModel: {},
        },
      },
    };

    expect(grokChatUIConfig.isAdaptiveReasoningModel(
      'grok:minimax-token-plan/minimax-m2',
      settings,
    )).toBe(true);
    expect(grokChatUIConfig.getReasoningOptions(
      'grok:minimax-token-plan/minimax-m2',
      settings,
    )).toEqual([
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
    ]);
    expect(grokChatUIConfig.getDefaultReasoningValue(
      'grok:minimax-token-plan/minimax-m2',
      settings,
    )).toBe('high');
  });
});

describe('Grok Build discovered model grouping', () => {
  it('splits provider and model labels for grouped picker rendering', () => {
    expect(splitGrokModelLabel('Google/Gemini 2.5 Flash')).toEqual({
      modelLabel: 'Gemini 2.5 Flash',
      providerLabel: 'Google',
    });
    expect(splitGrokModelLabel('standalone-model')).toEqual({
      modelLabel: 'standalone-model',
      providerLabel: 'Other',
    });
  });

  it('groups discovered models by provider label', () => {
    expect(groupGrokDiscoveredModels([
      { label: 'Google/Gemini 2.5 Flash', rawId: 'google/gemini-2.5-flash' },
      { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
      { label: 'Google/Gemini 2.5 Pro', rawId: 'google/gemini-2.5-pro' },
    ])).toEqual([
      {
        models: [
          { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
        ],
        providerKey: 'anthropic',
        providerLabel: 'Anthropic',
      },
      {
        models: [
          { label: 'Google/Gemini 2.5 Flash', rawId: 'google/gemini-2.5-flash' },
          { label: 'Google/Gemini 2.5 Pro', rawId: 'google/gemini-2.5-pro' },
        ],
        providerKey: 'google',
        providerLabel: 'Google',
      },
    ]);
  });
});
