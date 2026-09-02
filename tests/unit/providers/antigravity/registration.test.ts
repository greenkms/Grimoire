import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { antigravityWorkspaceRegistration } from '@/providers/antigravity/app/AntigravityWorkspaceServices';
import { AntigravityChatRuntime } from '@/providers/antigravity/runtime/AntigravityChatRuntime';
import { discoverAntigravityModels } from '@/providers/antigravity/runtime/AntigravityModelDiscovery';
import {
  getAntigravityProviderSettings,
  updateAntigravityProviderSettings,
} from '@/providers/antigravity/settings';

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

  it('advertises image attachments so the chat input accepts pasted images', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      plugin: {} as any,
      providerId: 'antigravity',
    });

    // This flag is what gates ImageContextManager: with it false, paste and
    // drop are refused before the runtime is ever asked.
    expect(runtime.getCapabilities().supportsImageAttachments).toBe(true);
  });

  it('creates Antigravity workspace services', async () => {
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    expect(services.cliResolver).toBeDefined();
    expect(services.commandCatalog).toBeDefined();
    expect(services.modelCatalog).toBeDefined();
    expect(services.usageProvider).toBeDefined();
  });

  it('lists frontmatter and content-only skills in the AGY slash menu', async () => {
    const files = new Map([
      ['.claude/skills/start-my-day/SKILL.md', '---\nname: start-my-day\ndescription: Plan today\n---\n\nStart the day.'],
      ['.claude/skills/shared/SKILL.md', '---\nname: shared\ndescription: Claude copy\n---\n\nUse Claude copy.'],
      ['.agents/skills/review/SKILL.md', 'Review the current changes before merging.'],
      ['.agents/skills/shared/SKILL.md', 'Shared copy that must be hidden.'],
      ['.agents/skills/deep-work/SKILL.md', '---\nname: "Deep Work"\ndescription: Uninvocable name\n---\n\nCannot be typed as /Deep Work.'],
      ['.agents/skills/empty/SKILL.md', '   '],
    ]);
    const vaultAdapter = {
      listFiles: jest.fn().mockResolvedValue([]),
      listFolders: jest.fn(async (root: string) => root === '.claude/skills'
        ? ['.claude/skills/start-my-day', '.claude/skills/shared']
        : ['.agents/skills/review', '.agents/skills/shared', '.agents/skills/deep-work', '.agents/skills/empty']),
      read: jest.fn(async (path: string) => files.get(path) ?? Promise.reject(new Error('Missing skill'))),
    };
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: vaultAdapter as any,
    });

    const entries = await services.commandCatalog.listDropdownEntries({ includeBuiltIns: false });

    expect(entries.map(({ name, description, displayPrefix, insertPrefix }) => (
      { name, description, displayPrefix, insertPrefix }
    ))).toEqual([
      { name: 'start-my-day', description: 'Plan today', displayPrefix: '/', insertPrefix: '/' },
      { name: 'shared', description: 'Claude copy', displayPrefix: '/', insertPrefix: '/' },
      { name: 'review', description: 'Review the current changes before merging.', displayPrefix: '/', insertPrefix: '/' },
    ]);
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

  it('replaces a stale visible model cache with the latest agy catalog', async () => {
    (discoverAntigravityModels as jest.Mock).mockResolvedValue([
      { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      { label: 'Claude Opus 4.6 (Thinking)', rawId: 'Claude Opus 4.6 (Thinking)' },
    ]);
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      enabled: true,
      visibleModels: ['Gemini 3.5 Flash (Medium)'],
    });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: {} as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });

    await services.modelCatalog.refreshModels({ plugin: {} as any, settings });

    expect(getAntigravityProviderSettings(settings).visibleModels).toEqual([
      'Gemini 3.5 Flash (Medium)',
      'Claude Opus 4.6 (Thinking)',
    ]);
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

  it('never spawns agy again for a settled catalog on a timer, only when forced', async () => {
    jest.useFakeTimers();
    try {
      (discoverAntigravityModels as jest.Mock).mockResolvedValue([
        { label: 'Gemini 3.5 Pro (High)', rawId: 'Gemini 3.5 Pro (High)' },
      ]);
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
        plugin: { recordDebugLog: jest.fn() } as any,
        storage: {} as any,
        vaultAdapter: {} as any,
      });
      const plugin = { recordDebugLog: jest.fn(), saveSettings: jest.fn() } as any;

      // Past the former ten-minute window, with no reload in between.
      jest.advanceTimersByTime(60 * 60 * 1000);
      await expect(services.modelCatalog.refreshModels({ plugin, settings })).resolves.toBe(false);
      expect(discoverAntigravityModels).not.toHaveBeenCalled();

      await expect(services.modelCatalog.refreshModels({ force: true, plugin, settings })).resolves.toBe(true);
      expect(discoverAntigravityModels).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the previous Antigravity model catalog when agy models returns empty output', async () => {
    (discoverAntigravityModels as jest.Mock).mockResolvedValue([]);
    const recordDebugLog = jest.fn();
    const settings: Record<string, unknown> = {};
    updateAntigravityProviderSettings(settings, {
      discoveredModels: [
        { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
        { label: 'GPT-OSS 120B (Medium)', rawId: 'GPT-OSS 120B (Medium)' },
      ],
      enabled: true,
      environmentVariables: 'OLD_ENV=1',
      visibleModels: ['GPT-OSS 120B (Medium)'],
    });
    const services = await antigravityWorkspaceRegistration.initialize({
      homeAdapter: {} as any,
      plugin: { recordDebugLog, settings } as any,
      storage: {} as any,
      vaultAdapter: {} as any,
    });
    updateAntigravityProviderSettings(settings, {
      environmentVariables: 'NEW_ENV=1',
    });

    await services.modelCatalog.refreshModels({ plugin: {} as any, settings });

    expect(getAntigravityProviderSettings(settings).discoveredModels).toEqual([
      { label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      { label: 'GPT-OSS 120B (Medium)', rawId: 'GPT-OSS 120B (Medium)' },
    ]);
    expect(getAntigravityProviderSettings(settings).visibleModels).toEqual(['GPT-OSS 120B (Medium)']);
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 2,
        providerId: 'antigravity',
      }),
      event: 'modelCatalog.refresh.preserved',
      level: 'warn',
      scope: 'provider.antigravity',
    }));
  });

  it('seeds fallback Antigravity models when agy models is empty on first refresh', async () => {
    (discoverAntigravityModels as jest.Mock).mockResolvedValue([]);
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

    expect(getAntigravityProviderSettings(settings).discoveredModels).toEqual([
      { description: 'Antigravity fallback model', label: 'Gemini 3.5 Flash (Medium)', rawId: 'Gemini 3.5 Flash (Medium)' },
      { description: 'Antigravity fallback model', label: 'Gemini 3.5 Flash (High)', rawId: 'Gemini 3.5 Flash (High)' },
      { description: 'Antigravity fallback model', label: 'Gemini 3.5 Flash (Low)', rawId: 'Gemini 3.5 Flash (Low)' },
      { description: 'Antigravity fallback model', label: 'Gemini 3.1 Pro (Low)', rawId: 'Gemini 3.1 Pro (Low)' },
      { description: 'Antigravity fallback model', label: 'Gemini 3.1 Pro (High)', rawId: 'Gemini 3.1 Pro (High)' },
      { description: 'Antigravity fallback model', label: 'Claude Sonnet 4.6 (Thinking)', rawId: 'Claude Sonnet 4.6 (Thinking)' },
      { description: 'Antigravity fallback model', label: 'Claude Opus 4.6 (Thinking)', rawId: 'Claude Opus 4.6 (Thinking)' },
      { description: 'Antigravity fallback model', label: 'GPT-OSS 120B (Medium)', rawId: 'GPT-OSS 120B (Medium)' },
    ]);
    expect(getAntigravityProviderSettings(settings).visibleModels).toEqual([
      'Gemini 3.5 Flash (Medium)',
      'Gemini 3.5 Flash (High)',
      'Gemini 3.5 Flash (Low)',
      'Gemini 3.1 Pro (Low)',
      'Gemini 3.1 Pro (High)',
      'Claude Sonnet 4.6 (Thinking)',
      'Claude Opus 4.6 (Thinking)',
      'GPT-OSS 120B (Medium)',
    ]);
    expect(recordDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modelCount: 8,
        providerId: 'antigravity',
        reason: 'empty_cli_output',
      }),
      event: 'modelCatalog.refresh.fallback',
      level: 'warn',
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
