import { setIcon } from 'obsidian';

import type { ProgressItem, ProgressState } from '../../../core/types';
import { t } from '../../../i18n/i18n';
import { formatDurationMmSs } from '../../../utils/date';
import type { RenderContentFn } from './MessageRenderer';

export interface ProgressBlockState {
  wrapperEl: HTMLElement;
  iconEl: HTMLElement;
  contentEl: HTMLElement;
  itemsEl: HTMLElement;
  metaEl: HTMLElement;
  content: string;
  items?: ProgressItem[];
  state: ProgressState;
  startTime: number;
  timerInterval: number | null;
}

export interface ProgressBlockUpdate {
  content: string;
  state: ProgressState;
  items?: ProgressItem[];
}

const RUNNING_HEARTBEAT_SECONDS = 60;

function getElapsedSeconds(progress: ProgressBlockState): number {
  return Math.max(0, Math.floor((Date.now() - progress.startTime) / 1000));
}

function updateIcon(progress: ProgressBlockState): void {
  progress.wrapperEl.removeClass('grimoire-progress-block--running');
  progress.wrapperEl.removeClass('grimoire-progress-block--completed');
  progress.wrapperEl.removeClass('grimoire-progress-block--blocked');
  progress.wrapperEl.addClass(`grimoire-progress-block--${progress.state}`);

  const icon = progress.state === 'running'
    ? 'loader-circle'
    : progress.state === 'blocked'
      ? 'circle-alert'
      : 'circle-check';
  setIcon(progress.iconEl, icon);
}

function updateMeta(progress: ProgressBlockState): void {
  const elapsed = getElapsedSeconds(progress);
  if (progress.state === 'running') {
    const label = elapsed >= RUNNING_HEARTBEAT_SECONDS
      ? t('chat.ui.progress.stillWorking')
      : t('chat.ui.progress.working');
    progress.metaEl.setText(`${label} · ${formatDurationMmSs(elapsed)}`);
    return;
  }

  progress.metaEl.setText(
    `${progress.state === 'blocked' ? t('chat.ui.progress.blocked') : t('chat.ui.progress.completed')} · ${formatDurationMmSs(elapsed)}`,
  );
}

function renderItems(progress: ProgressBlockState): void {
  progress.itemsEl.empty();
  const items = progress.items ?? [];
  progress.itemsEl.toggleClass('grimoire-hidden', items.length === 0);

  for (const item of items) {
    const rowEl = progress.itemsEl.createDiv({
      cls: `grimoire-progress-item grimoire-progress-item--${item.status}`,
    });
    const iconEl = rowEl.createSpan({ cls: 'grimoire-progress-item-icon' });
    setIcon(
      iconEl,
      item.status === 'completed' ? 'check' : item.status === 'in_progress' ? 'loader-circle' : 'circle',
    );
    rowEl.createSpan({ cls: 'grimoire-progress-item-label', text: item.content });
  }
}

async function renderProgressContent(
  progress: ProgressBlockState,
  renderContent: RenderContentFn,
): Promise<void> {
  if (!progress.content.trim()) {
    progress.contentEl.empty();
    return;
  }

  await renderContent(progress.contentEl, progress.content);
}

function startTimer(progress: ProgressBlockState): void {
  if (progress.state !== 'running' || progress.timerInterval !== null) return;
  const timerWindow = progress.wrapperEl.ownerDocument.defaultView;
  if (!timerWindow) return;
  progress.timerInterval = timerWindow.setInterval(() => updateMeta(progress), 1000);
}

function stopTimer(progress: ProgressBlockState): void {
  if (progress.timerInterval === null) return;
  progress.wrapperEl.ownerDocument.defaultView?.clearInterval(progress.timerInterval);
  progress.timerInterval = null;
}

export async function createProgressBlock(
  parentEl: HTMLElement,
  update: ProgressBlockUpdate,
  renderContent: RenderContentFn,
): Promise<ProgressBlockState> {
  const wrapperEl = parentEl.createDiv({
    cls: 'grimoire-progress-block',
  });
  wrapperEl.setAttribute('role', 'status');
  wrapperEl.setAttribute('aria-live', 'polite');
  wrapperEl.setAttribute('aria-atomic', 'false');
  const headerEl = wrapperEl.createDiv({ cls: 'grimoire-progress-header' });
  const iconEl = headerEl.createSpan({ cls: 'grimoire-progress-icon' });
  const metaEl = headerEl.createSpan({ cls: 'grimoire-progress-meta' });
  const contentEl = wrapperEl.createDiv({ cls: 'grimoire-progress-content', attr: { dir: 'auto' } });
  const itemsEl = wrapperEl.createDiv({ cls: 'grimoire-progress-items' });
  const progress: ProgressBlockState = {
    wrapperEl,
    iconEl,
    contentEl,
    itemsEl,
    metaEl,
    content: update.content,
    items: update.items,
    state: update.state,
    startTime: Date.now(),
    timerInterval: null,
  };

  updateIcon(progress);
  updateMeta(progress);
  renderItems(progress);
  await renderProgressContent(progress, renderContent);
  startTimer(progress);
  return progress;
}

export async function updateProgressBlock(
  progress: ProgressBlockState,
  update: ProgressBlockUpdate,
  renderContent: RenderContentFn,
): Promise<void> {
  progress.content = update.content;
  progress.items = update.items;
  progress.state = update.state;
  updateIcon(progress);
  updateMeta(progress);
  renderItems(progress);
  await renderProgressContent(progress, renderContent);

  if (progress.state === 'running') {
    startTimer(progress);
  } else {
    stopTimer(progress);
  }
}

export function finalizeProgressBlock(
  progress: ProgressBlockState,
  state: Exclude<ProgressState, 'running'> = 'completed',
): number {
  progress.state = state;
  stopTimer(progress);
  updateIcon(progress);
  updateMeta(progress);
  return getElapsedSeconds(progress);
}

export function cleanupProgressBlock(progress: ProgressBlockState): void {
  stopTimer(progress);
}

export function renderStoredProgressBlock(
  parentEl: HTMLElement,
  update: ProgressBlockUpdate & { durationSeconds?: number },
  renderContent: RenderContentFn,
): HTMLElement {
  const wrapperEl = parentEl.createDiv({
    cls: `grimoire-progress-block grimoire-progress-block--${update.state}`,
  });
  wrapperEl.setAttribute('role', 'status');
  const headerEl = wrapperEl.createDiv({ cls: 'grimoire-progress-header' });
  const iconEl = headerEl.createSpan({ cls: 'grimoire-progress-icon' });
  setIcon(iconEl, update.state === 'blocked' ? 'circle-alert' : 'circle-check');
  headerEl.createSpan({
    cls: 'grimoire-progress-meta',
    text: `${update.state === 'blocked' ? t('chat.ui.progress.blocked') : t('chat.ui.progress.completed')}${
      update.durationSeconds === undefined ? '' : ` · ${formatDurationMmSs(update.durationSeconds)}`
    }`,
  });
  const contentEl = wrapperEl.createDiv({ cls: 'grimoire-progress-content', attr: { dir: 'auto' } });
  if (update.content.trim()) {
    void renderContent(contentEl, update.content).catch(() => contentEl.setText(update.content));
  }
  const itemsEl = wrapperEl.createDiv({ cls: 'grimoire-progress-items' });
  const progress = {
    wrapperEl,
    iconEl,
    contentEl,
    itemsEl,
    metaEl: headerEl,
    content: update.content,
    items: update.items,
    state: update.state,
    startTime: Date.now(),
    timerInterval: null,
  } satisfies ProgressBlockState;
  renderItems(progress);
  return wrapperEl;
}
