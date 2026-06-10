import {
  GRIMOIRE_SETTINGS_PATH,
  GrimoireSettingsStorage,
} from '@/app/settings/GrimoireSettingsStorage';

describe('GrimoireSettingsStorage legacy appearance theme cleanup', () => {
  it('drops legacy appearance theme values from loaded settings and persists the cleanup', async () => {
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

    expect(settings).not.toHaveProperty('appearanceTheme');
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(writes[0]?.path).toBe(GRIMOIRE_SETTINGS_PATH);
    expect(JSON.parse(writes[0]?.content ?? '{}')).not.toHaveProperty('appearanceTheme');
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
