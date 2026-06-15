import { getGrokDiscoveryState, updateGrokDiscoveryState } from '../../../../src/providers/grok/discoveryState';
import { grokSettingsReconciler } from '../../../../src/providers/grok/env/GrokSettingsReconciler';

describe('grokSettingsReconciler.normalizeModelVariantSettings', () => {
  it('migrates saved variant model ids into base model ids plus effort', () => {
    const settings: Record<string, unknown> = {
      effortLevel: '',
      model: 'grok:anthropic/claude-sonnet-4/high',
      providerConfigs: {
        grok: {
          discoveredModels: [
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
            { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
          ],
          visibleModels: ['anthropic/claude-sonnet-4/high'],
        },
      },
      savedProviderEffort: {},
      savedProviderModel: {
        grok: 'grok:anthropic/claude-sonnet-4/high',
      },
      settingsProvider: 'grok',
      titleGenerationModel: 'grok:anthropic/claude-sonnet-4/high',
    };

    expect(grokSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(true);
    expect(settings).toMatchObject({
      effortLevel: 'high',
      model: 'grok:anthropic/claude-sonnet-4',
      savedProviderEffort: {
        grok: 'high',
      },
      savedProviderModel: {
        grok: 'grok:anthropic/claude-sonnet-4',
      },
      titleGenerationModel: 'grok:anthropic/claude-sonnet-4',
    });
  });
});

describe('grokSettingsReconciler.handleEnvironmentChange', () => {
  it('clears provider-owned discovery state when environment changes', () => {
    const settings: Record<string, unknown> = {};
    updateGrokDiscoveryState(settings, {
      availableModes: [{ id: 'build', name: 'Build' }],
      discoveredModels: [{ label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' }],
    });

    expect(grokSettingsReconciler.handleEnvironmentChange?.(settings)).toBe(true);
    expect(getGrokDiscoveryState(settings)).toEqual({
      availableModes: [],
      discoveredModels: [],
      thinkingOptionsByModel: {},
    });
  });
});

describe('grokSettingsReconciler.reconcileModelWithEnvironment', () => {
  it('invalidates persisted Grok Build session state when the runtime env changes', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          enabled: true,
          environmentHash: 'GROK_HOME=/old/grok-home',
          environmentVariables: 'GROK_HOME=/new/grok-home\nXAI_API_KEY=test-key',
        },
      },
    };
    const conversations = [
      {
        id: 'conv-grok',
        messages: [],
        providerId: 'grok',
        providerState: { databasePath: '/old/grok.db' },
        sessionId: 'session-1',
      },
      {
        id: 'conv-other',
        messages: [],
        providerId: 'claude',
        providerState: { providerSessionId: 'claude-session' },
        sessionId: 'claude-session',
      },
    ] as any;

    const result = grokSettingsReconciler.reconcileModelWithEnvironment(settings, conversations);

    expect(result.changed).toBe(true);
    expect(result.invalidatedConversations).toHaveLength(1);
    expect(conversations[0].sessionId).toBeNull();
    expect(conversations[0].providerState).toBeUndefined();
    expect((settings.providerConfigs as any).grok.environmentHash).toBe(
      'GROK_HOME=/new/grok-home|XAI_API_KEY=test-key',
    );
  });
});
