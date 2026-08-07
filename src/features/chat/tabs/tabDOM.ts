import { t } from '../../../i18n/i18n';
import { createInputResizeHandle } from '../ui/inputResizeHandle';
import type { TabDOMElements, TabPanelView } from './types';

export function buildTabDOM(contentEl: HTMLElement): TabDOMElements {
  contentEl.addClass('grimoire-tab-chat-window');
  contentEl.dataset.panelView = 'chat';

  const workbenchGridEl = contentEl.createDiv({ cls: 'grimoire-chat-window-grid' });

  const panelTabsEl = workbenchGridEl.createEl('nav', {
    cls: 'grimoire-panel-tabs',
  });
  const chatPanelButtonEl = panelTabsEl.createEl('button', {
    cls: 'grimoire-panel-tab is-active',
    text: t('chat.ui.view.chat'),
    attr: { type: 'button', 'data-panel-view': 'chat', 'aria-pressed': 'true' },
  });
  const sourcesPanelButtonEl = panelTabsEl.createEl('button', {
    cls: 'grimoire-panel-tab',
    text: t('chat.ui.view.sources'),
    attr: { type: 'button', 'data-panel-view': 'sources', 'aria-pressed': 'false' },
  });
  const contextPanelButtonEl = panelTabsEl.createEl('button', {
    cls: 'grimoire-panel-tab',
    text: t('chat.ui.view.context'),
    attr: { type: 'button', 'data-panel-view': 'context', 'aria-pressed': 'false' },
  });
  const chatScrollEl = workbenchGridEl.createDiv({
    cls: 'grimoire-chat-scroll',
    attr: { 'aria-live': 'polite' },
  });
  const focusedMainEl = chatScrollEl.createDiv({ cls: 'grimoire-panel-content' });

  const chatStageEl = focusedMainEl.createDiv({
    cls: 'grimoire-panel-view grimoire-chat-panel is-active',
    attr: { 'data-panel-view': 'chat' },
  });
  const boundStatusEl = chatStageEl.createDiv({ cls: 'grimoire-bound-status grimoire-hidden' });
  const boundStatusDotEl = boundStatusEl.createSpan({ cls: 'grimoire-bound-status-dot' });
  const boundStatusNoteEl = boundStatusEl.createSpan({ cls: 'grimoire-bound-status-note' });
  const boundStatusMetaEl = boundStatusEl.createSpan({ cls: 'grimoire-bound-status-meta' });
  const messagesWrapperEl = chatStageEl.createDiv({ cls: 'grimoire-messages-wrapper' });
  const messagesEl = messagesWrapperEl.createDiv({ cls: 'grimoire-messages' });
  const welcomeEl = messagesEl.createDiv({ cls: 'grimoire-welcome grimoire-welcome--chat-window' });

  const sourceRailEl = focusedMainEl.createDiv({
    cls: 'grimoire-panel-view grimoire-sources-panel',
    attr: { 'data-panel-view': 'sources' },
  });
  sourceRailEl.hidden = true;
  const sourceHeaderEl = sourceRailEl.createDiv({ cls: 'grimoire-panel-section-heading' });
  sourceHeaderEl.createSpan({ text: t('chat.ui.view.sourcesInTab') });
  const sourceShownCountEl = sourceHeaderEl.createSpan({
    cls: 'grimoire-panel-section-count',
    text: t('chat.ui.view.shownCount', { count: 0 }),
  });
  const sourceFiltersEl = sourceRailEl.createDiv({ cls: 'grimoire-source-filters' });
  sourceFiltersEl.createEl('button', {
    cls: 'grimoire-source-filter is-active',
    text: t('chat.ui.view.all'),
    attr: { type: 'button', 'data-source-filter': 'all', 'aria-pressed': 'true' },
  });
  sourceFiltersEl.createEl('button', {
    cls: 'grimoire-source-filter',
    text: t('chat.ui.view.linked'),
    attr: { type: 'button', 'data-source-filter': 'linked', 'aria-pressed': 'false' },
  });
  sourceFiltersEl.createEl('button', {
    cls: 'grimoire-source-filter',
    text: t('chat.ui.view.current'),
    attr: { type: 'button', 'data-source-filter': 'current', 'aria-pressed': 'false' },
  });
  const sourceCardsEl = sourceRailEl.createDiv({ cls: 'grimoire-source-card-stack' });
  const statusPanelContainerEl = sourceRailEl.createDiv({
    cls: 'grimoire-status-panel-container grimoire-operational-panel',
  });

  const contextRailEl = focusedMainEl.createDiv({
    cls: 'grimoire-panel-view grimoire-context-panel',
    attr: { 'data-panel-view': 'context' },
  });
  contextRailEl.hidden = true;
  const contextHeaderEl = contextRailEl.createDiv({ cls: 'grimoire-panel-section-heading' });
  contextHeaderEl.createSpan({ text: t('chat.ui.view.contextMemoryTab') });
  const contextSummaryEl = contextRailEl.createDiv({ cls: 'grimoire-context-summary' });
  const contextMemoryEl = contextRailEl.createDiv({ cls: 'grimoire-context-memory-panel grimoire-hidden' });
  const contextRuntimeEl = contextRailEl.createDiv({ cls: 'grimoire-context-runtime-panel grimoire-hidden' });

  const composerSurfaceEl = workbenchGridEl.createDiv({ cls: 'grimoire-composer-surface grimoire-composer' });
  const inputContainerEl = composerSurfaceEl.createDiv({
    cls: 'grimoire-input-container grimoire-composer-shell',
  });
  const queueIndicatorEl = inputContainerEl.createDiv({ cls: 'grimoire-input-queue-row' });
  const inputWrapper = inputContainerEl.createDiv({ cls: 'grimoire-input-wrapper' });
  const contextRowEl = inputWrapper.createDiv({ cls: 'grimoire-context-row' });
  const inputEl = inputWrapper.createEl('textarea', {
    cls: 'grimoire-input',
    attr: {
      placeholder: t('chat.ui.composer.placeholder'),
      rows: '3',
      dir: 'auto',
    },
  });
  const panelViews: Record<TabPanelView, HTMLElement> = {
    chat: chatStageEl,
    sources: sourceRailEl,
    context: contextRailEl,
  };
  const panelButtons: Record<TabPanelView, HTMLButtonElement> = {
    chat: chatPanelButtonEl,
    sources: sourcesPanelButtonEl,
    context: contextPanelButtonEl,
  };
  const setPanelView = (view: TabPanelView): void => {
    contentEl.dataset.panelView = view;
    for (const [name, panelEl] of Object.entries(panelViews) as [TabPanelView, HTMLElement][]) {
      const isActive = name === view;
      panelEl.hidden = !isActive;
      panelEl.toggleClass('is-active', isActive);
      panelButtons[name].toggleClass('is-active', isActive);
      panelButtons[name].setAttribute('aria-pressed', String(isActive));
    }
  };
  chatPanelButtonEl.addEventListener('click', () => setPanelView('chat'));
  sourcesPanelButtonEl.addEventListener('click', () => setPanelView('sources'));
  contextPanelButtonEl.addEventListener('click', () => setPanelView('context'));

  return {
    contentEl,
    workbenchGridEl,
    contextRailEl,
    contextMemoryEl,
    contextRuntimeEl,
    contextSummaryEl,
    chatStageEl,
    chatScrollEl,
    sourceRailEl,
    sourceCardsEl,
    sourceFiltersEl,
    sourceShownCountEl,
    composerSurfaceEl,
    panelTabsEl,
    chatPanelButtonEl,
    sourcesPanelButtonEl,
    contextPanelButtonEl,
    focusedMainEl,
    focusedChatPanelEl: chatStageEl,
    focusedSourcesPanelEl: sourceRailEl,
    focusedContextPanelEl: contextRailEl,
    boundStatusEl,
    boundStatusDotEl,
    boundStatusNoteEl,
    boundStatusMetaEl,
    messagesEl,
    welcomeEl,
    statusPanelContainerEl,
    inputContainerEl,
    queueIndicatorEl,
    inputWrapper,
    inputEl,
    sendButtonEl: null,
    stopButtonEl: null,
    contextRowEl,
    selectionIndicatorEl: null,
    browserIndicatorEl: null,
    canvasIndicatorEl: null,
    eventCleanups: [],
  };
}

export function attachInputResizeHandle(dom: TabDOMElements): () => void {
  const viewport = dom.inputWrapper.closest<HTMLElement>('.grimoire-container');
  if (!viewport) {
    return () => {};
  }

  return createInputResizeHandle({
    inputWrapper: dom.inputWrapper,
    viewport,
  });
}
