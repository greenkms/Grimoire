import { getMimocodeDiscoveryState, updateMimocodeDiscoveryState } from '../../../../src/providers/mimocode/discoveryState';
import { mimocodeSettingsReconciler } from '../../../../src/providers/mimocode/env/MimocodeSettingsReconciler';

describe('mimocodeSettingsReconciler.normalizeModelVariantSettings', () => {
  it('migrates saved variant model ids into base model ids plus effort', () => {
    const settings: Record<string, unknown> = {
      effortLevel: '',
      model: 'mimocode:anthropic/claude-sonnet-4/high',
      providerConfigs: {
        mimocode: {
          discoveredModels: [
            { label: 'Anthropic/Claude Sonnet 4', rawId: 'anthropic/claude-sonnet-4' },
            { label: 'Anthropic/Claude Sonnet 4 (high)', rawId: 'anthropic/claude-sonnet-4/high' },
          ],
          visibleModels: ['anthropic/claude-sonnet-4/high'],
        },
      },
      savedProviderEffort: {},
      savedProviderModel: {
        mimocode: 'mimocode:anthropic/claude-sonnet-4/high',
      },
      settingsProvider: 'mimocode',
      titleGenerationModel: 'mimocode:anthropic/claude-sonnet-4/high',
    };

    expect(mimocodeSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(true);
    expect(settings).toMatchObject({
      effortLevel: 'high',
      model: 'mimocode:anthropic/claude-sonnet-4',
      savedProviderEffort: {
        mimocode: 'high',
      },
      savedProviderModel: {
        mimocode: 'mimocode:anthropic/claude-sonnet-4',
      },
      titleGenerationModel: 'mimocode:anthropic/claude-sonnet-4',
    });
  });
});

describe('mimocodeSettingsReconciler.handleEnvironmentChange', () => {
  it('clears provider-owned discovery state when environment changes', () => {
    const settings: Record<string, unknown> = {};
    updateMimocodeDiscoveryState(settings, {
      availableModes: [{ id: 'build', name: 'Build' }],
      discoveredModels: [{ label: 'OpenAI/GPT-5', rawId: 'openai/gpt-5' }],
    });

    expect(mimocodeSettingsReconciler.handleEnvironmentChange?.(settings)).toBe(true);
    expect(getMimocodeDiscoveryState(settings)).toEqual({
      availableModes: [],
      discoveredModels: [],
      thinkingOptionsByModel: {},
    });
  });
});

describe('mimocodeSettingsReconciler.reconcileModelWithEnvironment', () => {
  it('invalidates persisted MiMoCode session state when the runtime database/config env changes', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        mimocode: {
          enabled: true,
          environmentHash: 'MIMOCODE_DB=/old/mimocode.db',
          environmentVariables: 'MIMOCODE_DB=/new/mimocode.db\nMIMOCODE_CONFIG=/tmp/mimocode.json',
        },
      },
    };
    const conversations = [
      {
        id: 'conv-mimocode',
        messages: [],
        providerId: 'mimocode',
        providerState: { databasePath: '/old/mimocode.db' },
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

    const result = mimocodeSettingsReconciler.reconcileModelWithEnvironment(settings, conversations);

    expect(result.changed).toBe(true);
    expect(result.invalidatedConversations).toHaveLength(1);
    expect(conversations[0].sessionId).toBeNull();
    expect(conversations[0].providerState).toBeUndefined();
    expect((settings.providerConfigs as any).mimocode.environmentHash).toBe(
      'MIMOCODE_CONFIG=/tmp/mimocode.json|MIMOCODE_DB=/new/mimocode.db',
    );
  });
});
