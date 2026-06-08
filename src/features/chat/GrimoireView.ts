import type { EventRef, WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, Scope } from 'obsidian';

import { getHiddenProviderCommandSet } from '../../core/providers/commands/hiddenCommands';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from '../../core/providers/ProviderSettingsCoordinator';
import { DEFAULT_CHAT_PROVIDER_ID, type ProviderId } from '../../core/providers/types';
import { VIEW_TYPE_GRIMOIRE } from '../../core/types';
import type { GrimoireAppearanceTheme } from '../../core/types/settings';
import type GrimoirePlugin from '../../main';
import { GRIMOIRE_APP_ICON_ID } from '../../shared/appIcon';
import { createProviderIconSvg } from '../../shared/icons';
import {
  cancelScheduledAnimationFrame,
  scheduleAnimationFrame,
  type ScheduledAnimationFrame,
} from '../../utils/animationFrame';
import type { HistoryConversationOpenState } from './controllers/ConversationController';
import {
  InlineOrchestratorPlan,
  type OrchestratorPlanDecision,
} from './rendering/InlineOrchestratorPlan';
import type { OrchestratorPlan } from './rendering/orchestratorPlanParser';
import { OrchestratorService } from './services/OrchestratorService';
import { getTabProviderId, onProviderAvailabilityChanged, updatePlanModeUI } from './tabs/Tab';
import { TabBar } from './tabs/TabBar';
import { TabManager } from './tabs/TabManager';
import type { TabData, TabId } from './tabs/types';
import { normalizeMaxTabs } from './tabs/types';
import { ContextUsageMeter } from './ui/InputToolbar';
import { recalculateUsageForModel } from './utils/usageInfo';

type LoadableView = {
  containerEl?: HTMLElement;
  load: () => Promise<void> | void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const HISTORY_ICON_PATHS = [
  'M3 12a9 9 0 1 0 3-6.7L3 8',
  'M3 3v5h5',
  'M12 7.5V12l3 2',
];

const CHAT_APPEARANCE_OPTIONS: Array<{
  accent: string;
  desc: string;
  id: GrimoireAppearanceTheme;
  name: string;
}> = [
  {
    id: 'violet',
    name: 'Obsidian Violet',
    desc: 'Native dark UI, mineral purple',
    accent: '#8b5cf6',
  },
  {
    id: 'graphite',
    name: 'Graphite Blue',
    desc: 'Cool engineering surface',
    accent: '#6ea8ff',
  },
  {
    id: 'rune',
    name: 'Rune Ember',
    desc: 'Legacy warm Grimoire accent',
    accent: '#d97757',
  },
  {
    id: 'verdant',
    name: 'Verdant',
    desc: 'Deep dark with fresh green accent',
    accent: '#34b87a',
  },
];

function appendHistoryHeaderIcon(container: HTMLElement): void {
  container.empty();

  const svg = container.ownerDocument.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  for (const pathData of HISTORY_ICON_PATHS) {
    const path = container.ownerDocument.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
  }

  container.appendChild(svg);
}

export class GrimoireView extends ItemView {
  private plugin: GrimoirePlugin;

  // Tab management
  private tabManager: TabManager | null = null;
  private tabBar: TabBar | null = null;
  private tabBarContainerEl: HTMLElement | null = null;
  private tabContentEl: HTMLElement | null = null;
  private navRowContent: HTMLElement | null = null;
  private orchestratorService: OrchestratorService | null = null;

  // DOM Elements
  private viewContainerEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private titleSlotEl: HTMLElement | null = null;
  private logoEl: HTMLElement | null = null;
  private titleTextEl: HTMLElement | null = null;
  private headerActionsEl: HTMLElement | null = null;
  private headerActionsContent: HTMLElement | null = null;
  private headerContextUsageMeter: ContextUsageMeter | null = null;
  private newTabButtonEl: HTMLElement | null = null;
  private historyButtonEl: HTMLElement | null = null;
  private appearanceButtonEl: HTMLElement | null = null;
  private appearanceSheetEl: HTMLElement | null = null;

  // Header elements
  private historyDropdown: HTMLElement | null = null;

  // Event refs for cleanup
  private eventRefs: EventRef[] = [];

  // Debouncing for tab bar updates
  private pendingTabBarUpdate: ScheduledAnimationFrame | null = null;

  // Debouncing for tab state persistence
  private pendingPersist: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: GrimoirePlugin) {
    super(leaf);
    this.plugin = plugin;

    // Hover Editor compatibility: Define load as an instance method that can't be
    // overwritten by prototype patching. Hover Editor patches GrimoireView.prototype.load
    // after our class is defined, but instance methods take precedence over prototype methods.
    const prototype = Object.getPrototypeOf(this) as LoadableView;
    const originalLoad = prototype.load.bind(this);
    Object.defineProperty(this, 'load', {
      value: async () => {
        // Ensure containerEl exists before any patched load code tries to use it
        if (!this.containerEl) {
          (this as LoadableView).containerEl = createDiv({ cls: 'view-content' });
        }
        // Wrap in try-catch to prevent Hover Editor errors from breaking our view
        try {
          return await originalLoad();
        } catch {
          // Hover Editor may throw if its DOM setup fails - continue anyway
        }
      },
      writable: false,
      configurable: false,
    });
  }

  getViewType(): string {
    return VIEW_TYPE_GRIMOIRE;
  }

  getDisplayText(): string {
    return 'Grimoire';
  }

  getIcon(): string {
    return GRIMOIRE_APP_ICON_ID;
  }

  /** Refreshes model-dependent UI across all tabs (used after settings/env changes). */
  refreshModelSelector(): void {
    for (const tab of this.tabManager?.getAllTabs() ?? []) {
      onProviderAvailabilityChanged(tab, this.plugin);
      const providerId = getTabProviderId(tab, this.plugin);
      const providerSettings = ProviderSettingsCoordinator.getProviderSettingsSnapshot(
        this.plugin.settings,
        providerId,
      );
      const model = providerSettings.model;
      const uiConfig = ProviderRegistry.getChatUIConfig(providerId);
      const capabilities = ProviderRegistry.getCapabilities(providerId);
      const contextWindow = uiConfig.getContextWindowSize(
        model,
        providerSettings.customContextLimits,
      );

      if (tab.state.usage) {
        tab.state.usage = recalculateUsageForModel(tab.state.usage, model, contextWindow);
      }

      tab.ui.modelSelector?.updateDisplay();
      tab.ui.modelSelector?.renderOptions();
      tab.ui.planUsageBadge?.updateDisplay();
      tab.ui.planUsageBadge?.refreshInBackground();
      tab.ui.modeSelector?.updateDisplay();
      tab.ui.modeSelector?.renderOptions();
      tab.ui.thinkingBudgetSelector?.updateDisplay();
      tab.ui.permissionToggle?.updateDisplay();
      tab.ui.serviceTierToggle?.updateDisplay();
      tab.dom.inputWrapper.toggleClass(
        'grimoire-input-plan-mode',
        providerSettings.permissionMode === 'plan' && capabilities.supportsPlanMode,
      );
    }

    this.tabManager?.primeProviderRuntime();
  }

  invalidateProviderCommandCaches(providerIds?: ProviderId[]): void {
    this.tabManager?.invalidateProviderCommandCaches(providerIds);
  }

  /** Updates provider-scoped hidden commands on all tabs after settings changes. */
  updateHiddenProviderCommands(): void {
    for (const tab of this.tabManager?.getAllTabs() ?? []) {
      tab.ui.slashCommandDropdown?.setHiddenCommands(
        getHiddenProviderCommandSet(this.plugin.settings, getTabProviderId(tab, this.plugin)),
      );
    }
  }

  /** Applies the user-selected Grimoire appearance theme to the root container. */
  syncAppearanceTheme(): void {
    if (!this.viewContainerEl) return;
    this.viewContainerEl.dataset.theme =
      this.plugin.settings.appearanceTheme ?? 'violet';
    this.syncAppearanceSheet();
  }

  async onOpen() {
    // Guard: Hover Editor and similar plugins may call onOpen before DOM is ready.
    // containerEl must exist before we can access contentEl or create elements.
    if (!this.containerEl) {
      return;
    }

    // Use contentEl (standard Obsidian API) as primary target.
    // Hover Editor and other plugins may modify the DOM structure,
    // so we need fallbacks to handle non-standard scenarios.
    let container: HTMLElement | null =
      this.contentEl ?? (this.containerEl.children[1] as HTMLElement | null);

    if (!container) {
      // Last resort: create our own container inside containerEl
      container = this.containerEl.createDiv();
    }

    this.viewContainerEl = container;
    this.viewContainerEl.empty();
    this.viewContainerEl.addClass('grimoire-container');
    this.viewContainerEl.addClass('grimoire-container--chat-window');
    this.syncAppearanceTheme();

    const shellEl = this.viewContainerEl.createDiv({ cls: 'grimoire-chat-window-shell' });
    const header = shellEl.createDiv({ cls: 'grimoire-header grimoire-session-strip' });
    this.buildHeader(header);

    this.navRowContent = this.buildNavRowContent();
    this.tabContentEl = shellEl.createDiv({
      cls: 'grimoire-tab-content-container grimoire-tab-content-container--chat-window',
    });
    this.appearanceSheetEl = this.buildAppearanceSheet(shellEl);
    this.historyDropdown = this.buildHistorySheet(shellEl);
    this.orchestratorService = new OrchestratorService({
      sendToTab: (tabId, message) => {
        const tab = this.tabManager?.getTab(tabId);
        if (!tab) return;
        void tab.controllers.inputController?.sendMessage({ content: message });
      },
    });

    this.tabManager = new TabManager(
      this.plugin,
      this.tabContentEl,
      this,
      {
        onTabCreated: (tab) => {
          this.wireOrchestratorCallbacks(tab);
          this.updateTabBar();
          this.updateNavRowLocation();
          this.persistTabState();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabSwitched: () => {
          this.updateTabBar();
          this.updateHistoryDropdown();
          this.updateNavRowLocation();
          this.persistTabState();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabClosed: (tabId) => {
          this.orchestratorService?.handleTabClosed(tabId);
          this.updateTabBar();
          this.persistTabState();
          this.syncHeaderContextUsage();
        },
        onTabStreamingChanged: () => {
          this.updateTabBar();
          this.syncHeaderContextUsage();
        },
        onTabTitleChanged: () => this.updateTabBar(),
        onTabAttentionChanged: () => this.updateTabBar(),
        onTabConversationChanged: () => {
          this.updateTabBar();
          this.persistTabState();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabProviderChanged: () => {
          this.updateTabBar();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabDraftSettingsChanged: () => {
          this.updateTabBar();
          this.persistTabState();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabOrchestratorModeChanged: () => {
          this.updateTabBar();
          this.persistTabState();
          this.syncProviderBrandColor();
          this.syncHeaderContextUsage();
        },
        onTabUsageChanged: (tabId) => {
          if (this.tabManager?.getActiveTabId() === tabId) {
            this.syncHeaderContextUsage();
          }
        },
      }
    );

    this.wireEventHandlers();
    await this.restoreOrCreateTabs();
    this.syncProviderBrandColor();
    this.updateLayoutForPosition();
    this.tabManager?.primeProviderRuntime();
  }

  async onClose() {
    if (this.pendingTabBarUpdate !== null) {
      cancelScheduledAnimationFrame(this.pendingTabBarUpdate);
      this.pendingTabBarUpdate = null;
    }

    for (const ref of this.eventRefs) {
      this.plugin.app.vault.offref(ref);
    }
    this.eventRefs = [];

    await this.persistTabStateImmediate();

    await this.tabManager?.destroy();
    this.tabManager = null;

    this.tabBar?.destroy();
    this.tabBar = null;
    this.scope = null;
  }

  // ============================================
  // UI Building
  // ============================================

  private buildHeader(header: HTMLElement) {
    this.headerEl = header;

    // Title slot container (logo + title or tabs)
    this.titleSlotEl = header.createDiv({ cls: 'grimoire-title-slot' });

    // Logo (hidden when 2+ tabs) — populated by syncHeaderLogo()
    this.logoEl = this.titleSlotEl.createSpan({ cls: 'grimoire-logo' });
    this.syncHeaderLogo(DEFAULT_CHAT_PROVIDER_ID);

    // Title text (hidden in header mode when 2+ tabs)
    this.titleTextEl = this.titleSlotEl.createEl('h4', { text: 'Grimoire', cls: 'grimoire-title-text' });

    // Header actions container (for header mode - initially hidden)
    this.headerActionsEl = header.createDiv({ cls: 'grimoire-header-actions grimoire-header-actions-slot grimoire-hidden' });
  }

  /**
   * Builds the nav row content (tab badges + header actions).
   * This is called once and the content is moved between locations.
   */
  private buildNavRowContent(): HTMLElement {
    const activeDocument = this.containerEl.ownerDocument;

    // Create a fragment to hold nav row content
    const fragment = activeDocument.createDocumentFragment();

    // Tab badges (left side in nav row, or in title slot for header mode)
    this.tabBarContainerEl = activeDocument.createElement('div');
    this.tabBarContainerEl.className = 'grimoire-tab-bar-container';
    this.tabBar = new TabBar(this.tabBarContainerEl, {
      onTabClick: (tabId) => this.handleTabClick(tabId),
      onTabClose: (tabId) => {
        void this.handleTabClose(tabId);
      },
      onNewTab: () => {
        void this.createNewTab().catch(() => new Notice('Failed to create tab'));
      },
    });
    fragment.appendChild(this.tabBarContainerEl);

    // Header actions (right side)
    this.headerActionsContent = activeDocument.createElement('div');
    this.headerActionsContent.className = 'grimoire-header-actions';

    this.headerContextUsageMeter = new ContextUsageMeter(this.headerActionsContent, {
      showWhenEmpty: true,
    });

    // New tab button (plus icon)
    this.newTabButtonEl = this.headerActionsContent.createDiv({ cls: 'grimoire-header-btn grimoire-new-tab-btn' });
    this.newTabButtonEl.setText('+');
    this.newTabButtonEl.setAttribute('aria-label', 'New tab');
    this.newTabButtonEl.addEventListener('click', () => {
      void this.createNewTab().catch(() => new Notice('Failed to create tab'));
    });

    this.historyButtonEl = this.headerActionsContent.createDiv({ cls: 'grimoire-header-btn grimoire-history-btn' });
    this.historyButtonEl.setAttribute('role', 'button');
    this.historyButtonEl.setAttribute('tabindex', '0');
    this.historyButtonEl.setAttribute('aria-label', 'Chat history');
    this.historyButtonEl.setAttribute('aria-haspopup', 'dialog');
    this.historyButtonEl.setAttribute('aria-expanded', 'false');
    appendHistoryHeaderIcon(this.historyButtonEl);
    this.historyButtonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleHistoryDropdown();
    });
    this.historyButtonEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      this.toggleHistoryDropdown();
    });

    this.appearanceButtonEl = this.headerActionsContent.createDiv({
      cls: 'grimoire-header-btn grimoire-appearance-btn',
      text: '◐',
    });
    this.appearanceButtonEl.setAttribute('aria-label', 'Appearance');
    this.appearanceButtonEl.setAttribute('aria-expanded', 'false');
    this.appearanceButtonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAppearanceSheet();
    });

    fragment.appendChild(this.headerActionsContent);

    // Create a wrapper div to hold the fragment (for input mode nav row)
    const wrapper = activeDocument.createElement('div');
    wrapper.className = 'grimoire-input-nav-content';
    wrapper.appendChild(fragment);
    return wrapper;
  }

  private buildHistorySheet(parentEl: HTMLElement): HTMLElement {
    const sheetEl = parentEl.createEl('aside', {
      cls: 'grimoire-history-menu',
      attr: {
        role: 'dialog',
        'aria-hidden': 'true',
        'aria-label': 'Chat history',
      },
    });
    sheetEl.addEventListener('click', (e) => e.stopPropagation());
    return sheetEl;
  }

  private buildAppearanceSheet(parentEl: HTMLElement): HTMLElement {
    const sheetEl = parentEl.createEl('aside', {
      cls: 'grimoire-appearance-sheet',
      attr: {
        'aria-hidden': 'true',
        'aria-label': 'Appearance settings',
      },
    });
    const headerEl = sheetEl.createDiv({ cls: 'grimoire-appearance-sheet-head' });
    headerEl.createEl('strong', { text: 'Appearance' });
    const closeEl = headerEl.createEl('button', {
      cls: 'grimoire-appearance-sheet-close',
      text: '×',
      attr: { type: 'button', 'aria-label': 'Close appearance settings' },
    });
    closeEl.addEventListener('click', () => this.closeAppearanceSheet());

    const listEl = sheetEl.createDiv({ cls: 'grimoire-appearance-sheet-list' });
    for (const theme of CHAT_APPEARANCE_OPTIONS) {
      const themeEl = listEl.createEl('button', {
        cls: 'grimoire-appearance-sheet-theme',
        attr: {
          'aria-pressed': 'false',
          'data-theme-option': theme.id,
          type: 'button',
        },
      });
      const swatchEl = themeEl.createSpan({ cls: 'grimoire-appearance-sheet-swatch' });
      swatchEl.style.backgroundColor = theme.accent;
      const copyEl = themeEl.createSpan({ cls: 'grimoire-appearance-sheet-copy' });
      copyEl.createEl('strong', { text: theme.name });
      copyEl.createSpan({ text: theme.desc });
      themeEl.createSpan({ cls: 'grimoire-appearance-sheet-badge', text: 'off' });
      themeEl.addEventListener('click', () => {
        void this.saveAppearanceTheme(theme.id).catch(() => {
          new Notice('Failed to save appearance theme');
        });
      });
    }
    this.syncAppearanceSheet(sheetEl);
    return sheetEl;
  }

  private toggleAppearanceSheet(): void {
    if (!this.appearanceSheetEl) return;
    const nextOpen = !this.appearanceSheetEl.hasClass('is-open');
    this.appearanceSheetEl.toggleClass('is-open', nextOpen);
    this.appearanceSheetEl.setAttribute('aria-hidden', String(!nextOpen));
    this.appearanceButtonEl?.toggleClass('active', nextOpen);
    this.appearanceButtonEl?.setAttribute('aria-expanded', String(nextOpen));
  }

  private closeAppearanceSheet(): void {
    this.appearanceSheetEl?.removeClass('is-open');
    this.appearanceSheetEl?.setAttribute('aria-hidden', 'true');
    this.appearanceButtonEl?.removeClass('active');
    this.appearanceButtonEl?.setAttribute('aria-expanded', 'false');
  }

  private async saveAppearanceTheme(theme: GrimoireAppearanceTheme): Promise<void> {
    this.plugin.settings.appearanceTheme = theme;
    await this.plugin.saveSettings();
    this.syncAppearanceTheme();
  }

  private syncAppearanceSheet(sheetEl = this.appearanceSheetEl): void {
    if (!sheetEl) return;
    const activeTheme = this.plugin.settings.appearanceTheme ?? 'violet';
    for (const themeEl of sheetEl.querySelectorAll<HTMLElement>('.grimoire-appearance-sheet-theme')) {
      const isActive = themeEl.getAttribute('data-theme-option') === activeTheme;
      themeEl.toggleClass('is-active', isActive);
      themeEl.setAttribute('aria-pressed', String(isActive));
      const badgeEl = themeEl.querySelector('.grimoire-appearance-sheet-badge');
      badgeEl?.setText(isActive ? 'on' : 'off');
      badgeEl?.toggleClass('is-active', isActive);
    }
  }

  /** Keeps tab badges and header actions in the top session strip. */
  private updateNavRowLocation(): void {
    if (!this.tabBarContainerEl || !this.headerActionsContent) return;

    if (this.titleSlotEl) {
      this.titleSlotEl.appendChild(this.tabBarContainerEl);
    }
    if (this.headerActionsEl) {
      this.headerActionsEl.appendChild(this.headerActionsContent);
      this.headerActionsEl.removeClass('grimoire-hidden');
    }
  }

  /**
   * Updates layout after settings that can affect the session strip change.
   */
  updateLayoutForPosition(): void {
    if (!this.viewContainerEl) return;

    const isHeaderMode = this.isSessionStripMode();

    // Update container class for CSS styling
    this.viewContainerEl.toggleClass('grimoire-container--header-mode', isHeaderMode);

    // Move nav content to appropriate location
    this.updateNavRowLocation();

    // Update tab bar and title visibility
    this.updateTabBarVisibility();
  }

  /** Refreshes tab controls after settings that affect tab availability change. */
  refreshTabControls(): void {
    this.updateTabBarVisibility();
  }

  // ============================================
  // Tab Management
  // ============================================

  private handleTabClick(tabId: TabId): void {
    const switched = this.tabManager?.switchToTab(tabId);
    if (switched) {
      void switched.catch(() => new Notice('Failed to switch tab'));
    }
  }

  private async handleTabClose(tabId: TabId): Promise<void> {
    try {
      const tab = this.tabManager?.getTab(tabId);
      // If streaming, treat close like user interrupt (force close cancels the stream)
      const force = tab?.state.isStreaming ?? false;
      await this.tabManager?.closeTab(tabId, force);
      this.updateTabBarVisibility();
    } catch {
      new Notice('Failed to close tab');
    }
  }

  async createNewTab(): Promise<void> {
    const tab = await this.tabManager?.createTab();
    if (!tab) {
      const maxTabs = normalizeMaxTabs(this.plugin.settings.maxTabs);
      new Notice(`Maximum ${maxTabs} tabs allowed`);
      this.updateTabBarVisibility();
      return;
    }
    this.updateTabBarVisibility();
  }

  private updateTabBar(): void {
    if (!this.tabManager || !this.tabBar) return;

    // Debounce tab bar updates using requestAnimationFrame
    if (this.pendingTabBarUpdate !== null) {
      cancelScheduledAnimationFrame(this.pendingTabBarUpdate);
    }

    this.pendingTabBarUpdate = scheduleAnimationFrame(() => {
      this.pendingTabBarUpdate = null;
      if (!this.tabManager || !this.tabBar) return;

      const items = this.tabManager.getTabBarItems();
      this.tabBar.update(items);
      this.updateTabBarVisibility();
    }, this.containerEl.ownerDocument.defaultView ?? null);
  }

  private updateTabBarVisibility(): void {
    if (!this.tabBarContainerEl || !this.tabManager) return;

    const tabCount = this.tabManager.getTabCount();
    const showTabBar = tabCount >= 1;
    const isHeaderMode = this.isSessionStripMode();

    // The final chat-window design keeps the numbered session strip visible.
    this.tabBarContainerEl.toggleClass('grimoire-hidden', !showTabBar);

    // In header mode, badges replace logo/title in the same location
    // In input mode, keep logo/title visible (badges are in nav row)
    const hideBranding = showTabBar && isHeaderMode;
    if (this.logoEl) {
      this.logoEl.toggleClass('grimoire-hidden', hideBranding);
    }
    if (this.titleTextEl) {
      this.titleTextEl.toggleClass('grimoire-hidden', hideBranding);
    }

    this.updateNewTabButtonVisibility();
  }

  private updateNewTabButtonVisibility(): void {
    if (!this.newTabButtonEl || !this.tabManager) return;

    const canCreateTab = this.tabManager.canCreateTab();
    this.newTabButtonEl.toggleClass('grimoire-hidden', !canCreateTab);
    if (canCreateTab) {
      this.newTabButtonEl.removeAttribute('aria-disabled');
      this.newTabButtonEl.removeAttribute('aria-hidden');
      return;
    }

    this.newTabButtonEl.setAttribute('aria-disabled', 'true');
    this.newTabButtonEl.setAttribute('aria-hidden', 'true');
  }

  private isSessionStripMode(): boolean {
    return true;
  }

  /** Sets `data-provider` on the root container for provider-scoped status accents. */
  private syncProviderBrandColor(): void {
    if (!this.viewContainerEl) return;
    const activeTab = this.tabManager?.getActiveTab();
    const providerId = activeTab ? getTabProviderId(activeTab, this.plugin) : DEFAULT_CHAT_PROVIDER_ID;
    this.viewContainerEl.dataset.provider = providerId;
    this.syncHeaderLogo(providerId);
  }

  private syncHeaderContextUsage(): void {
    this.headerContextUsageMeter?.update(this.tabManager?.getActiveTab()?.state.usage ?? null);
  }

  /** Rebuilds the header logo SVG to match the given provider. */
  private syncHeaderLogo(providerId: ProviderId): void {
    if (!this.logoEl) return;
    const icon = ProviderRegistry.getChatUIConfig(providerId).getProviderIcon?.();
    if (!icon) return;
    const existing = this.logoEl.querySelector('svg');
    if (existing?.getAttribute('data-provider') === providerId) return;
    this.logoEl.empty();
    const svg = createProviderIconSvg(icon, {
      dataProvider: providerId,
      height: 18,
      ownerDocument: this.logoEl.ownerDocument,
      width: 18,
    });
    this.logoEl.appendChild(svg);
  }

  // ============================================
  // History Dropdown
  // ============================================

  private toggleHistoryDropdown(): void {
    if (!this.historyDropdown) return;

    const isVisible = this.historyDropdown.hasClass('visible');
    if (isVisible) {
      this.closeHistoryDropdown();
    } else {
      this.closeAppearanceSheet();
      this.updateHistoryDropdown();
      this.historyDropdown.addClass('visible');
      this.historyDropdown.setAttribute('aria-hidden', 'false');
      this.syncHistoryButtonState(true);
    }
  }

  private closeHistoryDropdown(): void {
    this.historyDropdown?.removeClass('visible');
    this.historyDropdown?.setAttribute('aria-hidden', 'true');
    this.syncHistoryButtonState(false);
  }

  private syncHistoryButtonState(isOpen = this.historyDropdown?.hasClass('visible') ?? false): void {
    this.historyButtonEl?.removeClass('active');
    this.historyButtonEl?.setAttribute('aria-expanded', String(isOpen));
  }

  private updateHistoryDropdown(): void {
    if (!this.historyDropdown) return;
    this.historyDropdown.empty();

    const activeTab = this.tabManager?.getActiveTab();
    const conversationController = activeTab?.controllers.conversationController;

    if (conversationController) {
      conversationController.renderHistoryDropdown(this.historyDropdown, {
        onSelectConversation: (id) => this.openHistoryConversation(id),
        onOpenConversationInNewTab: (id, activate) =>
          this.openHistoryConversationInNewTab(id, activate),
        getConversationOpenState: (id) => this.getHistoryConversationOpenState(id),
        onClose: () => this.closeHistoryDropdown(),
      });
    }
  }

  private async openHistoryConversation(conversationId: string): Promise<void> {
    await this.tabManager?.openConversation(conversationId);
    this.closeHistoryDropdown();
  }

  private async openHistoryConversationInNewTab(
    conversationId: string,
    activate = true,
  ): Promise<void> {
    await this.tabManager?.openConversation(conversationId, {
      preferNewTab: true,
      activate,
    });
    this.closeHistoryDropdown();
  }

  private getHistoryConversationOpenState(conversationId: string): HistoryConversationOpenState {
    const activeTab = this.tabManager?.getActiveTab();
    if (activeTab?.conversationId === conversationId) {
      return 'current';
    }

    if (this.findTabWithConversation(conversationId)) {
      return 'open';
    }

    const crossViewResult = this.plugin.findConversationAcrossViews(conversationId);
    if (crossViewResult && crossViewResult.view !== this) {
      return 'open';
    }

    return 'closed';
  }

  private findTabWithConversation(conversationId: string): TabData | null {
    const tabs = this.tabManager?.getAllTabs() ?? [];
    return tabs.find(tab => tab.conversationId === conversationId) ?? null;
  }

  private wireOrchestratorCallbacks(tab: TabData): void {
    const streamController = tab.controllers.streamController;
    if (!streamController) return;

    const isWorker = tab.orchestratorTabId != null;
    streamController.setOrchestratorCallbacks(
      isWorker
        ? undefined
        : (containerEl, plan) => this.renderOrchestratorApproval(tab, containerEl, plan),
      isWorker
        ? (result, isError) => this.orchestratorService?.reportResult(tab.id, result, isError)
        : undefined,
      () => tab.orchestratorMode,
    );
  }

  private renderOrchestratorApproval(
    tab: TabData,
    containerEl: HTMLElement,
    plan: OrchestratorPlan,
  ): void {
    const inlinePlan = new InlineOrchestratorPlan(
      containerEl,
      plan,
      (decision) => {
        void this.handleOrchestratorDecision(tab, decision);
      },
    );
    inlinePlan.render();
  }

  private async handleOrchestratorDecision(
    orchestratorTab: TabData,
    decision: OrchestratorPlanDecision,
  ): Promise<void> {
    if (decision.type !== 'spawn_workers') {
      return;
    }

    for (const task of decision.plan.tasks) {
      const workerTab = await this.tabManager?.createWorkerTab(orchestratorTab.id);
      if (!workerTab) {
        continue;
      }

      workerTab.orchestratorMode = false;
      this.wireOrchestratorCallbacks(workerTab);
      this.orchestratorService?.registerWorker(
        orchestratorTab.id,
        workerTab.id,
        task.description,
      );
      void workerTab.controllers.inputController?.sendMessage({ content: task.prompt });
    }

    this.updateTabBar();
    this.persistTabState();
  }

  // ============================================
  // Event Wiring
  // ============================================

  private wireEventHandlers(): void {
    const activeDocument = this.containerEl.ownerDocument;

    // Document-level click to close dropdowns
    this.registerDomEvent(activeDocument, 'click', () => {
      this.closeHistoryDropdown();
    });

    // View-level Shift+Tab to toggle plan mode (works from any focused element)
    this.registerDomEvent(this.containerEl, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing && this.historyDropdown?.hasClass('visible')) {
        e.preventDefault();
        this.closeHistoryDropdown();
        return;
      }

      if (e.key === 'Tab' && e.shiftKey && !e.isComposing) {
        e.preventDefault();
        const activeTab = this.tabManager?.getActiveTab();
        if (!activeTab) return;
        const providerId = getTabProviderId(activeTab, this.plugin);
        if (!ProviderRegistry.getCapabilities(providerId).supportsPlanMode) return;
        const current = ProviderSettingsCoordinator.getProviderSettingsSnapshot(
          this.plugin.settings,
          providerId,
        ).permissionMode as string;
        if (current === 'plan') {
          const restoreMode = activeTab.state.prePlanPermissionMode ?? 'normal';
          activeTab.state.prePlanPermissionMode = null;
          updatePlanModeUI(activeTab, this.plugin, restoreMode);
        } else {
          activeTab.state.prePlanPermissionMode = current;
          updatePlanModeUI(activeTab, this.plugin, 'plan');
        }
      }
    });

    // View scopes are the Obsidian-owned boundary for main-area tab hotkeys.
    // Returning false consumes Escape before Obsidian uses it for pane navigation.
    this.scope = new Scope(this.app.scope);
    this.scope.register([], 'Escape', (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (!e.defaultPrevented) {
        const activeTab = this.tabManager?.getActiveTab();
        if (activeTab?.state.isStreaming) {
          activeTab.controllers.inputController?.cancelStreaming();
        }
      }
      return false;
    });

    // Vault events - forward to active tab's file context manager
    const markCacheDirty = (includesFolders: boolean): void => {
      const mgr = this.tabManager?.getActiveTab()?.ui.fileContextManager;
      if (!mgr) return;
      mgr.markFileCacheDirty();
      if (includesFolders) mgr.markFolderCacheDirty();
    };
    this.eventRefs.push(
      this.plugin.app.vault.on('create', () => markCacheDirty(true)),
      this.plugin.app.vault.on('delete', () => markCacheDirty(true)),
      this.plugin.app.vault.on('rename', () => markCacheDirty(true)),
      this.plugin.app.vault.on('modify', () => markCacheDirty(false))
    );

    // File open event
    this.registerEvent(
      this.plugin.app.workspace.on('file-open', (file) => {
        if (file) {
          this.tabManager?.getActiveTab()?.ui.fileContextManager?.handleFileOpen(file);
        }
      })
    );

    // Click outside to close mention dropdown
    this.registerDomEvent(activeDocument, 'click', (e) => {
      const activeTab = this.tabManager?.getActiveTab();
      if (activeTab) {
        const fcm = activeTab.ui.fileContextManager;
        if (fcm && !fcm.containsElement(e.target as Node) && e.target !== activeTab.dom.inputEl) {
          fcm.hideMentionDropdown();
        }
      }
    });
  }

  // ============================================
  // Persistence
  // ============================================

  private async restoreOrCreateTabs(): Promise<void> {
    if (!this.tabManager) return;

    // Try to restore from persisted state
    const persistedState = await this.plugin.storage.getTabManagerState();
    if (persistedState && persistedState.openTabs.length > 0) {
      await this.tabManager.restoreState(persistedState);
      return;
    }

    // Fallback: create a new empty tab
    await this.tabManager.createTab();
  }

  private persistTabState(): void {

    // Debounce persistence to avoid rapid writes (300ms delay)
    if (this.pendingPersist !== null) {
      window.clearTimeout(this.pendingPersist);
    }
    this.pendingPersist = window.setTimeout(() => {
      this.pendingPersist = null;
      if (!this.tabManager) return;
      const state = this.tabManager.getPersistedState();
      this.plugin.persistTabManagerState(state).catch(() => {
        // Silently ignore persistence errors
      });
    }, 300);
  }

  /** Force immediate persistence (for onClose/onunload). */
  private async persistTabStateImmediate(): Promise<void> {
    // Cancel any pending debounced persist
    if (this.pendingPersist !== null) {
      window.clearTimeout(this.pendingPersist);
      this.pendingPersist = null;
    }
    if (!this.tabManager) return;
    const state = this.tabManager.getPersistedState();
    await this.plugin.persistTabManagerState(state);
  }

  // ============================================
  // Public API
  // ============================================

  /** Gets the currently active tab. */
  getActiveTab(): TabData | null {
    return this.tabManager?.getActiveTab() ?? null;
  }

  /** Gets the tab manager. */
  getTabManager(): TabManager | null {
    return this.tabManager;
  }
}
