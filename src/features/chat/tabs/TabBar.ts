import type { TabBarItem, TabId } from './types';

/** Callbacks for TabBar interactions. */
export interface TabBarCallbacks {
  /** Called when a tab badge is clicked. */
  onTabClick: (tabId: TabId) => void;

  /** Called when a tab badge is right-clicked. */
  onTabContextMenu: (tabId: TabId, event: MouseEvent) => void;

  /** Called when a tab badge is middle-clicked. */
  onTabMiddleClick: (tabId: TabId) => void;

  /** Called when the new tab button is clicked. */
  onNewTab: () => void;
}

/**
 * TabBar renders minimal numbered badge navigation.
 */
export class TabBar {
  private containerEl: HTMLElement;
  private callbacks: TabBarCallbacks;

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.build();
  }

  /** Builds the tab bar UI. */
  private build(): void {
    this.containerEl.addClass('grimoire-tab-badges');
  }

  /**
   * Updates the tab bar with new tab data.
   * @param items Tab items to render.
   */
  update(items: TabBarItem[]): void {
    // Clear existing badges
    this.containerEl.empty();

    // Render badges
    for (const item of items) {
      this.renderBadge(item);
    }
  }

  /** Renders a single tab badge. */
  private renderBadge(item: TabBarItem): void {
    const stateClass = item.needsAttention
      ? 'grimoire-tab-badge-attention'
      : item.isStreaming
        ? 'grimoire-tab-badge-streaming'
        : 'grimoire-tab-badge-idle';
    const activeClass = item.isActive ? ' grimoire-tab-badge-active' : '';

    const badgeEl = this.containerEl.createDiv({
      cls: `grimoire-tab-badge ${stateClass}${activeClass}`,
    });
    badgeEl.createSpan({ cls: 'grimoire-tab-activity-dot' });
    badgeEl.createSpan({ cls: 'grimoire-tab-number', text: String(item.index) });

    // Tooltip with full title (aria-label only; adding title too causes double tooltip)
    badgeEl.setAttribute('aria-label', this.getAccessibleTitle(item));
    badgeEl.setAttribute('data-provider', item.providerId);
    if (item.isOrchestrator) {
      badgeEl.setAttribute('data-orchestrator', 'true');
    }
    if (item.isWorker) {
      badgeEl.setAttribute('data-worker', 'true');
    }

    badgeEl.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      this.callbacks.onTabContextMenu(item.id, event);
    });

    badgeEl.addEventListener('auxclick', (event: MouseEvent) => {
      if (event.button !== 1 || !item.canClose) return;
      event.preventDefault();
      this.callbacks.onTabMiddleClick(item.id);
    });

    // Click handler to switch tab
    badgeEl.addEventListener('click', () => {
      this.callbacks.onTabClick(item.id);
    });
  }

  private getAccessibleTitle(item: TabBarItem): string {
    if (item.isOrchestrator) {
      return `Orchestrator: ${item.title}`;
    }
    if (item.isWorker) {
      return `Worker: ${item.title}`;
    }
    return item.title;
  }

  /** Destroys the tab bar. */
  destroy(): void {
    this.containerEl.empty();
    this.containerEl.removeClass('grimoire-tab-badges');
  }
}
