import { getKimicodeDiscoveryState, updateKimicodeDiscoveryState } from '../../../../src/providers/kimicode/discoveryState';
import { kimicodeSettingsReconciler } from '../../../../src/providers/kimicode/env/KimicodeSettingsReconciler';

describe('kimicodeSettingsReconciler.normalizeModelVariantSettings', () => {
  it('migrates saved variant model ids into base model ids plus effort', () => {
    const settings: Record<string, unknown> = {
      effortLevel: '',
      model: 'kimicode:anthropic/claude-sonnet-4/high',
      providerConfigs: {
        kimicode: {
          discoveredModels: [
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
            { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
          ],
          visibleModels: ['anthropic/claude-sonnet-4/high'],
        },
      },
      savedProviderEffort: {},
      savedProviderModel: {
        kimicode: 'kimicode:anthropic/claude-sonnet-4/high',
      },
      settingsProvider: 'kimicode',
      titleGenerationModel: 'kimicode:anthropic/claude-sonnet-4/high',
    };

    expect(kimicodeSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(true);
    expect(settings).toMatchObject({
      effortLevel: 'high',
      model: 'kimicode:anthropic/claude-sonnet-4',
      savedProviderEffort: {
        kimicode: 'high',
      },
      savedProviderModel: {
        kimicode: 'kimicode:anthropic/claude-sonnet-4',
      },
      titleGenerationModel: 'kimicode:anthropic/claude-sonnet-4',
    });
  });
});

describe('kimicodeSettingsReconciler.handleEnvironmentChange', () => {
  it('clears provider-owned discovery state when environment changes', () => {
    const settings: Record<string, unknown> = {};
    updateKimicodeDiscoveryState(settings, {
      availableModes: [{ id: 'build', name: 'Build' }],
      discoveredModels: [{ label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' }],
    });

    expect(kimicodeSettingsReconciler.handleEnvironmentChange?.(settings)).toBe(true);
    expect(getKimicodeDiscoveryState(settings)).toEqual({
      availableModes: [],
      discoveredModels: [],
      thinkingOptionsByModel: {},
    });
  });
});

describe('kimicodeSettingsReconciler.reconcileModelWithEnvironment', () => {
  it('invalidates persisted Kimi Code session state when the runtime database/config env changes', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        kimicode: {
          enabled: true,
          environmentHash: 'KIMICODE_DB=/old/kimicode.db',
          environmentVariables: 'KIMICODE_DB=/new/kimicode.db\nKIMICODE_CONFIG=/tmp/kimicode.json',
        },
      },
    };
    const conversations = [
      {
        id: 'conv-kimicode',
        messages: [],
        providerId: 'kimicode',
        providerState: { databasePath: '/old/kimicode.db' },
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

    const result = kimicodeSettingsReconciler.reconcileModelWithEnvironment(settings, conversations);

    expect(result.changed).toBe(true);
    expect(result.invalidatedConversations).toHaveLength(1);
    expect(conversations[0].sessionId).toBeNull();
    expect(conversations[0].providerState).toBeUndefined();
    expect((settings.providerConfigs as any).kimicode.environmentHash).toBe(
      'KIMICODE_CONFIG=/tmp/kimicode.json|KIMICODE_DB=/new/kimicode.db',
    );
  });
});
