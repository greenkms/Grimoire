import { updateQwenProviderSettings } from '@/providers/qwen/settings';
import { qwenChatUIConfig } from '@/providers/qwen/ui/QwenChatUIConfig';

describe('qwenChatUIConfig', () => {
  it('returns the synthetic Qwen option before model discovery', () => {
    expect(qwenChatUIConfig.getModelOptions({})).toEqual([
      {
        description: 'Qwen CLI ACP runtime',
        label: 'Qwen',
        value: 'qwen',
      },
    ]);
  });

  it('shows all discovered models when the persisted visibility cache is stale', () => {
    const settings: Record<string, unknown> = {};
    updateQwenProviderSettings(settings, {
      discoveredModels: [
        { label: 'Qwen 2.5 Pro', rawId: 'qwen-2.5-pro' },
        { label: 'Qwen 2.5 Flash', rawId: 'qwen-2.5-flash' },
      ],
      modelAliases: {
        'qwen-2.5-pro': 'Pro Alias',
      },
      visibleModels: ['qwen-2.5-pro'],
    });

    expect(qwenChatUIConfig.getModelOptions(settings)).toEqual([
      {
        description: 'Qwen CLI ACP model',
        label: 'Pro Alias',
        value: 'qwen:qwen-2.5-pro',
      },
      {
        description: 'Qwen CLI ACP model',
        label: 'Qwen 2.5 Flash',
        value: 'qwen:qwen-2.5-flash',
      },
    ]);
  });

  it('provides a compact toolbar label for Token Plan models', () => {
    const settings: Record<string, unknown> = {};
    updateQwenProviderSettings(settings, {
      discoveredModels: [{
        label: '[Token Plan Personal] qwen3.8-max',
        rawId: 'qwen3.8-max(openai)',
      }],
      visibleModels: ['qwen3.8-max(openai)'],
    });

    expect(qwenChatUIConfig.getModelOptions(settings)).toEqual([{
      buttonLabel: 'qwen3.8-max',
      description: 'Qwen CLI ACP model',
      label: '[Token Plan Personal] qwen3.8-max',
      value: 'qwen:qwen3.8-max(openai)',
    }]);
  });

  it('owns Qwen synthetic and encoded model ids', () => {
    expect(qwenChatUIConfig.ownsModel('qwen', {})).toBe(true);
    expect(qwenChatUIConfig.ownsModel('qwen:qwen-2.5-pro', {})).toBe(true);
    expect(qwenChatUIConfig.ownsModel('gpt-5', {})).toBe(false);
  });

  it('exposes and persists Qwen native reasoning effort', () => {
    const settings: Record<string, unknown> = {};

    expect(qwenChatUIConfig.isAdaptiveReasoningModel('qwen', settings)).toBe(true);
    expect(qwenChatUIConfig.getReasoningOptions('qwen', settings)).toEqual([
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'XHigh', value: 'xhigh' },
      { label: 'Max', value: 'max' },
    ]);
    expect(qwenChatUIConfig.getDefaultReasoningValue('qwen', settings)).toBe('high');

    qwenChatUIConfig.applyReasoningSelection?.('qwen', 'max', settings);

    expect(settings.effortLevel).toBe('max');
    expect(qwenChatUIConfig.getDefaultReasoningValue('qwen', settings)).toBe('max');

    qwenChatUIConfig.applyModelDefaults('qwen', settings);
    expect(settings.effortLevel).toBe('max');
  });

  it('updates shared permission mode when applying a Qwen permission selection', () => {
    const settings: Record<string, unknown> = {
      permissionMode: 'full_access',
    };

    qwenChatUIConfig.applyPermissionMode?.('normal', settings);

    expect(settings.permissionMode).toBe('normal');
    expect(qwenChatUIConfig.resolvePermissionMode?.(settings)).toBe('normal');
  });
});
