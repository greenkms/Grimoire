import { createClaudeModelCatalog } from '@/providers/claude/app/ClaudeModelCatalog';
import { probeRuntimeModels } from '@/providers/claude/commands/probeRuntimeModels';
import { getClaudeProviderSettings, updateClaudeProviderSettings } from '@/providers/claude/settings';

jest.mock('@/providers/claude/commands/probeRuntimeModels', () => ({ probeRuntimeModels: jest.fn() }));

const mockedProbe = jest.mocked(probeRuntimeModels);

function createPlugin(settings: Record<string, unknown>, saveSettings = jest.fn().mockResolvedValue(undefined)) {
  return {
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/claude'),
    recordDebugLog: jest.fn(),
    saveSettings,
    settings,
  } as any;
}

describe('ClaudeModelCatalog', () => {
  beforeEach(() => mockedProbe.mockReset());

  it('does not commit a completed probe after its cache key becomes stale', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, { enabled: true, environmentVariables: 'A=1' });
    let resolveProbe!: (models: any[]) => void;
    mockedProbe.mockReturnValue(new Promise(resolve => { resolveProbe = resolve; }));
    const plugin = createPlugin(settings);
    const catalog = createClaudeModelCatalog(plugin);

    const refresh = catalog.refreshModels({ plugin, settings });
    updateClaudeProviderSettings(settings, { environmentVariables: 'A=2' });
    resolveProbe([{ id: 'default', displayName: 'Default', source: 'sdk' }]);

    await expect(refresh).resolves.toBe(false);
    expect(getClaudeProviderSettings(settings).discoveredModels).toEqual([]);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it('caches empty discovery attempts for ten minutes', async () => {
    jest.useFakeTimers();
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, { enabled: true });
    mockedProbe.mockResolvedValue([]);
    const plugin = createPlugin(settings);
    const catalog = createClaudeModelCatalog(plugin);

    await catalog.refreshModels({ plugin, settings });
    await catalog.refreshModels({ plugin, settings });

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('restores the prior catalog if saving the refreshed result fails', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      discoveredModels: [{ id: 'legacy', displayName: 'Legacy', source: 'api' }],
    });
    mockedProbe.mockResolvedValue([{ id: 'default', displayName: 'Default', source: 'sdk' }]);
    const plugin = createPlugin(settings, jest.fn().mockRejectedValue(new Error('disk full')));
    const catalog = createClaudeModelCatalog(plugin);

    await expect(catalog.refreshModels({ plugin, settings })).resolves.toBe(false);
    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(getClaudeProviderSettings(settings).discoveredModels).toEqual([
      { id: 'legacy', displayName: 'Legacy', source: 'api' },
    ]);
  });

  it('does not probe again after a reload when a catalog is already persisted', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      discoveredModels: [{ id: 'opus', displayName: 'Opus', source: 'sdk' }],
    });
    mockedProbe.mockResolvedValue([{ id: 'opus', displayName: 'Opus', source: 'sdk' }]);
    const plugin = createPlugin(settings);

    // A fresh catalog stands in for a plugin reload: the in-memory attempt log
    // starts empty, but the persisted models must still suppress the probe.
    const catalog = createClaudeModelCatalog(plugin);
    await expect(catalog.refreshModels({ plugin, settings })).resolves.toBe(false);

    expect(mockedProbe).not.toHaveBeenCalled();
  });

  it('still probes after a reload when the resolved CLI path changed', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      discoveredModels: [{ id: 'opus', displayName: 'Opus', source: 'sdk' }],
    });
    mockedProbe.mockResolvedValue([{ id: 'sonnet', displayName: 'Sonnet', source: 'sdk' }]);
    const plugin = createPlugin(settings);
    const catalog = createClaudeModelCatalog(plugin);
    plugin.getResolvedProviderCliPath.mockReturnValue('/opt/claude');

    await catalog.refreshModels({ plugin, settings });

    expect(mockedProbe).toHaveBeenCalledTimes(1);
  });
  it('suppresses the reload probe even when the CLI resolver is not reachable yet at construction', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      discoveredModels: [{ id: 'opus', displayName: 'Opus', source: 'sdk' }],
    });
    mockedProbe.mockResolvedValue([{ id: 'opus', displayName: 'Opus', source: 'sdk' }]);
    const plugin = createPlugin(settings);

    // Production ordering: the catalog is built inside createClaudeWorkspaceServices,
    // which runs *inside* ProviderWorkspaceRegistry.initialize(). The registry only
    // assigns this.services[providerId] after initialize() resolves, so
    // getCliResolver -> getResolvedProviderCliPath returns null while the catalog
    // is being constructed, and the real path only afterwards.
    plugin.getResolvedProviderCliPath.mockReturnValue(null);
    const catalog = createClaudeModelCatalog(plugin);
    plugin.getResolvedProviderCliPath.mockReturnValue('/claude');

    await expect(catalog.refreshModels({ plugin, settings })).resolves.toBe(false);

    expect(mockedProbe).not.toHaveBeenCalled();
  });

  it('still probes when the Claude config changed before the first refresh', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      environmentVariables: 'A=1',
      discoveredModels: [{ id: 'opus', displayName: 'Opus', source: 'sdk' }],
    });
    mockedProbe.mockResolvedValue([{ id: 'sonnet', displayName: 'Sonnet', source: 'sdk' }]);
    const plugin = createPlugin(settings);

    plugin.getResolvedProviderCliPath.mockReturnValue(null);
    const catalog = createClaudeModelCatalog(plugin);
    plugin.getResolvedProviderCliPath.mockReturnValue('/claude');
    // The deferred seed only stands in for the unresolved CLI path. An
    // environment change since the load is a real invalidation, so it must
    // still reach the probe instead of being absorbed by the seed.
    updateClaudeProviderSettings(settings, { environmentVariables: 'A=2' });

    await catalog.refreshModels({ plugin, settings });

    expect(mockedProbe).toHaveBeenCalledTimes(1);
  });
});
