import '@/providers';

import { createMockEl } from '@test/helpers/mockElement';
import { Scope, setIcon } from 'obsidian';

import { GrimoireView } from '@/features/chat/GrimoireView';

const MockScope = Scope as typeof Scope & { instances: Scope[] };

function createViewHarness(options: {
  canCreateTab: boolean;
  tabBarPosition?: 'input' | 'header';
  tabCount?: number;
}): {
  newTabButtonEl: ReturnType<typeof createMockEl>;
  view: any;
} {
  const newTabButtonEl = createMockEl();
  const view = Object.create(GrimoireView.prototype) as any;

  view.plugin = {
    settings: {
      tabBarPosition: options.tabBarPosition ?? 'input',
    },
  };
  view.tabManager = {
    canCreateTab: jest.fn().mockReturnValue(options.canCreateTab),
    getTabCount: jest.fn().mockReturnValue(options.tabCount ?? 1),
  };
  view.tabBarContainerEl = createMockEl();
  view.logoEl = createMockEl();
  view.titleTextEl = createMockEl();
  view.newTabButtonEl = newTabButtonEl;

  return { newTabButtonEl, view };
}

describe('GrimoireView tab controls', () => {
  it('uses the Grimoire display text', () => {
    const view = Object.create(GrimoireView.prototype) as GrimoireView;

    expect(view.getDisplayText()).toBe('Grimoire');
  });

  it('uses the custom Grimoire app icon', () => {
    const view = Object.create(GrimoireView.prototype) as GrimoireView;

    expect(view.getIcon()).toBe('grimoire');
  });

  it('renders the Grimoire header title text', () => {
    const headerEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    view.buildHeader(headerEl);

    expect(headerEl.querySelector('.grimoire-title-text')?.textContent).toBe('Grimoire');
  });

  it('builds the session strip with a header context meter', () => {
    const containerEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;

    const nav = view.buildNavRowContent();

    expect(nav.querySelector('.grimoire-tab-bar-container')).not.toBeNull();
    expect(nav.querySelector('.grimoire-context-meter')).not.toBeNull();
    expect(nav.querySelector('.grimoire-new-tab-btn')).not.toBeNull();
  });

  it('places the history button after the new-tab control without appearance controls', () => {
    const containerEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;

    (setIcon as jest.Mock).mockClear();
    const nav = view.buildNavRowContent();
    const actions = nav.querySelector('.grimoire-header-actions');
    const newTabButton = nav.querySelector('.grimoire-new-tab-btn');
    const historyButton = nav.querySelector('.grimoire-history-btn');
    const appearanceButton = nav.querySelector('.grimoire-appearance-btn');

    expect(historyButton).not.toBeNull();
    expect(historyButton?.getAttribute('aria-label')).toBe('Chat history');
    expect(historyButton?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(historyButton?.getAttribute('aria-expanded')).toBe('false');
    expect(historyButton?.tagName).toBe('DIV');
    expect(historyButton?.getAttribute('role')).toBe('button');
    expect(historyButton?.getAttribute('tabindex')).toBe('0');
    expect(historyButton?.children.some((child: any) => child.tagName === 'svg'.toUpperCase())).toBe(true);
    expect(setIcon).not.toHaveBeenCalled();
    expect(actions?.children.indexOf(newTabButton as any)).toBeLessThan(actions?.children.indexOf(historyButton as any) ?? -1);
    expect(appearanceButton).toBeNull();
  });

  it('toggles the full-pane history sheet without visually selecting the button', () => {
    const containerEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.historyDropdown = createMockEl();
    view.historyDropdown.setAttribute('aria-hidden', 'true');
    view.updateHistoryDropdown = jest.fn();

    const nav = view.buildNavRowContent();
    const historyButton = nav.querySelector('.grimoire-history-btn');

    historyButton?.click();

    expect(view.historyDropdown.hasClass('visible')).toBe(true);
    expect(view.historyDropdown.getAttribute('aria-hidden')).toBe('false');
    expect(historyButton?.hasClass('active')).toBe(false);
    expect(historyButton?.getAttribute('aria-expanded')).toBe('true');

    historyButton?.click();

    expect(view.historyDropdown.hasClass('visible')).toBe(false);
    expect(view.historyDropdown.getAttribute('aria-hidden')).toBe('true');
    expect(historyButton?.hasClass('active')).toBe(false);
    expect(historyButton?.getAttribute('aria-expanded')).toBe('false');
  });

  it('builds the history sheet inside the chat shell with a dialog role', () => {
    const view = Object.create(GrimoireView.prototype) as any;
    const shell = createMockEl();

    const sheet = view.buildHistorySheet(shell);

    expect(sheet.hasClass('grimoire-history-menu')).toBe(true);
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-label')).toBe('Chat history');
    expect(sheet.getAttribute('aria-hidden')).toBe('true');
    expect(shell.children.includes(sheet as any)).toBe(true);
  });

  it('uses final chat-window classes for the root shell', async () => {
    const containerEl = createMockEl();
    const contentEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.contentEl = contentEl;
    view.plugin = {
      settings: {},
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
      findConversationAcrossViews: jest.fn(),
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.restoreOrCreateTabs = jest.fn().mockResolvedValue(undefined);
    view.syncProviderBrandColor = jest.fn();
    view.wireEventHandlers = jest.fn();

    await view.onOpen();

    expect(contentEl.hasClass('grimoire-container')).toBe(true);
    expect(contentEl.hasClass('grimoire-container--chat-window')).toBe(true);
    expect(contentEl.hasClass('grimoire-container--workbench')).toBe(false);
    expect(contentEl.querySelector('.grimoire-chat-window-shell')).not.toBeNull();
    expect(contentEl.querySelector('.grimoire-session-strip')).not.toBeNull();
  });

  it('renders pending what is new release inside the chat window and acknowledges dismissal', async () => {
    const containerEl = createMockEl();
    const contentEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;
    const acknowledgePendingWhatsNew = jest.fn().mockResolvedValue(undefined);

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.contentEl = contentEl;
    view.plugin = {
      settings: {},
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
      findConversationAcrossViews: jest.fn(),
      getPendingWhatsNewRelease: jest.fn().mockReturnValue({
        version: '1.0.0',
        date: '2026-06-21',
        categories: [
          { title: 'Added', items: ['Inline release card.'] },
        ],
      }),
      acknowledgePendingWhatsNew,
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.restoreOrCreateTabs = jest.fn().mockResolvedValue(undefined);
    view.syncProviderBrandColor = jest.fn();
    view.wireEventHandlers = jest.fn();

    await view.onOpen();

    expect(contentEl.querySelector('.grimoire-whats-new-host')).not.toBeNull();
    expect(contentEl.querySelector('.grimoire-whats-new-card-title')?.textContent)
      .toBe('What\'s New in Grimoire v1.0.0');
    expect(contentEl.querySelector('.grimoire-whats-new-card-item')?.textContent)
      .toContain('Inline release card.');

    contentEl.querySelector('.grimoire-whats-new-card-dismiss')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(acknowledgePendingWhatsNew).toHaveBeenCalledTimes(1);
    expect(contentEl.querySelector('.grimoire-whats-new-card')).toBeNull();
  });

  it('can render pending what is new release after the chat window is already open', async () => {
    const containerEl = createMockEl();
    const contentEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;
    const getPendingWhatsNewRelease = jest.fn().mockReturnValue(null);

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.contentEl = contentEl;
    view.plugin = {
      settings: {},
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
      findConversationAcrossViews: jest.fn(),
      getPendingWhatsNewRelease,
      acknowledgePendingWhatsNew: jest.fn().mockResolvedValue(undefined),
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.restoreOrCreateTabs = jest.fn().mockResolvedValue(undefined);
    view.syncProviderBrandColor = jest.fn();
    view.wireEventHandlers = jest.fn();

    await view.onOpen();

    expect(contentEl.querySelector('.grimoire-whats-new-card')).toBeNull();

    getPendingWhatsNewRelease.mockReturnValue({
      version: '1.0.0',
      categories: [
        { title: 'Fixed', items: ['Refresh opened Grimoire windows.'] },
      ],
    });

    view.showPendingWhatsNew();

    expect(contentEl.querySelector('.grimoire-whats-new-card-title')?.textContent)
      .toBe('What\'s New in Grimoire v1.0.0');
    expect(contentEl.querySelector('.grimoire-whats-new-card-item')?.textContent)
      .toContain('Refresh opened Grimoire windows.');
  });

  it('persists tab state when blank tab draft settings change', async () => {
    const containerEl = createMockEl();
    const contentEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.contentEl = contentEl;
    view.plugin = {
      settings: {},
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
      findConversationAcrossViews: jest.fn(),
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.restoreOrCreateTabs = jest.fn().mockResolvedValue(undefined);
    view.syncProviderBrandColor = jest.fn();
    view.syncHeaderContextUsage = jest.fn();
    view.wireEventHandlers = jest.fn();

    await view.onOpen();

    view.updateTabBar = jest.fn();
    view.persistTabState = jest.fn();

    view.tabManager.callbacks.onTabDraftSettingsChanged('tab-1', 'codex', {
      model: 'gpt-5.5',
    });

    expect(view.updateTabBar).toHaveBeenCalled();
    expect(view.persistTabState).toHaveBeenCalled();
    expect(view.syncProviderBrandColor).toHaveBeenCalled();
    expect(view.syncHeaderContextUsage).toHaveBeenCalled();
  });

  it('does not build the removed quick appearance sheet', async () => {
    const containerEl = createMockEl();
    const contentEl = createMockEl();
    const view = Object.create(GrimoireView.prototype) as any;
    const saveSettings = jest.fn().mockResolvedValue(undefined);

    containerEl.ownerDocument.createDocumentFragment = jest.fn(() => createMockEl('fragment'));
    view.containerEl = containerEl;
    view.contentEl = contentEl;
    view.plugin = {
      settings: {},
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
      findConversationAcrossViews: jest.fn(),
      saveSettings,
    };
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.restoreOrCreateTabs = jest.fn().mockResolvedValue(undefined);
    view.syncProviderBrandColor = jest.fn();
    view.wireEventHandlers = jest.fn();

    await view.onOpen();

    expect(contentEl.querySelector('.grimoire-appearance-sheet')).toBeNull();
    expect(contentEl.querySelector('.grimoire-appearance-btn')).toBeNull();
    expect(contentEl.dataset.theme).toBeUndefined();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('hides the new-tab button when the tab manager is at capacity', () => {
    const { newTabButtonEl, view } = createViewHarness({ canCreateTab: false });

    view.refreshTabControls();

    expect(newTabButtonEl.hasClass('grimoire-hidden')).toBe(true);
    expect(newTabButtonEl.getAttribute('aria-disabled')).toBe('true');
    expect(newTabButtonEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the new-tab button when another tab can be created', () => {
    const { newTabButtonEl, view } = createViewHarness({ canCreateTab: true });
    newTabButtonEl.addClass('grimoire-hidden');
    newTabButtonEl.setAttribute('aria-disabled', 'true');
    newTabButtonEl.setAttribute('aria-hidden', 'true');

    view.refreshTabControls();

    expect(newTabButtonEl.hasClass('grimoire-hidden')).toBe(false);
    expect(newTabButtonEl.getAttribute('aria-disabled')).toBeNull();
    expect(newTabButtonEl.getAttribute('aria-hidden')).toBeNull();
  });
});

describe('GrimoireView Escape handling', () => {
  beforeEach(() => {
    MockScope.instances.length = 0;
  });

  function createEscapeHarness(options: {
    isStreaming: boolean;
    tabCount?: number;
  }): {
    cancelStreaming: jest.Mock;
    eventRefs: unknown[];
    requestTabClose: jest.Mock;
    view: any;
  } {
    const cancelStreaming = jest.fn();
    const requestTabClose = jest.fn().mockResolvedValue(undefined);
    const eventRefs: unknown[] = [];
    const parentScope = new Scope();
    const view = Object.create(GrimoireView.prototype) as any;

    view.app = { scope: parentScope };
    view.containerEl = createMockEl();
    view.historyDropdown = createMockEl();
    view.registerDomEvent = jest.fn();
    view.registerEvent = jest.fn();
    view.eventRefs = eventRefs;
    view.plugin = {
      app: {
        vault: {
          on: jest.fn((_event: string, handler: unknown) => {
            const ref = { handler };
            eventRefs.push(ref);
            return ref;
          }),
        },
        workspace: {
          on: jest.fn((_event: string, handler: unknown) => {
            const ref = { handler };
            eventRefs.push(ref);
            return ref;
          }),
        },
      },
    };
    view.tabManager = {
      getActiveTab: jest.fn().mockReturnValue({
        state: { isStreaming: options.isStreaming },
        controllers: {
          inputController: { cancelStreaming },
        },
        ui: {
          fileContextManager: {
            markFileCacheDirty: jest.fn(),
            markFolderCacheDirty: jest.fn(),
            handleFileOpen: jest.fn(),
            handleClickOutside: jest.fn(),
          },
        },
      }),
      getTabCount: jest.fn().mockReturnValue(options.tabCount ?? 2),
      getActiveTabId: jest.fn().mockReturnValue('active-tab'),
    };
    view.requestTabClose = requestTabClose;

    return { cancelStreaming, eventRefs, requestTabClose, view };
  }

  it('registers Escape on the Obsidian view scope instead of document keydown capture', () => {
    const { view } = createEscapeHarness({ isStreaming: true });

    view.wireEventHandlers();

    expect(view.scope).toBeInstanceOf(Scope);
    expect(view.scope.parent).toBe(view.app.scope);
    expect(view.scope.register).toHaveBeenCalledWith([], 'Escape', expect.any(Function));
    expect(view.registerDomEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      'keydown',
      expect.any(Function),
      { capture: true }
    );
  });

  it('cancels streaming and consumes scoped Escape', () => {
    const { cancelStreaming, view } = createEscapeHarness({ isStreaming: true });

    view.wireEventHandlers();
    const escapeHandler = view.scope.handlers.find((handler: any) => handler.key === 'Escape');
    const result = escapeHandler.func({ key: 'Escape', isComposing: false } as KeyboardEvent);

    expect(cancelStreaming).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  it('consumes scoped Escape without cancelling when not streaming', () => {
    const { cancelStreaming, view } = createEscapeHarness({ isStreaming: false });

    view.wireEventHandlers();
    const escapeHandler = view.scope.handlers.find((handler: any) => handler.key === 'Escape');
    const result = escapeHandler.func({ key: 'Escape', isComposing: false } as KeyboardEvent);

    expect(cancelStreaming).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('consumes already handled scoped Escape without cancelling again', () => {
    const { cancelStreaming, view } = createEscapeHarness({ isStreaming: true });

    view.wireEventHandlers();
    const escapeHandler = view.scope.handlers.find((handler: any) => handler.key === 'Escape');
    const result = escapeHandler.func({
      key: 'Escape',
      isComposing: false,
      defaultPrevented: true,
    } as KeyboardEvent);

    expect(cancelStreaming).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('closes the active Grimoire tab with Mod+W', () => {
    const { requestTabClose, view } = createEscapeHarness({
      isStreaming: false,
      tabCount: 3,
    });

    view.wireEventHandlers();
    const closeHandler = view.scope.handlers.find((handler: any) => (
      handler.key === 'w' && handler.modifiers?.includes('Mod')
    ));
    const result = closeHandler.func({ key: 'w', isComposing: false } as KeyboardEvent);

    expect(requestTabClose).toHaveBeenCalledWith('active-tab');
    expect(result).toBe(false);
  });

  it('keeps the last Grimoire tab open while consuming Mod+W', () => {
    const { requestTabClose, view } = createEscapeHarness({
      isStreaming: false,
      tabCount: 1,
    });

    view.wireEventHandlers();
    const closeHandler = view.scope.handlers.find((handler: any) => (
      handler.key === 'w' && handler.modifiers?.includes('Mod')
    ));
    const result = closeHandler.func({ key: 'w', isComposing: false } as KeyboardEvent);

    expect(requestTabClose).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

describe('GrimoireView permission mode shortcut', () => {
  function createPermissionShortcutHarness(permissionMode: string) {
    const handlers: Array<(event: KeyboardEvent) => void> = [];
    const inputWrapper = createMockEl();
    const activeTab = {
      providerId: 'claude',
      lifecycleState: 'active',
      conversationId: null,
      draftModel: null,
      service: null,
      state: { prePlanPermissionMode: null },
      ui: { permissionToggle: { updateDisplay: jest.fn() } },
      dom: { inputWrapper },
    };
    const view = Object.create(GrimoireView.prototype) as any;

    view.app = { scope: new Scope() };
    view.containerEl = createMockEl();
    view.historyDropdown = createMockEl();
    view.eventRefs = [];
    view.registerDomEvent = jest.fn((_target, eventName, handler) => {
      if (eventName === 'keydown') handlers.push(handler);
    });
    view.registerEvent = jest.fn();
    view.plugin = {
      settings: {
        settingsProvider: 'claude',
        providerConfigs: { claude: { enabled: true } },
        model: 'sonnet',
        permissionMode,
        savedProviderModel: {},
        savedProviderEffort: {},
        savedProviderServiceTier: {},
        savedProviderThinkingBudget: {},
        savedProviderPermissionMode: {},
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
      app: {
        vault: { on: jest.fn() },
        workspace: { on: jest.fn() },
      },
    };
    view.tabManager = { getActiveTab: jest.fn().mockReturnValue(activeTab) };
    view.wireEventHandlers();

    const keydown = handlers[0];
    const pressShiftTab = () => keydown({
      key: 'Tab',
      shiftKey: true,
      isComposing: false,
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent);

    return { activeTab, pressShiftTab, view };
  }

  it('cycles Safe, Auto-approve, and Plan with Shift+Tab', () => {
    const { activeTab, pressShiftTab, view } = createPermissionShortcutHarness('normal');

    pressShiftTab();
    expect(view.plugin.settings.permissionMode).toBe('full_access');

    pressShiftTab();
    expect(view.plugin.settings.permissionMode).toBe('plan');
    expect(activeTab.state.prePlanPermissionMode).toBe('full_access');

    pressShiftTab();
    expect(view.plugin.settings.permissionMode).toBe('normal');
    expect(activeTab.state.prePlanPermissionMode).toBeNull();
  });
});

describe('GrimoireView orchestrator wiring', () => {
  function createOrchestratorHarness() {
    const view = Object.create(GrimoireView.prototype) as any;
    const orchestratorStreamController = {
      setOrchestratorCallbacks: jest.fn(),
    };
    const workerStreamController = {
      setOrchestratorCallbacks: jest.fn(),
    };
    const workerSendMessage = jest.fn().mockResolvedValue(undefined);
    const workerTab = {
      id: 'worker-tab',
      orchestratorMode: false,
      orchestratorTabId: 'orchestrator-tab',
      controllers: {
        inputController: { sendMessage: workerSendMessage },
        streamController: workerStreamController,
      },
    };
    const orchestratorTab = {
      id: 'orchestrator-tab',
      orchestratorMode: true,
      controllers: {
        streamController: orchestratorStreamController,
      },
    };
    const tabManager = {
      createWorkerTab: jest.fn().mockResolvedValue(workerTab),
      getTab: jest.fn((tabId: string) => {
        if (tabId === 'orchestrator-tab') return orchestratorTab;
        if (tabId === 'worker-tab') return workerTab;
        return null;
      }),
    };
    const orchestratorService = {
      registerWorker: jest.fn(),
      reportResult: jest.fn(),
    };

    view.tabManager = tabManager;
    view.orchestratorService = orchestratorService;
    view.updateTabBar = jest.fn();
    view.persistTabState = jest.fn();

    return {
      orchestratorService,
      orchestratorStreamController,
      orchestratorTab,
      tabManager,
      view,
      workerSendMessage,
      workerStreamController,
      workerTab,
    };
  }

  it('spawns worker tabs from an approved orchestrator plan', async () => {
    const {
      orchestratorService,
      orchestratorStreamController,
      orchestratorTab,
      tabManager,
      view,
      workerSendMessage,
      workerStreamController,
    } = createOrchestratorHarness();
    const containerEl = createMockEl();

    view.wireOrchestratorCallbacks(orchestratorTab);
    const [onPlanDetected, onWorkerDone, isOrchestratorMode] = orchestratorStreamController
      .setOrchestratorCallbacks.mock.calls[0];

    expect(onWorkerDone).toBeUndefined();
    expect(isOrchestratorMode()).toBe(true);

    onPlanDetected(containerEl, {
      type: 'orchestrator_plan',
      tasks: [
        {
          id: 'research',
          description: 'Research implementation',
          prompt: 'Inspect the implementation files',
        },
        {
          id: 'tests',
          description: 'Add regression tests',
          prompt: 'Write focused tests',
        },
      ],
    });

    containerEl.querySelector('.grimoire-orchestrator-plan-spawn-button')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(tabManager.createWorkerTab).toHaveBeenCalledTimes(2);
    expect(tabManager.createWorkerTab).toHaveBeenCalledWith('orchestrator-tab');
    expect(orchestratorService.registerWorker).toHaveBeenNthCalledWith(
      1,
      'orchestrator-tab',
      'worker-tab',
      'Research implementation',
    );
    expect(workerSendMessage).toHaveBeenCalledWith({ content: 'Inspect the implementation files' });
    expect(workerStreamController.setOrchestratorCallbacks).toHaveBeenCalled();
    expect(view.updateTabBar).toHaveBeenCalled();
    expect(view.persistTabState).toHaveBeenCalled();
  });

  it('reports worker completion through the orchestrator service', () => {
    const {
      orchestratorService,
      view,
      workerStreamController,
      workerTab,
    } = createOrchestratorHarness();

    view.wireOrchestratorCallbacks(workerTab);
    const [onPlanDetected, onWorkerDone] = workerStreamController
      .setOrchestratorCallbacks.mock.calls[0];

    expect(onPlanDetected).toBeUndefined();
    onWorkerDone('Worker result', false);

    expect(orchestratorService.reportResult).toHaveBeenCalledWith('worker-tab', 'Worker result', false);
  });
});
