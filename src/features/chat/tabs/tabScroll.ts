import type GrimoirePlugin from '../../../main';
import type { TabData } from './types';

export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 20;
export const AUTO_SCROLL_REENABLE_DELAY_MS = 150;
export function isTabScrollAtBottom(tab: TabData): boolean {
  const { scrollTop, scrollHeight, clientHeight } = tab.dom.chatScrollEl;
  return scrollHeight - scrollTop - clientHeight <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}

export function updateAutoScrollUI(tab: TabData, plugin: GrimoirePlugin): void {
  const autoScrollAllowed = plugin.settings.enableAutoScroll ?? true;
  const shouldQuietScrollbar = autoScrollAllowed && tab.state.isStreaming && tab.state.autoScrollEnabled;
  tab.dom.chatScrollEl.toggleClass('grimoire-chat-scroll--quiet', shouldQuietScrollbar);
}

export function scrollTabToBottom(tab: TabData, plugin: GrimoirePlugin): void {
  if (plugin.settings.enableAutoScroll ?? true) {
    tab.state.autoScrollEnabled = true;
  }

  tab.dom.chatScrollEl.scrollTop = tab.dom.chatScrollEl.scrollHeight;
  updateAutoScrollUI(tab, plugin);
}

export function shouldAutoScrollTab(tab: TabData, plugin: GrimoirePlugin): boolean {
  return (plugin.settings.enableAutoScroll ?? true) && tab.state.autoScrollEnabled;
}
