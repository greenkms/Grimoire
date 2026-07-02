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
    ]);
  });
});
