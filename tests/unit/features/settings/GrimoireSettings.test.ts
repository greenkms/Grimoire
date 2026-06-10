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

describe('GrimoireSettingTab general tab settings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('does not render Grimoire-specific appearance theme controls', () => {
    const plugin = createSettingsPlugin();
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div') as any;
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    expect(collectText(container)).not.toContain('Appearance theme');
    expect(container.querySelector('.grimoire-theme-card')).toBeNull();
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
