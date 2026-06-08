import { createMockEl } from '@test/helpers/mockElement';

import { DEFAULT_GRIMOIRE_SETTINGS } from '@/app/settings/defaultSettings';
import { GrimoireSettingTab } from '@/features/settings/GrimoireSettings';
import { setLocale } from '@/i18n/i18n';

function collectText(el: any): string {
  return [
    el.textContent ?? '',
    ...(el.children ?? []).map((child: any) => collectText(child)),
  ].filter(Boolean).join(' ');
}

function createSettingsPlugin(overrides: Record<string, any> = {}): any {
  return {
    settings: {
      ...DEFAULT_GRIMOIRE_SETTINGS,
      ...overrides,
    },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    getAllViews: jest.fn().mockReturnValue([]),
    getEnvironmentVariablesForScope: jest.fn().mockReturnValue(''),
    applyEnvironmentVariables: jest.fn().mockResolvedValue(undefined),
    applyEnvironmentVariablesBatch: jest.fn().mockResolvedValue(undefined),
  };
}

describe('GrimoireSettingTab appearance settings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders every theme card with a swatch and a bounded copy wrapper', () => {
    const plugin: any = {
      settings: {
        appearanceTheme: 'violet',
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
      getAllViews: jest.fn().mockReturnValue([]),
    };
    const tab = new GrimoireSettingTab({} as any, plugin);
    const container = createMockEl('div') as unknown as HTMLElement;

    (tab as any).renderAppearanceThemeSetting(container);

    const cards = (container as any).querySelectorAll('.grimoire-theme-card');
    expect(cards.map((card: any) => card.getAttribute('data-theme-option'))).toEqual([
      'violet',
      'graphite',
      'rune',
      'verdant',
    ]);

    for (const card of cards) {
      expect(card.querySelector('.grimoire-theme-swatch')).not.toBeNull();

      const copy = card.querySelector('.grimoire-theme-card-copy');
      expect(copy).not.toBeNull();
      expect(copy?.querySelector('.grimoire-theme-card-name')).not.toBeNull();
      expect(copy?.querySelector('.grimoire-theme-card-desc')).not.toBeNull();
    }
  });

  it('updates the settings root theme token when choosing another appearance theme', async () => {
    const syncAppearanceTheme = jest.fn();
    const plugin: any = {
      settings: {
        appearanceTheme: 'violet',
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
      getAllViews: jest.fn().mockReturnValue([{ syncAppearanceTheme }]),
    };
    const tab = new GrimoireSettingTab({} as any, plugin);
    const container = createMockEl('div') as any;
    container.addClass('grimoire-settings');
    (tab as any).containerEl = container;

    (tab as any).renderAppearanceThemeSetting(container);

    const graphiteCard = container
      .querySelectorAll('.grimoire-theme-card')
      .find((card: any) => card.getAttribute('data-theme-option') === 'graphite');
    graphiteCard?.click();
    await Promise.resolve();

    expect(container.dataset.theme).toBe('graphite');
    expect(plugin.settings.appearanceTheme).toBe('graphite');
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(syncAppearanceTheme).toHaveBeenCalled();
  });
});

describe('GrimoireSettingTab general tab settings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders the maximum chat tabs control in General and removes tab bar placement', () => {
    const plugin = createSettingsPlugin({ maxTabs: 5, tabBarPosition: 'input' });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div') as any;
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    const allText = collectText(container);
    const advancedText = collectText(container.querySelector('.grimoire-adv-body'));

    expect(allText).toContain('Maximum chat tabs');
    expect(allText).toContain('Maximum number of concurrent chat tabs (1-10).');
    expect(advancedText).not.toContain('Maximum chat tabs');
    expect(allText).not.toContain('Tab bar position');
    expect(container.querySelector('.grimoire-slider-value')?.textContent).toBe('5');
  });

  it('renders the debug logging toggle inside General advanced settings', () => {
    const plugin = createSettingsPlugin({ debugLoggingEnabled: false });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div') as any;
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    const advancedText = collectText(container.querySelector('.grimoire-adv-body'));
    expect(advancedText).toContain('Debug logging');
    expect(advancedText).toContain('.grimoire/logs/YYYY-MM-DD.jsonl');
  });

  it('renders the usage indicators toggle inside General advanced settings', () => {
    const plugin = createSettingsPlugin({ usageIndicatorsEnabled: true });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div') as any;
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    const advancedText = collectText(container.querySelector('.grimoire-adv-body'));
    expect(advancedText).toContain('Usage indicators');
    expect(advancedText).toContain('Show plan usage and API spend indicators');
  });
});
