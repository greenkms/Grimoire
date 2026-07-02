import { requestUrl } from 'obsidian';

import { createClaudeWorkspaceServices } from '@/providers/claude/app/ClaudeWorkspaceServices';
import { getClaudeProviderSettings, updateClaudeProviderSettings } from '@/providers/claude/settings';

function createVaultAdapter() {
  return {
    delete: jest.fn(),
    ensureFolder: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    listFiles: jest.fn().mockResolvedValue([]),
    read: jest.fn(),
    write: jest.fn(),
  };
}

describe('createClaudeWorkspaceServices', () => {
  afterEach(() => {
    jest.mocked(requestUrl).mockReset();
    jest.restoreAllMocks();
  });

  it('refreshes Claude models through the Anthropic Models API when an API key is configured', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, {
      enabled: true,
      environmentVariables: 'ANTHROPIC_API_KEY=test-key',
    });
    const plugin = {
      app: { vault: { adapter: { basePath: '/vault' } } },
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(requestUrl).mockResolvedValue({
      json: {
        data: [
          {
            id: 'claude-fable-5',
            display_name: 'Claude Fable 5',
            max_input_tokens: 1000000,
            type: 'model',
          },
          {
            id: 'claude-sonnet-5',
            display_name: 'Claude Sonnet 5',
            max_input_tokens: 1000000,
            type: 'model',
          },
        ],
        has_more: false,
      },
      status: 200,
    } as any);

    const services = await createClaudeWorkspaceServices(plugin as any, createVaultAdapter() as any);
    const changed = await services.modelCatalog.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(true);
    expect(requestUrl).toHaveBeenCalledWith({
      url: 'https://api.anthropic.com/v1/models?limit=1000',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': 'test-key',
      },
      method: 'GET',
    });
    expect(getClaudeProviderSettings(settings).discoveredModels).toEqual([
      {
        displayName: 'Claude Fable 5',
        id: 'claude-fable-5',
        maxInputTokens: 1000000,
      },
      {
        displayName: 'Claude Sonnet 5',
        id: 'claude-sonnet-5',
        maxInputTokens: 1000000,
      },
    ]);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it('keeps the static fallback when no Anthropic API key is configured', async () => {
    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, { enabled: true });
    const plugin = {
      app: { vault: { adapter: { basePath: '/vault' } } },
      recordDebugLog: jest.fn(),
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    const services = await createClaudeWorkspaceServices(plugin as any, createVaultAdapter() as any);
    const changed = await services.modelCatalog.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(false);
    expect(requestUrl).not.toHaveBeenCalled();
    expect(getClaudeProviderSettings(settings).discoveredModels).toEqual([]);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });
});
