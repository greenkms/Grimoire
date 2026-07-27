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
    expect(getClaudeProviderSettings(settings).discoveredModels).toEqual([
      { id: 'legacy', displayName: 'Legacy', source: 'api' },
    ]);
  });
});
