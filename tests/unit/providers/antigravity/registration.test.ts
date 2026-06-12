import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { antigravityWorkspaceRegistration } from '@/providers/antigravity/app/AntigravityWorkspaceServices';
import { discoverAntigravityModels } from '@/providers/antigravity/runtime/AntigravityModelDiscovery';
import { AntigravityChatRuntime } from '@/providers/antigravity/runtime/AntigravityChatRuntime';
import {
  getAntigravityProviderSettings,
  updateAntigravityProviderSettings,
} from '@/providers/antigravity/settings';
import '@/providers';

jest.mock('@/providers/antigravity/runtime/AntigravityModelDiscovery', () => ({
  discoverAntigravityModels: jest.fn(),
}));

describe('Antigravity provider registration', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers Antigravity as an opt-in provider', () => {
    expect(ProviderRegistry.getRegisteredProviderIds()).toContain('antigravity');
    expect(ProviderRegistry.getProviderDisplayName('antigravity')).toBe('Antigravity');
    expect(ProviderRegistry.isEnabled('antigravity', {})).toBe(false);

    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: true });
    expect(ProviderRegistry.isEnabled('antigravity', settings)).toBe(true);
  });

  it('creates an Antigravity runtime through the provider registry', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      plugin: {} as any,
      providerId: 'antigravity',
    });

    expect(runtime).toBeInstanceOf(AntigravityChatRuntime);
    expect(runtime.providerId).toBe('antigravity');
  });

  it('creates Antigravity workspace services', async () => {
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    expect(services.cliResolver).toBeDefined();
    expect(services.modelCatalog).toBeDefined();
    expect(services.usageProvider).toBeDefined();
  });

  it('replaces the synthetic fallback with discovered agy models on refresh', async () => {
    (discoverAntigravityModels as jest.Mock).mockResolvedValue([
      { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      { label: 'Claude Sonnet 4.6 (Thinking)', rawId: 'Claude Sonnet 4.6 (Thinking)' },
    ]);
    const recordDebugLog = jest.fn();
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      enabled: true,
      visibleModels: ['antigravity'],
    });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: { recordDebugLog } as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    await services.modelCatalog.refreshModels({ plugin: {} as any, settings });

    expect(getAntigravityProviderSettings(settings).visibleModels).toEqual([
      'Gemini 3.5 Flash (Medium)',
      'Claude Sonnet 4.6 (Thinking)',
    ]);
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      event: 'modelCatalog.refresh.started',
      scope: 'provider.antigravity',
    }));
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 2,
        providerId: 'antigravity',
      }),
      event: 'modelCatalog.refresh.succeeded',
      level: 'info',
      scope: 'provider.antigravity',
    }));
  });

  it('uses cached Antigravity discovered models without spawning agy again', async () => {
    const recordDebugLog = jest.fn();
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      discoveredModels: [
        { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      ],
      enabled: true,
      visibleModels: ['Gemini 3.5 Flash (Medium)'],
    });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: { recordDebugLog } as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    const changed = await services.modelCatalog.refreshModels({ plugin: {} as any, settings });

    expect(changed).toBe(false);
    expect(discoverAntigravityModels).not.toHaveBeenCalled();
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 1,
        providerId: 'antigravity',
        reason: 'cache_fresh',
      }),
      event: 'modelCatalog.refresh.skipped',
      level: 'debug',
      scope: 'provider.antigravity',
    }));
  });

  it('logs Antigravity model catalog refresh failures before rethrowing', async () => {
    const error = new Error('agy models failed');
    (discoverAntigravityModels as jest.Mock).mockRejectedValue(error);
    const recordDebugLog = jest.fn();
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: true });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: { recordDebugLog } as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    await expect(services.modelCatalog.refreshModels({ plugin: {} as any, settings })).rejects.toThrow('agy models failed');

    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      error,
      event: 'modelCatalog.refresh.failed',
      level: 'error',
      scope: 'provider.antigravity',
    }));
  });

  it('joins concurrent Antigravity model catalog refreshes', async () => {
    (discoverAntigravityModels as jest.Mock).mockResolvedValue([
      { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
    ]);
    const recordDebugLog = jest.fn();
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, { enabled: true });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: { recordDebugLog } as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    await Promise.all([
      services.modelCatalog.refreshModels({ plugin: {} as any, settings }),
      services.modelCatalog.refreshModels({ plugin: {} as any, settings }),
    ]);

    expect(discoverAntigravityModels).toHaveBeenCalledTimes(1);
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      event: 'modelCatalog.refresh.joined',
      scope: 'provider.antigravity',
    }));
  });
});
