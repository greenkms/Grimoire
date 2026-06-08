import {
  GRIMOIRE_SETTINGS_PATH,
  GrimoireSettingsStorage,
} from '@/app/settings/GrimoireSettingsStorage';

describe('GrimoireSettingsStorage appearance theme normalization', () => {
  it('migrates legacy appearance theme ids to design handoff ids', async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const adapter = {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(JSON.stringify({
        appearanceTheme: 'graphite-blue',
      })),
      rename: jest.fn(),
      write: jest.fn(async (path: string, content: string) => {
        writes.push({ path, content });
      }),
    };
    const storage = new GrimoireSettingsStorage(adapter as never);

    const settings = await storage.load();

    expect(settings.appearanceTheme).toBe('graphite');
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(writes[0]?.path).toBe(GRIMOIRE_SETTINGS_PATH);
    expect(JSON.parse(writes[0]?.content ?? '{}')).toMatchObject({
      appearanceTheme: 'graphite',
    });
  });

  it('migrates the removed Ivory appearance theme back to Violet', async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const adapter = {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(JSON.stringify({
        appearanceTheme: 'ivory',
      })),
      rename: jest.fn(),
      write: jest.fn(async (path: string, content: string) => {
        writes.push({ path, content });
      }),
    };
    const storage = new GrimoireSettingsStorage(adapter as never);

    const settings = await storage.load();

    expect(settings.appearanceTheme).toBe('violet');
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(writes[0]?.path).toBe(GRIMOIRE_SETTINGS_PATH);
    expect(JSON.parse(writes[0]?.content ?? '{}')).toMatchObject({
      appearanceTheme: 'violet',
    });
  });

  it('normalizes invalid debug logging values back to disabled and persists the cleanup', async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const adapter = {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(JSON.stringify({
        debugLoggingEnabled: 'true',
      })),
      rename: jest.fn(),
      write: jest.fn(async (path: string, content: string) => {
        writes.push({ path, content });
      }),
    };
    const storage = new GrimoireSettingsStorage(adapter as never);

    const settings = await storage.load();

    expect(settings.debugLoggingEnabled).toBe(false);
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(writes[0]?.path).toBe(GRIMOIRE_SETTINGS_PATH);
    expect(JSON.parse(writes[0]?.content ?? '{}')).toMatchObject({
      debugLoggingEnabled: false,
    });
  });

  it('normalizes invalid usage indicator values back to enabled and persists the cleanup', async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const adapter = {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(JSON.stringify({
        usageIndicatorsEnabled: 'false',
      })),
      rename: jest.fn(),
      write: jest.fn(async (path: string, content: string) => {
        writes.push({ path, content });
      }),
    };
    const storage = new GrimoireSettingsStorage(adapter as never);

    const settings = await storage.load();

    expect(settings.usageIndicatorsEnabled).toBe(true);
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(writes[0]?.path).toBe(GRIMOIRE_SETTINGS_PATH);
    expect(JSON.parse(writes[0]?.content ?? '{}')).toMatchObject({
      usageIndicatorsEnabled: true,
    });
  });
});
