import '@/providers';

import { createMockEl } from '@test/helpers/mockElement';
import { Notice } from 'obsidian';

import { readBundledChangelog } from '@/app/changelog/source';
import { DEFAULT_GRIMOIRE_SETTINGS } from '@/app/settings/defaultSettings';
import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '@/core/providers/ProviderWorkspaceRegistry';
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
    getResolvedProviderCliPath: jest.fn().mockReturnValue(null),
    refreshShellTranslations: jest.fn(),
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

function renderDeclarativeSettings(
  tab: GrimoireSettingTab,
  settingEl: any = createMockEl('div'),
): { group: { addClass: jest.Mock }; settingEl: any } {
  const [definition] = tab.getSettingDefinitions();
  const group = { addClass: jest.fn() };
  if ('render' in definition && typeof definition.render === 'function') {
    definition.render({ settingEl } as any, group as any);
  }
  return { group, settingEl };
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
    const container = createMockEl('div');
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    expect(collectText(container)).not.toContain('Theme');
    expect(collectText(container)).not.toContain('Follows Obsidian');
    expect(container.querySelector('.grimoire-theme-card')).toBeNull();
  });

  it('renders the plugin version and permanent what\'s new action in settings', () => {
    const plugin = createSettingsPlugin();
    const app = createSettingsApp();
    const tab = new GrimoireSettingTab(app, plugin);
    const { settingEl } = renderDeclarativeSettings(tab);

    const versionEl = settingEl.querySelector('.grimoire-settings-version-row');
    expect(collectText(versionEl)).toContain('Version');
    expect(collectText(versionEl)).toContain('Grimoire v9.8.7-test');
    expect(versionEl?.querySelector('.grimoire-settings-whats-new')?.textContent).toBe('What\'s new');
  });

  it('keeps the custom settings page searchable without inheriting the outer setting-group styles', () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);

    const [definition] = tab.getSettingDefinitions();
    expect(definition).toMatchObject({
      name: 'Grimoire settings',
      desc: 'Configure Grimoire, its workspace, and provider integrations.',
    });
    expect('aliases' in definition ? definition.aliases : []).toEqual(expect.arrayContaining([
      'Maximum chat tabs',
      'Claude Code',
      'Project workspace',
    ]));
    expect('render' in definition).toBe(true);

    const settingEl = createMockEl('div');
    settingEl.addClass('setting-item');
    const { group } = renderDeclarativeSettings(tab, settingEl);

    expect(Object.prototype.hasOwnProperty.call(GrimoireSettingTab.prototype, 'display')).toBe(false);
    expect(group.addClass).toHaveBeenCalledWith('grimoire-settings-root-group');
    expect(settingEl.hasClass('setting-item')).toBe(false);
    expect(settingEl.hasClass('grimoire-settings')).toBe(true);
    expect(collectText(settingEl)).toContain('Maximum chat tabs');
  });

  it('opens bundled release notes for the current version from the what\'s new action', async () => {
    const plugin = createSettingsPlugin();
    const app = createSettingsApp();
    const tab = new GrimoireSettingTab(app, plugin);
    const { settingEl } = renderDeclarativeSettings(tab);

    const button = settingEl.querySelector('.grimoire-settings-whats-new');
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
    const { settingEl } = renderDeclarativeSettings(tab);

    const button = settingEl.querySelector('.grimoire-settings-whats-new');
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
    const container = createMockEl('div');
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    const allText = collectText(container);
    expect(allText).toContain('Maximum chat tabs');
    expect(allText).toContain('Maximum number of concurrent chat tabs (1-10).');
    expect(container.querySelector('.grimoire-adv')).toBeNull();
    expect(allText).not.toContain('Debug logging');
    expect(allText).not.toContain('Tab bar position');
    expect(container.querySelector('.grimoire-slider-value')?.textContent).toBe('5');
  });

  it('renders the debug logging toggle in the Advanced General section', () => {
    const plugin = createSettingsPlugin({ debugLoggingEnabled: false });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div');
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralAdvancedSettings(container);

    const advancedText = collectText(container);
    expect(advancedText).toContain('Debug logging');
    expect(advancedText).toContain('.grimoire/logs/YYYY-MM-DD.jsonl');
  });

  it('renders the usage indicators toggle in the Advanced General section', () => {
    const plugin = createSettingsPlugin({ usageIndicatorsEnabled: true });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div');
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralAdvancedSettings(container);

    const advancedText = collectText(container);
    expect(advancedText).toContain('Usage indicators');
    expect(advancedText).toContain('Show plan usage and API spend indicators');
  });

  it('renders the manual send button setting in the Advanced General section', () => {
    const plugin = createSettingsPlugin({ requireCommandOrControlEnterToSend: false });
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const container = createMockEl('div');
    (tab as any).containerEl = createMockEl('div');

    (tab as any).renderGeneralAdvancedSettings(container);

    const advancedText = collectText(container);
    expect(advancedText).toContain('Send only with button');
    expect(advancedText).toContain('Use the Send button to submit');
    expect(advancedText).not.toContain('Require Command/Ctrl+Enter to send');
  });

  it('keeps environment settings out of General', () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    const container = createMockEl('div');

    (tab as any).renderGeneralTab(container);

    expect(container.querySelector('.grimoire-settings-env-textarea')).toBeNull();
    expect(collectText(container)).not.toContain('Shared environment');
  });
});

describe('GrimoireSettingTab settings hub', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    setLocale('en');
  });

  it('rolls back a provider toggle when its model catalog cannot start', async () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    const refreshModels = jest.fn().mockRejectedValue(
      Object.assign(new Error('spawn qwen ENOENT'), { code: 'ENOENT' }),
    );
    jest.spyOn(ProviderWorkspaceRegistry, 'getModelCatalog').mockReturnValue({
      isAvailable: () => true,
      refreshModels,
    });

    await (tab as any).updateProviderEnabled('qwen', true);

    expect(refreshModels).toHaveBeenCalledTimes(1);
    expect(ProviderRegistry.isEnabled('qwen', plugin.settings)).toBe(false);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(Notice).toHaveBeenCalledWith('Could not load provider models.');
  });

  it('renders the four top-level settings tabs', () => {
    const plugin = createSettingsPlugin();
    const app: any = { hotkeyManager: {} };
    const tab = new GrimoireSettingTab(app, plugin);
    const { settingEl } = renderDeclarativeSettings(tab);

    const tabLabels = Array.from(
      settingEl.querySelectorAll('.grimoire-settings-tab'),
    ).map((button: any) => button.textContent?.trim() ?? '');

    expect(tabLabels).toEqual(['General', 'Providers', 'Advanced', 'About']);
    expect(settingEl.querySelector('.grimoire-settings-tab-count')).toBeNull();
  });

  it('re-renders every settings tab immediately after changing the locale in General', async () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    const { settingEl } = renderDeclarativeSettings(tab);
    const languageSelect = settingEl.querySelector('.grimoire-settings-language-select');

    languageSelect.value = 'zh-CN';
    languageSelect.dispatchEvent('change');
    await new Promise(resolve => window.setTimeout(resolve, 0));

    const tabLabels = Array.from<any>(
      settingEl.querySelectorAll('.grimoire-settings-tab'),
    ).map(button => button.textContent?.trim() ?? '');
    expect(tabLabels).toEqual(['常规', '供应商', '高级设置', '关于']);
    expect(plugin.refreshShellTranslations).toHaveBeenCalledTimes(1);

    const providerTab = settingEl.querySelectorAll('.grimoire-settings-tab')[1];
    providerTab.dispatchEvent('click');
    await new Promise(resolve => window.setTimeout(resolve, 50));

    const providerNames = Array.from<any>(
      settingEl.querySelectorAll('.grimoire-settings-provider-card-name'),
    ).map(element => element.textContent?.trim() ?? '');
    expect(providerNames).toContain('Gemini CLI（旧版）');
  });

  it('renders provider cards in registry order inside Providers', () => {
    const plugin = createSettingsPlugin();
    plugin.getResolvedProviderCliPath.mockImplementation((providerId: string) => `/bin/${providerId}`);
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    (tab as any).activeTab = 'providers';
    const { settingEl } = renderDeclarativeSettings(tab);
    const providerNames = Array.from(
      settingEl.querySelectorAll('.grimoire-settings-provider-card-name'),
    ).map((element: any) => element.textContent?.trim() ?? '');

    expect(providerNames).toEqual([
      'Claude Code',
      'Codex',
      'OpenCode',
      'Grok Build',
      'MiMoCode',
      'Kimi Code',
      'Antigravity',
      'Gemini CLI (Legacy)',
      'Qwen Code',
    ]);
    expect(collectText(settingEl)).not.toContain('Enabled');
    expect(collectText(settingEl)).not.toContain('Disabled');
    expect(settingEl.querySelector('.grimoire-settings-provider-card-meta')?.textContent).toBe('CLI detected');
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

  it('reports only CLI availability regardless of persisted provider models', () => {
    const plugin = createSettingsPlugin();
    plugin.settings.providerConfigs.claude.discoveredModels = [
      { rawId: 'stale-model' },
    ];
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);

    expect((tab as any).getProviderStatusText('claude')).toBe('CLI not detected');
  });

  it('localizes the legacy Gemini provider name in Chinese', () => {
    const plugin = createSettingsPlugin();
    plugin.settings.locale = 'zh-CN';
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    (tab as any).activeTab = 'providers';
    const { settingEl } = renderDeclarativeSettings(tab);
    const providerNames = Array.from(
      settingEl.querySelectorAll('.grimoire-settings-provider-card-name'),
    ).map((element: any) => element.textContent?.trim() ?? '');

    expect(providerNames).toContain('Gemini CLI（旧版）');
    expect(providerNames).not.toContain('Gemini CLI (Legacy)');
  });

  it('renders six Advanced sections and moves General advanced settings into a direct page', () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    const container = createMockEl('div');

    (tab as any).renderWorkspaceHub(container, ProviderRegistry.getRegisteredProviderIds());

    const navigation = container.children[0];
    const sectionLabels = Array.from(
      navigation?.children ?? [],
    ).map((button: any) => button.textContent?.trim() ?? '');
    expect(sectionLabels).toEqual([
      'General',
      'Skills',
      'Subagents',
      'MCP',
      'Environment',
      'Commands',
    ]);
    expect(collectText(container)).toContain('Debug logging');
    expect(container.querySelector('.grimoire-adv')).toBeNull();
    expect(container.querySelector('.grimoire-settings-resource-toolbar')).toBeNull();
    expect(container.querySelector('.grimoire-settings-resource-list')).toBeNull();
    expect(collectText(container)).not.toContain('Advanced · Skills');
  });

  it('omits the resource type column and renders edit/delete row actions', () => {
    const plugin = createSettingsPlugin();
    const tab = new GrimoireSettingTab(createSettingsApp(), plugin);
    const container = createMockEl('div');
    const resourceArea = createMockEl('div');

    (tab as any).renderWorkspaceHubRows(container, [{
      key: 'skill:claude:review',
      section: 'skills',
      name: 'review',
      description: 'Review code',
      source: '.claude/skills/',
      providerIds: ['claude'],
      ownerProviderId: 'claude',
      readonly: false,
      status: 'available',
      deleteResource: jest.fn().mockResolvedValue(undefined),
    }], '', ProviderRegistry.getRegisteredProviderIds(), resourceArea);

    expect(container.children[0].children.map((cell: any) => cell.textContent)).toEqual([
      'Name',
      'Source',
      'Provider',
      'Actions',
    ]);
    const actionButtons = container.children[1].children[3].children;
    expect(actionButtons[0].hasClass('grimoire-settings-resource-edit')).toBe(true);
    expect(actionButtons[1].hasClass('grimoire-settings-resource-delete')).toBe(true);
  });

  it('renders accessible overflow controls and updates their boundary state', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div');
    renderDeclarativeSettings(tab, container);

    const tabBar = container.querySelector('.grimoire-settings-tabs');
    const viewport = container.querySelector('.grimoire-settings-tabs-viewport');
    const previous = container.querySelector('.grimoire-settings-tab-scroll--previous');
    const next = container.querySelector('.grimoire-settings-tab-scroll--next');
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
    const container = createMockEl('div');
    renderDeclarativeSettings(tab, container);

    const viewport = container.querySelector('.grimoire-settings-tabs-viewport');
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

  it('skips scrollIntoView when the compact tab bar is not overflowing', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div');
    renderDeclarativeSettings(tab, container);

    const buttons = Array.from<any>(container.querySelectorAll('.grimoire-settings-tab'));
    const reveal = jest.fn();
    buttons[1].scrollIntoView = reveal;
    buttons[1].dispatchEvent('click');

    expect(reveal).not.toHaveBeenCalled();
  });

  it('renders each top-level tab once and reuses it on later switches', async () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const generalRender = jest.spyOn(tab as any, 'renderGeneralHub');
    const providerRender = jest.spyOn(tab as any, 'renderProvidersHub');
    const container = createMockEl('div');
    renderDeclarativeSettings(tab, container);
    const buttons = Array.from<any>(container.querySelectorAll('.grimoire-settings-tab'));

    buttons[1].dispatchEvent('click');
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    buttons[0].dispatchEvent('click');
    buttons[1].dispatchEvent('click');

    expect(generalRender).toHaveBeenCalledTimes(1);
    expect(providerRender).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.grimoire-settings-tab-content')).toHaveLength(4);
  });

  it('activates, focuses, and reveals keyboard-selected tabs', () => {
    const tab = new GrimoireSettingTab(createSettingsApp(), createSettingsPlugin());
    const container = createMockEl('div');
    renderDeclarativeSettings(tab, container);

    const buttons = Array.from<any>(container.querySelectorAll('.grimoire-settings-tab'));
    const viewport = container.querySelector('.grimoire-settings-tabs-viewport');
    viewport.clientWidth = 100;
    viewport.scrollWidth = 300;
    viewport.dispatchEvent('scroll');
    const reveal = jest.fn();
    const focus = jest.fn();
    buttons[1].scrollIntoView = reveal;
    buttons[1].focus = focus;
    const preventDefault = jest.fn();
    viewport.dispatchEvent({
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
