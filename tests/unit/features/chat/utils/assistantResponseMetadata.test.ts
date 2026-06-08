import '@/providers';

import { buildAssistantResponseMetadata } from '@/features/chat/utils/assistantResponseMetadata';

describe('assistantResponseMetadata', () => {
  it('builds provider, model, and effort labels for Claude assistant turns', () => {
    const metadata = buildAssistantResponseMetadata('claude', {
      model: 'claude-opus-4-8',
      effortLevel: 'xhigh',
      providerConfigs: {
        claude: { enabled: true },
      },
    });

    expect(metadata).toEqual({
      providerId: 'claude',
      providerLabel: 'Claude Code',
      model: 'claude-opus-4-8',
      modelLabel: 'Opus 4.8',
      effort: 'xhigh',
      effortLabel: 'XHigh',
    });
  });

  it('uses the query model override when a project workspace routes the turn', () => {
    const metadata = buildAssistantResponseMetadata(
      'codex',
      {
        model: 'gpt-5.5',
        effortLevel: 'high',
        providerConfigs: {
          codex: { enabled: true },
        },
      },
      { model: 'gpt-5.4-mini' },
    );

    expect(metadata.model).toBe('gpt-5.4-mini');
    expect(metadata.modelLabel).toBe('GPT-5.4 Mini');
    expect(metadata.effortLabel).toBe('High');
  });
});
