import { updateGeminiProviderSettings } from '@/providers/gemini/settings';
import { geminiChatUIConfig } from '@/providers/gemini/ui/GeminiChatUIConfig';

describe('geminiChatUIConfig', () => {
  it('returns the synthetic Gemini option before model discovery', () => {
    expect(geminiChatUIConfig.getModelOptions({})).toEqual([
      {
        description: 'Gemini CLI ACP runtime',
        label: 'Gemini',
        value: 'gemini',
      },
    ]);
  });

  it('shows all discovered models when the persisted visibility cache is stale', () => {
    const settings: Record<string, unknown> = {};
    updateGeminiProviderSettings(settings, {
      discoveredModels: [
        { label: 'Gemini 2.5 Pro', rawId: 'gemini-2.5-pro' },
        { label: 'Gemini 2.5 Flash', rawId: 'gemini-2.5-flash' },
      ],
      modelAliases: {
        'gemini-2.5-pro': 'Pro Alias',
      },
      visibleModels: ['gemini-2.5-pro'],
    });

    expect(geminiChatUIConfig.getModelOptions(settings)).toEqual([
      {
        description: 'Gemini CLI ACP model',
        label: 'Pro Alias',
        value: 'gemini:gemini-2.5-pro',
      },
      {
        description: 'Gemini CLI ACP model',
        label: 'Gemini 2.5 Flash',
        value: 'gemini:gemini-2.5-flash',
      },
    ]);
  });

  it('owns Gemini synthetic and encoded model ids', () => {
    expect(geminiChatUIConfig.ownsModel('gemini', {})).toBe(true);
    expect(geminiChatUIConfig.ownsModel('gemini:gemini-2.5-pro', {})).toBe(true);
    expect(geminiChatUIConfig.ownsModel('gpt-5', {})).toBe(false);
  });

  it('updates shared permission mode when applying a Gemini permission selection', () => {
    const settings: Record<string, unknown> = {
      permissionMode: 'full_access',
    };

    geminiChatUIConfig.applyPermissionMode?.('normal', settings);

    expect(settings.permissionMode).toBe('normal');
    expect(geminiChatUIConfig.resolvePermissionMode?.(settings)).toBe('normal');
  });
});
