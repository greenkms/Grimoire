import { updateAntigravityProviderSettings } from '@/providers/antigravity/settings';
import { antigravityChatUIConfig } from '@/providers/antigravity/ui/AntigravityChatUIConfig';

describe('antigravityChatUIConfig', () => {
  it('returns the synthetic Antigravity option before model discovery', () => {
    expect(antigravityChatUIConfig.getModelOptions({})).toEqual([
      {
        description: 'Antigravity CLI default model',
        label: 'Antigravity',
        value: 'antigravity',
      },
    ]);
  });

  it('returns discovered Antigravity models without assuming Gemini-only ownership', () => {
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      discoveredModels: [
        { label: 'Claude Sonnet 4.6 (Thinking)', rawId: 'Claude Sonnet 4.6 (Thinking)' },
        { label: 'Gemini 3.1 Pro (High)', rawId: 'Gemini 3.1 Pro (High)' },
      ],
      visibleModels: ['Claude Sonnet 4.6 (Thinking)', 'Gemini 3.1 Pro (High)'],
    });

    expect(antigravityChatUIConfig.getModelOptions(settings)).toEqual([
      {
        description: 'Antigravity CLI model',
        label: 'Claude Sonnet 4.6 (Thinking)',
        value: 'antigravity:Claude Sonnet 4.6 (Thinking)',
      },
      {
        description: 'Antigravity CLI model',
        label: 'Gemini 3.1 Pro (High)',
        value: 'antigravity:Gemini 3.1 Pro (High)',
      },
    ]);
  });

  it('uses discovered models when visible models have not been seeded yet', () => {
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      discoveredModels: [
        { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
        { label: 'GPT-OSS 120B (Medium)', rawId: 'GPT-OSS 120B (Medium)' },
      ],
      visibleModels: [],
    });

    expect(antigravityChatUIConfig.getModelOptions(settings).map((option) => option.value)).toEqual([
      'antigravity:Gemini 3.5 Flash (Medium)',
      'antigravity:GPT-OSS 120B (Medium)',
    ]);
  });

  it('appends custom Antigravity models from settings and deduplicates them', () => {
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      customModels: 'Claude Opus 4.6 (Thinking)\nGemini 3.5 Flash (Medium)\nClaude Opus 4.6 (Thinking)',
      discoveredModels: [
        { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      ],
      visibleModels: ['Gemini 3.5 Flash (Medium)'],
    });

    expect(antigravityChatUIConfig.getModelOptions(settings)).toEqual([
      {
        description: 'Antigravity CLI model',
        label: 'Gemini 3.5 Flash (Medium)',
        value: 'antigravity:Gemini 3.5 Flash (Medium)',
      },
      {
        description: 'Custom Antigravity CLI model',
        label: 'Claude Opus 4.6 (Thinking)',
        value: 'antigravity:Claude Opus 4.6 (Thinking)',
      },
    ]);
  });

  it('exposes blocked/auto-approve and multiple thinking options for the shared toolbar', () => {
    const settings: Record<string, unknown> = {};

    expect(antigravityChatUIConfig.getPermissionModeToggle?.()).toEqual({
      inactiveValue: 'normal',
      inactiveLabel: 'Blocked',
      inactiveDescription: 'Safe approvals are unavailable for agy --print; Windows uses best-effort CLI fallbacks',
      activeValue: 'full_access',
      activeLabel: 'Auto-approve',
      activeDescription: 'Antigravity may edit files without Grimoire prompts',
    });
    expect(antigravityChatUIConfig.getReasoningOptions('antigravity', settings)).toEqual([
      { value: 'default', label: 'Default' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ]);

    antigravityChatUIConfig.applyPermissionMode?.('full_access', settings);
    expect(settings.permissionMode).toBe('full_access');
  });
});
