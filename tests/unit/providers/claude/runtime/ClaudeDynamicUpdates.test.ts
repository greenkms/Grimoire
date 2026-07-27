import type { GrimoireSettings } from '@/core/types/settings';
import { applyClaudeDynamicUpdates } from '@/providers/claude/runtime/ClaudeDynamicUpdates';
import type { PersistentQueryConfig } from '@/providers/claude/runtime/types';

describe('applyClaudeDynamicUpdates', () => {
  it('preserves SDK-supported max effort for a dynamic default alias', async () => {
    const query = {
      applyFlagSettings: jest.fn().mockResolvedValue(undefined),
      setModel: jest.fn(),
    };
    const config: PersistentQueryConfig = {
      model: 'default', effortLevel: 'high', permissionMode: 'full_access', sdkPermissionMode: 'bypassPermissions',
      systemPromptKey: '', disallowedToolsKey: '', mcpServersKey: '{}', pluginsKey: '', externalContextPaths: [],
      settingSources: '', claudeCliPath: '', enableChrome: false, enableAutoMode: false,
    };
    const settings = {
      model: 'default', effortLevel: 'max', permissionMode: 'full_access',
      providerConfigs: { claude: { discoveredModels: [{
        id: 'default', displayName: 'Default', source: 'sdk',
        supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
      }] } },
    } as unknown as GrimoireSettings;

    await applyClaudeDynamicUpdates({
      getPersistentQuery: () => query as any,
      getCurrentConfig: () => config,
      mutateCurrentConfig: mutate => mutate(config),
      getVaultPath: () => '/vault', getCliPath: () => '/claude', getScopedSettings: () => settings,
      getPermissionMode: () => 'full_access', resolveSDKPermissionMode: () => 'bypassPermissions',
      mcpManager: { getActiveServers: () => ({}), getDisallowedMcpTools: () => [] } as any,
      buildPersistentQueryConfig: () => config, needsRestart: () => false, ensureReady: jest.fn(),
      setCurrentExternalContextPaths: jest.fn(), notifyFailure: jest.fn(),
    });

    expect(query.applyFlagSettings).toHaveBeenCalledWith({ effortLevel: 'max' });
    expect(config.effortLevel).toBe('max');
  });
});
