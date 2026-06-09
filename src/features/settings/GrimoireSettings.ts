import type { App } from 'obsidian';
import { Notice, Platform, PluginSettingTab, Setting } from 'obsidian';

import {
  getHiddenProviderCommands,
  normalizeHiddenCommandList,
} from '../../core/providers/commands/hiddenCommands';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from '../../core/providers/ProviderSettingsCoordinator';
import { ProviderWorkspaceRegistry } from '../../core/providers/ProviderWorkspaceRegistry';
import type { ProviderId } from '../../core/providers/types';
import {
  type ChatViewPlacement,
  type GrimoireAppearanceTheme,
  MAX_TABS,
  MIN_TABS,
  normalizeMaxTabs,
} from '../../core/types/settings';
import { getAvailableLocales, getLocaleDisplayName, setLocale, t } from '../../i18n/i18n';
import type { Locale, TranslationKey } from '../../i18n/types';
import type GrimoirePlugin from '../../main';
import { getClaudeProviderSettings, updateClaudeProviderSettings } from '../../providers/claude/settings';
import { getCodexProviderSettings, updateCodexProviderSettings } from '../../providers/codex/settings';
import { getGeminiProviderSettings, updateGeminiProviderSettings } from '../../providers/gemini/settings';
import { getOpencodeProviderSettings, updateOpencodeProviderSettings } from '../../providers/opencode/settings';
import { formatContextLimit, parseContextLimit, parseEnvironmentVariables } from '../../utils/env';
import { buildNavMappingText, parseNavMappings } from './keyboardNavigation';
import { renderProjectWorkspaceSettings } from './ProjectWorkspaceSettings';
import { renderAdvancedSection } from './ui/AdvancedSection';
import { renderEnvironmentSettingsSection } from './ui/EnvironmentSettingsSection';

type SettingsTabId = string;
type ObsidianHotkey = { modifiers: string[]; key: string };
type ObsidianHotkeyManager = {
  customKeys?: Record<string, ObsidianHotkey[] | undefined>;
  defaultKeys?: Record<string, ObsidianHotkey[] | undefined>;
};
type ObsidianHotkeyTab = {
  searchInputEl?: HTMLInputElement;
  searchComponent?: { inputEl?: HTMLInputElement };
  updateHotkeyVisibility?: () => void;
};
type ObsidianSettingsController = {
  activeTab?: ObsidianHotkeyTab;
  open: () => void;
  openTabById: (id: string) => void;
};
type AppWithHotkeyInternals = App & {
  hotkeyManager?: ObsidianHotkeyManager;
  setting?: ObsidianSettingsController;
};

function formatHotkey(hotkey: ObsidianHotkey): string {
  const isMac = Platform.isMacOS;
  const modMap: Record<string, string> = isMac
    ? { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' }
    : { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win' };

  const mods = hotkey.modifiers.map((modifier) => modMap[modifier] || modifier);
  const key = hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key;

  return isMac ? [...mods, key].join('') : [...mods, key].join('+');
}

function openHotkeySettings(app: App): void {
  const setting = (app as AppWithHotkeyInternals).setting;
  if (!setting) {
    return;
  }

  setting.open();
  setting.openTabById('hotkeys');
  window.setTimeout(() => {
    const tab = setting.activeTab;
    if (!tab) {
      return;
    }

    const searchEl = tab.searchInputEl ?? tab.searchComponent?.inputEl;
    if (!searchEl) {
      return;
    }

    searchEl.value = 'Grimoire';
    tab.updateHotkeyVisibility?.();
  }, 100);
}

function getHotkeyForCommand(app: App, commandId: string): string | null {
  const hotkeyManager = (app as AppWithHotkeyInternals).hotkeyManager;
  if (!hotkeyManager) return null;

  const customHotkeys = hotkeyManager.customKeys?.[commandId];
  const defaultHotkeys = hotkeyManager.defaultKeys?.[commandId];
  const hotkeys = customHotkeys && customHotkeys.length > 0 ? customHotkeys : defaultHotkeys;

  if (!hotkeys || hotkeys.length === 0) return null;

  return hotkeys.map(formatHotkey).join(', ');
}

function addHotkeySettingRow(
  containerEl: HTMLElement,
  app: App,
  commandId: string,
  translationPrefix: string,
): void {
  const hotkey = getHotkeyForCommand(app, commandId);
  const item = containerEl.createDiv({ cls: 'grimoire-hotkey-item' });
  item.createSpan({
    cls: 'grimoire-hotkey-name',
    text: t(`${translationPrefix}.name` as TranslationKey),
  });
  if (hotkey) {
    item.createSpan({ cls: 'grimoire-hotkey-badge', text: hotkey });
  }
  item.addEventListener('click', () => openHotkeySettings(app));
}

function refreshSettingsTab(tab: PluginSettingTab): void {
  // Obsidian 1.13 prefers declarative settings, but this tab still owns a
  // custom provider-aware layout that needs an imperative re-render.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  tab.display();
}

const APPEARANCE_THEME_OPTIONS: Array<{
  accent: string;
  id: GrimoireAppearanceTheme;
}> = [
  { id: 'violet', accent: '#8b5cf6' },
  { id: 'graphite', accent: '#6ea8ff' },
  { id: 'rune', accent: '#d97757' },
  { id: 'verdant', accent: '#34b87a' },
];

const PROVIDER_SETTING_COPY: Record<ProviderId, { desc: string; name: string }> = {
  claude: {
    desc: 'Anthropic\'s agentic CLI. Recommended default.',
    name: 'Claude Code',
  },
  codex: {
    desc: 'OpenAI\'s coding agent.',
    name: 'Codex',
  },
  gemini: {
    desc: 'Google\'s CLI agent.',
    name: 'Gemini',
  },
  opencode: {
    desc: 'Open-source, multi-vendor. Exposes the widest model catalog.',
    name: 'OpenCode',
  },
};

export class GrimoireSettingTab extends PluginSettingTab {
  plugin: GrimoirePlugin;
  private activeTab: SettingsTabId = 'general';

  constructor(app: App, plugin: GrimoirePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('grimoire-settings');
    // Carry the selected appearance theme so the settings tab inherits the
    // matching brand accent (mirrors GrimoireView.syncAppearanceTheme()).
    containerEl.dataset.theme = this.plugin.settings.appearanceTheme ?? 'violet';

    setLocale(this.plugin.settings.locale as Locale);

    const providerTabs = ProviderRegistry.getRegisteredProviderIds();
    const tabIds: SettingsTabId[] = ['general', ...providerTabs];
    if (!tabIds.includes(this.activeTab)) {
      this.activeTab = 'general';
    }

    const tabBar = containerEl.createDiv({ cls: 'grimoire-settings-tabs' });
    const tabButtons = new Map<SettingsTabId, HTMLButtonElement>();
    const tabContents = new Map<SettingsTabId, HTMLDivElement>();

    for (const id of tabIds) {
      const label = id === 'general'
        ? t('settings.tabs.general' as TranslationKey)
        : (PROVIDER_SETTING_COPY[id]?.name ?? ProviderRegistry.getProviderDisplayName(id));
      const button = tabBar.createEl('button', {
        cls: `grimoire-settings-tab${id === this.activeTab ? ' grimoire-settings-tab--active' : ''}`,
        text: label,
      });
      if (id !== 'general') {
        button.createSpan({
          cls: `grimoire-settings-tab-status${ProviderRegistry.isEnabled(id, this.plugin.settings) ? ' is-enabled' : ''}`,
        });
      }
      button.addEventListener('click', () => {
        this.activeTab = id;
        for (const tabId of tabIds) {
          tabButtons.get(tabId)?.toggleClass('grimoire-settings-tab--active', tabId === id);
          tabContents.get(tabId)?.toggleClass('grimoire-settings-tab-content--active', tabId === id);
        }
      });
      tabButtons.set(id, button);
    }

    for (const id of tabIds) {
      const content = containerEl.createDiv({
        cls: `grimoire-settings-tab-content${id === this.activeTab ? ' grimoire-settings-tab-content--active' : ''}`,
      });
      tabContents.set(id, content);
    }

    this.renderGeneralTab(tabContents.get('general')!);

    for (const providerId of providerTabs) {
      const content = tabContents.get(providerId);
      if (!content) {
        continue;
      }

      ProviderWorkspaceRegistry.getSettingsTabRenderer(providerId)?.render(content, {
        plugin: this.plugin,
        renderHiddenProviderCommandSetting: (
          target,
          targetProviderId,
          copy,
        ) => this.renderHiddenProviderCommandSetting(target, targetProviderId, copy),
        refreshModelSelectors: () => {
          for (const view of this.plugin.getAllViews()) {
            view.refreshModelSelector();
          }
        },
        renderCustomContextLimits: (target, providerId) => this.renderCustomContextLimits(target, providerId),
        renderAdvancedSection: (target, opts) => this.renderAdvancedSection(target, providerId, opts),
      });
    }

    this.markTextareaRows(containerEl);
  }

  private markTextareaRows(containerEl: HTMLElement): void {
    for (const textarea of containerEl.querySelectorAll('textarea')) {
      textarea.closest<HTMLElement>('.setting-item')?.addClass('grimoire-settings-textarea-row');
    }
  }

  private isAdvancedSectionOpen(id: string): boolean {
    return this.plugin.settings.advancedSectionsOpen?.[id] ?? false;
  }

  private async setAdvancedSectionOpen(id: string, open: boolean): Promise<void> {
    this.plugin.settings.advancedSectionsOpen = {
      ...(this.plugin.settings.advancedSectionsOpen ?? {}),
      [id]: open,
    };
    await this.plugin.saveSettings();
  }

  private renderAdvancedSection(
    container: HTMLElement,
    id: string,
    opts: { count: number; summary: string },
  ): HTMLElement {
    return renderAdvancedSection(container, {
      ...opts,
      id,
      isOpen: (sectionId) => this.isAdvancedSectionOpen(sectionId),
      setOpen: (sectionId, open) => this.setAdvancedSectionOpen(sectionId, open),
    });
  }

  private renderGeneralTab(container: HTMLElement): void {
    new Setting(container)
      .setName(t('settings.language.name'))
      .setDesc(t('settings.language.desc'))
      .addDropdown((dropdown) => {
        const locales = getAvailableLocales();
        for (const locale of locales) {
          dropdown.addOption(locale, getLocaleDisplayName(locale));
        }
        dropdown
          .setValue(this.plugin.settings.locale)
          .onChange(async (value) => {
            const locale = value as Locale;
            if (!setLocale(locale)) {
              dropdown.setValue(this.plugin.settings.locale);
              return;
            }
            this.plugin.settings.locale = locale;
            await this.plugin.saveSettings();
            refreshSettingsTab(this);
          });
      });

    this.renderProviderEnableSettings(container);

    // --- Display ---

    new Setting(container).setName(t('settings.display')).setHeading();

    this.renderAppearanceThemeSetting(container);

    new Setting(container)
      .setName(t('settings.chatViewPlacement.name'))
      .setDesc(t('settings.chatViewPlacement.desc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('right-sidebar', t('settings.chatViewPlacement.rightSidebar'))
          .addOption('left-sidebar', t('settings.chatViewPlacement.leftSidebar'))
          .addOption('main-tab', t('settings.chatViewPlacement.mainTab'))
          .setValue(this.plugin.settings.chatViewPlacement)
          .onChange(async (value) => {
            this.plugin.settings.chatViewPlacement = value as ChatViewPlacement;
            await this.plugin.saveSettings();
          });
      });

    this.renderMaxTabsSetting(container);

    new Setting(container)
      .setName(t('settings.enableAutoScroll.name'))
      .setDesc(t('settings.enableAutoScroll.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAutoScroll ?? true)
          .onChange(async (value) => {
            this.plugin.settings.enableAutoScroll = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Conversations ---

    new Setting(container).setName(t('settings.conversations')).setHeading();

    new Setting(container)
      .setName(t('settings.autoTitle.name'))
      .setDesc(t('settings.autoTitle.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAutoTitleGeneration)
          .onChange(async (value) => {
            this.plugin.settings.enableAutoTitleGeneration = value;
            await this.plugin.saveSettings();
            refreshSettingsTab(this);
          })
      );

    // --- Content ---

    new Setting(container).setName(t('settings.content')).setHeading();

    new Setting(container)
      .setName(t('settings.userName.name'))
      .setDesc(t('settings.userName.desc'))
      .addText((text) => {
        text
          .setPlaceholder(t('settings.userName.name'))
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.addEventListener('blur', () => {
          void this.restartServiceForPromptChange();
        });
      });

    const advancedContainer = this.renderAdvancedSection(container, 'general', {
      count: 11,
      summary: 'Prompts, hotkeys, diagnostics, environment variables, and more',
    });

    // --- Display (advanced) ---

    new Setting(advancedContainer).setName(t('settings.display')).setHeading();

    new Setting(advancedContainer)
      .setName(t('settings.deferMathRenderingDuringStreaming.name'))
      .setDesc(t('settings.deferMathRenderingDuringStreaming.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deferMathRenderingDuringStreaming ?? true)
          .onChange(async (value) => {
            this.plugin.settings.deferMathRenderingDuringStreaming = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Conversations (advanced) ---

    new Setting(advancedContainer).setName(t('settings.conversations')).setHeading();

    if (this.plugin.settings.enableAutoTitleGeneration) {
      new Setting(advancedContainer)
        .setName(t('settings.titleModel.name'))
        .setDesc(t('settings.titleModel.desc'))
        .addDropdown((dropdown) => {
          dropdown.addOption('', t('settings.titleModel.auto'));

          const settingsBag = this.plugin.settings as unknown as Record<string, unknown>;
          const seenValues = new Set<string>();
          for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
            const uiConfig = ProviderRegistry.getChatUIConfig(providerId);
            for (const model of uiConfig.getModelOptions(settingsBag)) {
              if (!seenValues.has(model.value)) {
                seenValues.add(model.value);
                dropdown.addOption(model.value, model.label);
              }
            }
          }

          dropdown
            .setValue(this.plugin.settings.titleGenerationModel || '')
            .onChange(async (value) => {
              this.plugin.settings.titleGenerationModel = value;
              await this.plugin.saveSettings();
            });
        });
    }

    // --- Content (advanced) ---

    new Setting(advancedContainer).setName(t('settings.content')).setHeading();

    new Setting(advancedContainer)
      .setName(t('settings.systemPrompt.name'))
      .setDesc(t('settings.systemPrompt.desc'))
      .addTextArea((text) => {
        text
          .setPlaceholder(t('settings.systemPrompt.name'))
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 6;
        text.inputEl.cols = 50;
        text.inputEl.addEventListener('blur', () => {
          void this.restartServiceForPromptChange();
        });
      });

    new Setting(advancedContainer)
      .setName(t('settings.excludedTags.name'))
      .setDesc(t('settings.excludedTags.desc'))
      .addTextArea((text) => {
        text
          .setPlaceholder('System\nprivate\ndraft')
          .setValue(this.plugin.settings.excludedTags.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.excludedTags = value
              .split(/\r?\n/)
              .map((entry) => entry.trim().replace(/^#/, ''))
              .filter((entry) => entry.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 30;
      });

    new Setting(advancedContainer)
      .setName(t('settings.mediaFolder.name'))
      .setDesc(t('settings.mediaFolder.desc'))
      .addText((text) => {
        text
          .setPlaceholder('Attachments')
          .setValue(this.plugin.settings.mediaFolder)
          .onChange(async (value) => {
            this.plugin.settings.mediaFolder = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.addClass('grimoire-settings-media-input');
        text.inputEl.addEventListener('blur', () => {
          void this.restartServiceForPromptChange();
        });
      });

    renderProjectWorkspaceSettings(advancedContainer, { plugin: this.plugin });

    // --- Input (advanced) ---

    new Setting(advancedContainer).setName(t('settings.input')).setHeading();

    new Setting(advancedContainer)
      .setName(t('settings.requireCommandOrControlEnterToSend.name'))
      .setDesc(t('settings.requireCommandOrControlEnterToSend.desc'))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.requireCommandOrControlEnterToSend ?? false)
          .onChange(async (value) => {
            this.plugin.settings.requireCommandOrControlEnterToSend = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(advancedContainer)
      .setName(t('settings.navMappings.name'))
      .setDesc(t('settings.navMappings.desc'))
      .addTextArea((text) => {
        let pendingValue = buildNavMappingText(this.plugin.settings.keyboardNavigation);
        let saveTimeout: number | null = null;

        const commitValue = async (showError: boolean): Promise<void> => {
          if (saveTimeout !== null) {
            window.clearTimeout(saveTimeout);
            saveTimeout = null;
          }

          const result = parseNavMappings(pendingValue);
          if (!result.settings) {
            if (showError) {
              new Notice(`${t('common.error')}: ${result.error}`);
              pendingValue = buildNavMappingText(this.plugin.settings.keyboardNavigation);
              text.setValue(pendingValue);
            }
            return;
          }

          this.plugin.settings.keyboardNavigation.scrollUpKey = result.settings.scrollUp;
          this.plugin.settings.keyboardNavigation.scrollDownKey = result.settings.scrollDown;
          this.plugin.settings.keyboardNavigation.focusInputKey = result.settings.focusInput;
          await this.plugin.saveSettings();
          pendingValue = buildNavMappingText(this.plugin.settings.keyboardNavigation);
          text.setValue(pendingValue);
        };

        const scheduleSave = (): void => {
          if (saveTimeout !== null) {
            window.clearTimeout(saveTimeout);
          }
          saveTimeout = window.setTimeout(() => {
            void commitValue(false);
          }, 500);
        };

        text
          .setPlaceholder('Map w scrollup\nmap s scrolldown\nmap i focusinput')
          .setValue(pendingValue)
          .onChange((value) => {
            pendingValue = value;
            scheduleSave();
          });

        text.inputEl.rows = 3;
        text.inputEl.addEventListener('blur', () => {
          void commitValue(true);
        });
      });

    // --- Hotkeys (advanced) ---

    new Setting(advancedContainer).setName(t('settings.hotkeys')).setHeading();

    const hotkeyGrid = advancedContainer.createDiv({ cls: 'grimoire-hotkey-grid' });
    addHotkeySettingRow(hotkeyGrid, this.app, 'grimoire:inline-edit', 'settings.inlineEditHotkey');
    addHotkeySettingRow(hotkeyGrid, this.app, 'grimoire:open-view', 'settings.openChatHotkey');
    addHotkeySettingRow(hotkeyGrid, this.app, 'grimoire:new-session', 'settings.newSessionHotkey');
    addHotkeySettingRow(hotkeyGrid, this.app, 'grimoire:new-tab', 'settings.newTabHotkey');
    addHotkeySettingRow(hotkeyGrid, this.app, 'grimoire:close-current-tab', 'settings.closeTabHotkey');

    // --- Diagnostics (advanced) ---

    new Setting(advancedContainer).setName(t('settings.diagnostics')).setHeading();

    new Setting(advancedContainer)
      .setName(t('settings.usageIndicators.name'))
      .setDesc(t('settings.usageIndicators.desc'))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.usageIndicatorsEnabled !== false)
          .onChange(async (value) => {
            this.plugin.settings.usageIndicatorsEnabled = value;
            await this.plugin.saveSettings();
            for (const view of this.plugin.getAllViews?.() ?? []) {
              view.refreshModelSelector?.();
            }
          });
      });

    new Setting(advancedContainer)
      .setName(t('settings.debugLogging.name'))
      .setDesc(t('settings.debugLogging.desc'))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.debugLoggingEnabled ?? false)
          .onChange(async (value) => {
            this.plugin.settings.debugLoggingEnabled = value;
            await this.plugin.saveSettings();
          });
      });

    // --- Environment (advanced) ---

    renderEnvironmentSettingsSection({
      container: advancedContainer,
      plugin: this.plugin,
      scope: 'shared',
      heading: t('settings.environment'),
      name: 'Shared environment',
      desc: 'Provider-neutral runtime variables shared across all providers. Use this for PATH, proxy, cert, and temp variables.',
      placeholder: 'PATH=/opt/homebrew/bin:/usr/local/bin\nHTTPS_PROXY=http://proxy.example.com:8080\nSSL_CERT_FILE=/path/to/cert.pem',
      renderCustomContextLimits: (target) => this.renderCustomContextLimits(target),
    });
  }

  private refreshModelSelectors(): void {
    for (const view of this.plugin.getAllViews()) {
      view.refreshModelSelector();
    }
  }

  private renderProviderEnableSettings(container: HTMLElement): void {
    new Setting(container).setName('Providers').setHeading();
    const desc = container.createDiv({ cls: 'grimoire-provider-settings-desc' });
    desc.createEl('p', {
      cls: 'setting-item-description',
      text: 'Which CLI back-ends Grimoire can talk to. Each runs as a local agent; only enabled providers appear in the model selector.',
    });

    this.renderProviderEnableRow(container, 'claude', getClaudeProviderSettings(this.plugin.settings).enabled, async (enabled) => {
      await this.updateProviderEnabled('claude', enabled);
    });
    this.renderProviderEnableRow(container, 'codex', getCodexProviderSettings(this.plugin.settings).enabled, async (enabled) => {
      await this.updateProviderEnabled('codex', enabled);
    });
    this.renderProviderEnableRow(container, 'gemini', getGeminiProviderSettings(this.plugin.settings).enabled, async (enabled) => {
      await this.updateProviderEnabled('gemini', enabled);
    });
    this.renderProviderEnableRow(container, 'opencode', getOpencodeProviderSettings(this.plugin.settings).enabled, async (enabled) => {
      await this.updateProviderEnabled('opencode', enabled);
    });
  }

  private async updateProviderEnabled(providerId: ProviderId, enabled: boolean): Promise<void> {
    ProviderSettingsCoordinator.persistProjectedProviderState(this.plugin.settings);
    if (providerId === 'claude') {
      updateClaudeProviderSettings(this.plugin.settings, { enabled });
    } else if (providerId === 'codex') {
      updateCodexProviderSettings(this.plugin.settings, { enabled });
    } else if (providerId === 'gemini') {
      updateGeminiProviderSettings(this.plugin.settings, { enabled });
    } else if (providerId === 'opencode') {
      updateOpencodeProviderSettings(this.plugin.settings, { enabled });
    }

    if (ProviderSettingsCoordinator.normalizeProviderSelection(this.plugin.settings)) {
      ProviderSettingsCoordinator.projectActiveProviderState(this.plugin.settings);
    }
    await this.plugin.saveSettings();
    this.refreshModelSelectors();
    refreshSettingsTab(this);
  }

  private renderProviderEnableRow(
    container: HTMLElement,
    providerId: ProviderId,
    enabled: boolean,
    onChange: (enabled: boolean) => Promise<void>,
  ): void {
    const copy = PROVIDER_SETTING_COPY[providerId] ?? {
      desc: `${ProviderRegistry.getProviderDisplayName(providerId)} provider.`,
      name: ProviderRegistry.getProviderDisplayName(providerId),
    };
    const setting = new Setting(container)
      .setName(copy.name)
      .setDesc(copy.desc);

    setting.settingEl.addClass('grimoire-provider-row');
    setting.settingEl.addClass(`grimoire-provider-row--${providerId}`);
    setting.settingEl.toggleClass('is-enabled', enabled);

    setting.addToggle((toggle) => {
      toggle
        .setValue(enabled)
        .onChange(async (value) => {
          await onChange(value);
        });
    });
  }

  private renderAppearanceThemeSetting(container: HTMLElement): void {
    const activeTheme = this.plugin.settings.appearanceTheme ?? 'violet';
    const section = container.createDiv({ cls: 'grimoire-appearance-section' });
    section.dataset.theme = activeTheme;
    section.createEl('div', {
      cls: 'grimoire-appearance-heading',
      text: t('settings.appearance.name'),
    });
    section.createEl('div', {
      cls: 'grimoire-appearance-desc',
      text: t('settings.appearance.desc'),
    });

    const grid = section.createDiv({ cls: 'grimoire-appearance-grid' });
    const refreshCards = (selectedTheme: GrimoireAppearanceTheme): void => {
      for (const card of grid.querySelectorAll<HTMLElement>('.grimoire-theme-card')) {
        const isActive = card.getAttribute('data-theme-option') === selectedTheme;
        card.classList.toggle('is-active', isActive);
        card.setAttribute('aria-pressed', String(isActive));
      }
    };

    const saveTheme = async (theme: GrimoireAppearanceTheme): Promise<void> => {
      this.containerEl.dataset.theme = theme;
      section.dataset.theme = theme;
      if (this.plugin.settings.appearanceTheme === theme) {
        refreshCards(theme);
        return;
      }

      this.plugin.settings.appearanceTheme = theme;
      await this.plugin.saveSettings();
      refreshCards(theme);
      for (const view of this.plugin.getAllViews()) {
        view.syncAppearanceTheme();
      }
    };

    for (const theme of APPEARANCE_THEME_OPTIONS) {
      const card = grid.createEl('button', {
        attr: {
          'aria-pressed': String(theme.id === activeTheme),
          'data-theme-option': theme.id,
          type: 'button',
        },
        cls: `grimoire-theme-card${theme.id === activeTheme ? ' is-active' : ''}`,
      });
      card.addEventListener('click', () => {
        void saveTheme(theme.id).catch(() => {
          new Notice(t('settings.appearance.saveFailed'));
        });
      });

      // Prototype .tcard: swatch in its own left column, name + desc stacked.
      const swatch = card.createSpan({ cls: 'grimoire-theme-swatch' });
      swatch.style.backgroundColor = theme.accent;
      // Tint the focus ring to the swatch's own color (prototype's `--c`).
      swatch.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${theme.accent} 18%, transparent)`;

      const copy = card.createSpan({ cls: 'grimoire-theme-card-copy' });
      copy.createSpan({
        cls: 'grimoire-theme-card-name',
        text: t(`settings.appearance.options.${theme.id}.name`),
      });
      copy.createSpan({
        cls: 'grimoire-theme-card-desc',
        text: t(`settings.appearance.options.${theme.id}.desc`),
      });
    }
  }

  private renderMaxTabsSetting(container: HTMLElement): void {
    const maxTabsSetting = new Setting(container)
      .setName(t('settings.maxTabs.name'))
      .setDesc(t('settings.maxTabs.desc'));

    maxTabsSetting.addSlider((slider) => {
      const initialValue = normalizeMaxTabs(this.plugin.settings.maxTabs);
      const valueEl = maxTabsSetting.controlEl.createSpan({
        cls: 'grimoire-slider-value',
        text: String(initialValue),
      });

      slider
        .setLimits(MIN_TABS, MAX_TABS, 1)
        .setValue(initialValue)
        .setDynamicTooltip()
        .onChange(async (value) => {
          const normalizedValue = normalizeMaxTabs(value);
          valueEl.setText(String(normalizedValue));
          this.plugin.settings.maxTabs = normalizedValue;
          this.plugin.settings.tabBarPosition = 'header';
          await this.plugin.saveSettings();
          for (const view of this.plugin.getAllViews()) {
            view.refreshTabControls();
            view.updateLayoutForPosition();
          }
        });
    });
  }

  private renderHiddenProviderCommandSetting(
    container: HTMLElement,
    providerId: ProviderId,
    copy: { name: string; desc: string; placeholder: string },
  ): void {
    new Setting(container)
      .setName(copy.name)
      .setDesc(copy.desc)
      .addTextArea((text) => {
        text
          .setPlaceholder(copy.placeholder)
          .setValue(getHiddenProviderCommands(this.plugin.settings, providerId).join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.hiddenProviderCommands = {
              ...this.plugin.settings.hiddenProviderCommands,
              [providerId]: normalizeHiddenCommandList(value.split(/\r?\n/)),
            };
            await this.plugin.saveSettings();
            this.plugin.getView()?.updateHiddenProviderCommands();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 30;
      });
  }

  private renderCustomContextLimits(container: HTMLElement, providerId?: ProviderId): void {
    container.empty();

    const uniqueModelIds = new Set<string>();
    const providerIds = providerId
      ? [providerId]
      : ProviderRegistry.getRegisteredProviderIds();

    for (const targetProviderId of providerIds) {
      const envVars = parseEnvironmentVariables(
        this.plugin.getActiveEnvironmentVariables(targetProviderId),
      );
      for (const modelId of ProviderRegistry.getChatUIConfig(targetProviderId).getCustomModelIds(envVars)) {
        uniqueModelIds.add(modelId);
      }
    }

    if (uniqueModelIds.size === 0) {
      return;
    }

    const headerEl = container.createDiv({ cls: 'grimoire-context-limits-header' });
    headerEl.createSpan({
      text: t('settings.customModelOverrides.name'),
      cls: 'grimoire-context-limits-label',
    });

    const descEl = container.createDiv({ cls: 'grimoire-context-limits-desc' });
    descEl.setText(t('settings.customModelOverrides.desc'));

    const listEl = container.createDiv({ cls: 'grimoire-context-limits-list' });

    for (const modelId of uniqueModelIds) {
      const currentValue = this.plugin.settings.customContextLimits?.[modelId];
      const currentAlias = this.plugin.settings.customModelAliases?.[modelId] ?? '';

      const itemEl = listEl.createDiv({ cls: 'grimoire-context-limits-item' });
      const nameEl = itemEl.createDiv({ cls: 'grimoire-context-limits-model' });
      nameEl.setText(modelId);

      const inputWrapper = itemEl.createDiv({ cls: 'grimoire-context-limits-input-wrapper' });
      const aliasInputEl = inputWrapper.createEl('input', {
        type: 'text',
        placeholder: t('settings.customModelAliases.placeholder'),
        cls: 'grimoire-context-alias-input',
        value: currentAlias,
      });
      aliasInputEl.setAttribute('aria-label', `Alias for ${modelId}`);
      aliasInputEl.title = 'Custom label shown in the model selector. Leave empty to use the default.';

      const inputEl = inputWrapper.createEl('input', {
        type: 'text',
        placeholder: '200k',
        cls: 'grimoire-context-limits-input',
        value: currentValue ? formatContextLimit(currentValue) : '',
      });
      inputEl.setAttribute('aria-label', `Context window for ${modelId}`);

      const validationEl = inputWrapper.createDiv({ cls: 'grimoire-context-limit-validation grimoire-hidden' });

      const saveAlias = async (): Promise<void> => {
        if (!this.plugin.settings.customModelAliases) {
          this.plugin.settings.customModelAliases = {};
        }

        const existing = this.plugin.settings.customModelAliases[modelId] ?? '';
        const trimmed = aliasInputEl.value.trim();
        if (trimmed === existing) {
          aliasInputEl.value = existing;
          return;
        }

        if (trimmed) {
          this.plugin.settings.customModelAliases[modelId] = trimmed;
        } else {
          delete this.plugin.settings.customModelAliases[modelId];
        }

        await this.plugin.saveSettings();
        for (const view of this.plugin.getAllViews()) {
          view.refreshModelSelector();
        }
      };

      const saveContextLimit = async (): Promise<void> => {
        const trimmed = inputEl.value.trim();

        if (!this.plugin.settings.customContextLimits) {
          this.plugin.settings.customContextLimits = {};
        }

        if (!trimmed) {
          delete this.plugin.settings.customContextLimits[modelId];
          validationEl.toggleClass('grimoire-hidden', true);
          inputEl.classList.remove('grimoire-input-error');
        } else {
          const parsed = parseContextLimit(trimmed);
          if (parsed === null) {
            validationEl.setText(t('settings.customContextLimits.invalid'));
            validationEl.toggleClass('grimoire-hidden', false);
            inputEl.classList.add('grimoire-input-error');
            return;
          }

          this.plugin.settings.customContextLimits[modelId] = parsed;
          validationEl.toggleClass('grimoire-hidden', true);
          inputEl.classList.remove('grimoire-input-error');
        }

        await this.plugin.saveSettings();
      };

      inputEl.addEventListener('input', () => {
        void saveContextLimit();
      });
      aliasInputEl.addEventListener('blur', () => {
        void saveAlias();
      });
      aliasInputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          aliasInputEl.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          aliasInputEl.value = this.plugin.settings.customModelAliases?.[modelId] ?? '';
          aliasInputEl.blur();
        }
      });
    }
  }

  private async restartServiceForPromptChange(): Promise<void> {
    const view = this.plugin.getView();
    const tabManager = view?.getTabManager();
    if (!tabManager) return;

    try {
      await tabManager.broadcastToAllTabs(
        async (service) => { await service.ensureReady({ force: true }); }
      );
    } catch {
      // Changes will apply on the next conversation if the restart fails.
    }
  }
}
