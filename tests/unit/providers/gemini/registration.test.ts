import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { geminiWorkspaceRegistration } from '@/providers/gemini/app/GeminiWorkspaceServices';
import { GeminiChatRuntime } from '@/providers/gemini/runtime/GeminiChatRuntime';
import { getGeminiProviderSettings, updateGeminiProviderSettings } from '@/providers/gemini/settings';

describe('Gemini provider registration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers Gemini as an opt-in provider', () => {
    expect(ProviderRegistry.getRegisteredProviderIds()).toContain('gemini');
    expect(ProviderRegistry.getProviderDisplayName('gemini')).toBe('Gemini CLI (Legacy)');
    expect(ProviderRegistry.isEnabled('gemini', {})).toBe(false);

    const settings: Record<string, unknown> = {};
    updateGeminiProviderSettings(settings, { enabled: true });

    expect(ProviderRegistry.isEnabled('gemini', settings)).toBe(true);
  });

  it('creates a Gemini runtime through the provider registry', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      plugin: {} as any,
      providerId: 'gemini',
    });

    expect(runtime.providerId).toBe('gemini');
  });

  it('creates Gemini workspace services', async () => {
    const services = await geminiWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    expect(services.cliResolver).toBeTruthy();
    expect(services.modelCatalog).toBeTruthy();
    expect(services.settingsTabRenderer).toBeTruthy();
  });

  it('refreshes Gemini model discovery through the workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateGeminiProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest
      .spyOn(GeminiChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: GeminiChatRuntime) {
        updateGeminiProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'Gemini 3 Pro', rawId: 'gemini-3-pro' }],
          visibleModels: ['gemini-3-pro'],
        } as any);
        return true;
      });
    const cleanupSpy = jest.spyOn(GeminiChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const services = await geminiWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: plugin as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    const changed = await services.modelCatalog?.refreshModels({
      plugin: plugin as any,
      settings,
    });

    expect(changed).toBe(true);
    expect(ensureReadySpy).toHaveBeenCalledWith({ allowSessionCreation: true });
    expect(cleanupSpy).toHaveBeenCalled();
    expect(getGeminiProviderSettings(settings).discoveredModels).toEqual([
      { label: 'Gemini 3 Pro', rawId: 'gemini-3-pro' },
    ]);
  });
});
