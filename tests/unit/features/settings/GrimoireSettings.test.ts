import '@/providers';

import { createMockEl } from '@test/helpers/mockElement';
import { Notice } from 'obsidian';

import { readBundledChangelog } from '@/app/changelog/source';
import { DEFAULT_GRIMOIRE_SETTINGS } from '@/app/settings/defaultSettings';
import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { GrimoireSettingTab } from '@/features/settings/GrimoireSettings';
import { setLocale } from '@/i18n/i18n';
import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';

jest.mock('@/shared/modals/WhatsNewModal', () => ({
  showWhatsNewModal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/changelog/source', () => ({
  GRIMOIRE_CHANGELOG_URL: 'https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md',
  readBundledChangelog: jest.fn().mockResolvedValue('# Changelog\n\n## 9.8.7\n\n### Added\n\n- Manual release note.'),
}));

function collectText(el: any): string {
  return [
    el.textContent ?? '',
    ...(el.children ?? []).map((child: any) => collectText(child)),
  ].filter(Boolean).join(' ');
}

function createSettingsPlugin(overrides: Record<string, any> = {}): any {
  return {
    manifest: { version: '9.8.7-test' },
    settings: {
      ...DEFAULT_GRIMOIRE_SETTINGS,
      ...overrides,
    },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    getAllViews: jest.fn().mockReturnValue([]),
    getActiveEnvironmentVariables: jest.fn().mockReturnValue(''),
    getEnvironmentVariablesForScope: jest.fn().mockReturnValue(''),
    applyEnvironmentVariables: jest.fn().mockResolvedValue(undefined),
    applyEnvironmentVariablesBatch: jest.fn().mockResolvedValue(undefined),
  };
}

function createSettingsApp(): any {
  return {
    hotkeyManager: {},
    vault: {
      adapter: {},
    },
  };
}

describe('GrimoireSettingTab general tab settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders the plugin version and permanent what\'s new action in settings', () => {
    const plugin = createSettingsPlugin();
    const app = createSettingsApp();
    const tab = new GrimoireSettingTab(app, plugin);
    (tab as any).containerEl = createMockEl('div');

    tab.display();

    const versionEl = (tab as any).containerEl.querySelector('.grimoire-settings-version');
    expect(collectText(versionEl)).toContain('Grimoire v9.8.7-test');
    expect(versionEl?.querySelector('.grimoire-settings-whats-new')?.textContent).toBe('What\'s new');
  });

  it('indexes the existing settings UI through the Obsidian 1.13 declarative API', () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);

    const [definition] = tab.getSettingDefinitions();

    expect(definition).toEqual(expect.objectContaining({
      name: 'Grimoire settings',
      aliases: expect.arrayContaining(['Debug logging', 'Grok Build', 'Maximum chat tabs']),
    }));
    expect('render' in definition!).toBe(true);

    const settingEl = createMockEl('div');
    settingEl.addClass('setting-item');
    if (definition && 'render' in definition && definition.render) {
      definition.render({ settingEl } as any, {} as any);
    }

    expect(settingEl.hasClass('setting-item')).toBe(false);
    expect(settingEl.hasClass('grimoire-settings')).toBe(true);
    expect(collectText(settingEl)).toContain('Maximum chat tabs');
  });

  it('opens bundled release notes for the current version from the what\'s new action', async () => {
    const plugin = createSettingsPlugin();
    const app = createSettingsApp();
    const tab = new GrimoireSettingTab(app, plugin);
    (tab as any).containerEl = createMockEl('div');

    tab.display();

    const button = (tab as any).containerEl.querySelector('.grimoire-settings-whats-new');
    button?.dispatchEvent('click');
    await Promise.resolve();
    await Promise.resolve();

    expect(readBundledChangelog).toHaveBeenCalledWith(app.vault.adapter, plugin.manifest);
    expect(showWhatsNewModal).toHaveBeenCalledWith({
      app,
      fullChangelogUrl: 'https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md',
      release: expect.objectContaining({
        version: '9.8.7',
      }),
    });
  });

  it('shows a notice when no bundled release notes match the current version', async () => {
    (readBundledChangelog as jest.Mock).mockResolvedValueOnce('# Changelog\n\n## 1.2.3\n\n- Older release.');
    const plugin = createSettingsPlugin();
    const app = createSettingsApp();
    const tab = new GrimoireSettingTab(app, plugin);
    (tab as any).containerEl = createMockEl('div');

    tab.display();

    const button = (tab as any).containerEl.querySelector('.grimoire-settings-whats-new');
    button?.dispatchEvent('click');
    await Promise.resolve();
    await Promise.resolve();

    expect(showWhatsNewModal).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith('No release notes are bundled for this Grimoire version.');
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

  it('renders the manual send button setting inside General advanced settings', () => {
    const plugin = createSettingsPlugin({ requireCommandOrControlEnterToSend: false });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div') as any;
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    const advancedText = collectText(container.querySelector('.grimoire-adv-body'));
    expect(advancedText).toContain('Send only with button');
    expect(advancedText).toContain('Use the Send button to submit');
    expect(advancedText).not.toContain('Require Command/Ctrl+Enter to send');
  });
});

describe('GrimoireSettingTab provider tabs', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders provider settings tabs in registry order after General', () => {
    const plugin = createSettingsPlugin();
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    (tab as any).containerEl = createMockEl('div');

    tab.display();

    const tabLabels = Array.from(
      (tab as any).containerEl.querySelectorAll('.grimoire-settings-tab'),
    ).map((button: any) => button.textContent?.trim() ?? '');

    expect(tabLabels[0]).toBe('General');
    expect(tabLabels.slice(1)).toEqual([
      'Claude Code',
      'Codex',
      'OpenCode',
      'Grok Build',
      'MiMo Code',
      'Kimi Code',
      'Antigravity',
      'Gemini CLI (Legacy)',
      'Qwen Code',
    ]);
    expect(ProviderRegistry.getRegisteredProviderIds()).toEqual([
      'claude',
      'codex',
      'opencode',
      'grok',
      'mimocode',
      'kimicode',
      'antigravity',
      'gemini',
      'qwen',
    ]);
  });

  it('renders accessible overflow controls and updates their boundary state', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div') as any;
    (tab as any).containerEl = container;
    tab.display();

    const tabBar = container.querySelector('.grimoire-settings-tabs') as any;
    const viewport = container.querySelector('.grimoire-settings-tabs-viewport') as any;
    const previous = container.querySelector('.grimoire-settings-tab-scroll--previous') as any;
    const next = container.querySelector('.grimoire-settings-tab-scroll--next') as any;
    viewport.clientWidth = 100;
    viewport.scrollWidth = 300;
    viewport.scrollLeft = 0;
    viewport.dispatchEvent('scroll');

    expect(previous.getAttribute('aria-label')).toBe('Scroll settings tabs backward');
    expect(next.getAttribute('aria-label')).toBe('Scroll settings tabs forward');
    expect(tabBar.hasClass('is-overflowing')).toBe(true);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    viewport.scrollLeft = 200;
    viewport.dispatchEvent('scroll');
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);
    expect(tabBar.hasClass('can-scroll-prev')).toBe(true);

    tab.hide();
    expect(viewport.getEventListenerCount('scroll')).toBe(0);
    expect(viewport.getEventListenerCount('wheel')).toBe(0);
    expect(viewport.getEventListenerCount('keydown')).toBe(0);
  });

  it('uses wheel movement only when the overflowing tab list moves', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div') as any;
    (tab as any).containerEl = container;
    tab.display();

    const viewport = container.querySelector('.grimoire-settings-tabs-viewport') as any;
    viewport.clientWidth = 100;
    viewport.scrollWidth = 300;
    viewport.scrollLeft = 0;
    const preventDefault = jest.fn();
    viewport.dispatchEvent({ type: 'wheel', deltaX: 0, deltaY: 40, preventDefault });
    expect(viewport.scrollLeft).toBe(40);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    viewport.scrollLeft = 200;
    viewport.dispatchEvent({ type: 'wheel', deltaX: 40, deltaY: 0, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('activates, focuses, and reveals keyboard-selected tabs', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div') as any;
    (tab as any).containerEl = container;
    tab.display();

    const buttons = Array.from(container.querySelectorAll('.grimoire-settings-tab')) as any[];
    const reveal = jest.fn();
    const focus = jest.fn();
    buttons[1].scrollIntoView = reveal;
    buttons[1].focus = focus;
    const preventDefault = jest.fn();
    container.querySelector('.grimoire-settings-tabs-viewport').dispatchEvent({
      key: 'ArrowRight', preventDefault, target: buttons[0], type: 'keydown',
    });

    expect(buttons[1].hasClass('grimoire-settings-tab--active')).toBe(true);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(buttons[1].tabIndex).toBe(0);
    expect(focus).toHaveBeenCalled();
    expect(reveal).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });
});
