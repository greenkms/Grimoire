import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { qwenWorkspaceRegistration } from '@/providers/qwen/app/QwenWorkspaceServices';
import { QwenChatRuntime } from '@/providers/qwen/runtime/QwenChatRuntime';
import { getQwenProviderSettings, updateQwenProviderSettings } from '@/providers/qwen/settings';

describe('Qwen provider registration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers Qwen as an opt-in provider', () => {
    expect(ProviderRegistry.getRegisteredProviderIds()).toContain('qwen');
    expect(ProviderRegistry.getProviderDisplayName('qwen')).toBe('Qwen Code');
    expect(ProviderRegistry.isEnabled('qwen', {})).toBe(false);

    const settings: Record<string, unknown> = {};
    updateQwenProviderSettings(settings, { enabled: true });

    expect(ProviderRegistry.isEnabled('qwen', settings)).toBe(true);
    expect(ProviderRegistry.getCapabilities('qwen')?.reasoningControl).toBe('effort');
  });

  it('creates a Qwen runtime through the provider registry', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      plugin: {} as any,
      providerId: 'qwen',
    });

    expect(runtime.providerId).toBe('qwen');
  });

  it('creates Qwen workspace services', async () => {
    const services = await qwenWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    expect(services.cliResolver).toBeTruthy();
    expect(services.modelCatalog).toBeTruthy();
    expect(services.settingsTabRenderer).toBeTruthy();
  });

  it('refreshes Qwen model discovery through the workspace model catalog', async () => {
    const settings: Record<string, unknown> = {};
    updateQwenProviderSettings(settings, { enabled: true });
    const plugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    const ensureReadySpy = jest
      .spyOn(QwenChatRuntime.prototype, 'ensureReady')
      .mockImplementation(async function ensureReady(this: QwenChatRuntime) {
        updateQwenProviderSettings((this as any).plugin.settings, {
          discoveredModels: [{ label: 'Qwen 3 Pro', rawId: 'qwen-3-pro' }],
          visibleModels: ['qwen-3-pro'],
        } as any);
        return true;
      });
    const cleanupSpy = jest.spyOn(QwenChatRuntime.prototype, 'cleanup').mockImplementation(() => undefined);
    const services = await qwenWorkspaceRegistration.initialize({
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
    expect(getQwenProviderSettings(settings).discoveredModels).toEqual([
      { label: 'Qwen 3 Pro', rawId: 'qwen-3-pro' },
    ]);
  });
});
