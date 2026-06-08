import '@/providers';

import { createMockEl } from '@test/helpers/mockElement';

import { createTab } from '@/features/chat/tabs/Tab';

function createPluginHarness() {
  return {
    app: {
      vault: {},
      workspace: {
        getActiveFile: jest.fn().mockReturnValue(null),
      },
    },
    settings: {
      provider: 'claude',
      claude: {
        model: 'opus',
        thinkingBudget: 'default',
        effortLevel: 'medium',
        serviceTier: 'auto',
        permissionMode: 'normal',
      },
      codex: {
        model: 'gpt-5.4',
        thinkingBudget: 'default',
        effortLevel: 'medium',
        serviceTier: 'auto',
        permissionMode: 'normal',
      },
    },
  } as any;
}

describe('chat window tab DOM', () => {
  it('creates the vertical chat window views from the final design', () => {
    const container = createMockEl();
    const tab = createTab({
      plugin: createPluginHarness(),
      containerEl: container,
    });
    const dom = tab.dom as any;

    expect(dom.contentEl.classList.contains('grimoire-tab-chat-window')).toBe(true);
    expect(dom.contentEl.dataset.panelView).toBe('chat');
    expect(dom.panelTabsEl.querySelectorAll('.grimoire-panel-tab')).toHaveLength(3);
    expect(dom.focusedMainEl.contains(dom.focusedChatPanelEl)).toBe(true);
    expect(dom.focusedMainEl.contains(dom.focusedSourcesPanelEl)).toBe(true);
    expect(dom.focusedMainEl.contains(dom.focusedContextPanelEl)).toBe(true);
    expect(dom.focusedChatPanelEl.contains(dom.messagesEl)).toBe(true);
    expect(dom.focusedChatPanelEl.querySelector('.grimoire-bound-status')).not.toBeNull();
    expect(dom.focusedSourcesPanelEl.contains(dom.sourceCardsEl)).toBe(true);
    expect(dom.focusedSourcesPanelEl.contains(dom.statusPanelContainerEl)).toBe(true);
    expect(dom.focusedContextPanelEl.contains(dom.contextMemoryEl)).toBe(true);
    expect(dom.focusedContextPanelEl.querySelector('.grimoire-panel-section-heading')?._children[0].textContent)
      .toBe('Context memory · tab');
  });

  it('switches Chat, Sources, and Context without creating session tabs', () => {
    const container = createMockEl();
    const tab = createTab({
      plugin: createPluginHarness(),
      containerEl: container,
    });
    const dom = tab.dom as any;

    dom.sourcesPanelButtonEl.click();

    expect(dom.contentEl.dataset.panelView).toBe('sources');
    expect(dom.sourcesPanelButtonEl.classList.contains('is-active')).toBe(true);
    expect(dom.focusedSourcesPanelEl.classList.contains('is-active')).toBe(true);
    expect(dom.focusedChatPanelEl.hidden).toBe(true);
    expect(dom.focusedContextPanelEl.hidden).toBe(true);
    expect(container.querySelector('.grimoire-tab-badges')).toBeNull();
  });
});
