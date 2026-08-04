import { createMockEl } from '@test/helpers/mockElement';
import { setIcon } from 'obsidian';

import {
  createProgressBlock,
  finalizeProgressBlock,
  renderStoredProgressBlock,
  updateProgressBlock,
} from '@/features/chat/rendering/ProgressBlockRenderer';

const renderContent = jest.fn().mockResolvedValue(undefined);

describe('ProgressBlockRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a live progress update with an accessible heartbeat', async () => {
    const parentEl = createMockEl();
    const progress = await createProgressBlock(
      parentEl,
      { content: 'Inspecting provider output', state: 'running' },
      renderContent,
    );

    expect(progress.wrapperEl.getAttribute('role')).toBe('status');
    expect(progress.metaEl.textContent).toContain('Working');
    expect(renderContent).toHaveBeenCalledWith(progress.contentEl, 'Inspecting provider output');
    expect(setIcon).toHaveBeenCalledWith(progress.iconEl, 'loader-circle');

    jest.advanceTimersByTime(61_000);
    expect(progress.metaEl.textContent).toContain('Still working');
  });

  it('updates plan items in place and stops its timer when completed', async () => {
    const progress = await createProgressBlock(
      createMockEl(),
      {
        content: 'Running plan',
        state: 'running',
        items: [{ content: 'Inspect files', status: 'in_progress' }],
      },
      renderContent,
    );

    await updateProgressBlock(
      progress,
      {
        content: 'Plan completed',
        state: 'completed',
        items: [{ content: 'Inspect files', status: 'completed' }],
      },
      renderContent,
    );

    expect(progress.timerInterval).toBeNull();
    expect(progress.wrapperEl.hasClass('grimoire-progress-block--completed')).toBe(true);
    expect(progress.itemsEl.querySelector('.grimoire-progress-item--completed')).toBeTruthy();
  });

  it('finalizes an active update and returns its duration', async () => {
    const progress = await createProgressBlock(
      createMockEl(),
      { content: 'Testing', state: 'running' },
      renderContent,
    );
    jest.advanceTimersByTime(5_000);

    const duration = finalizeProgressBlock(progress);

    expect(duration).toBe(5);
    expect(progress.metaEl.textContent).toContain('Completed');
    expect(progress.timerInterval).toBeNull();
  });

  it('restores persisted progress without restarting a live timer', () => {
    const parentEl = createMockEl();
    const wrapperEl = renderStoredProgressBlock(
      parentEl,
      { content: 'Verified output', state: 'completed', durationSeconds: 8 },
      renderContent,
    );

    expect(wrapperEl.hasClass('grimoire-progress-block--completed')).toBe(true);
    expect(wrapperEl.querySelector('.grimoire-progress-meta')?.textContent).toContain('Completed');
  });

  it('restores a legacy completed plan with unfinished items as waiting', () => {
    const wrapperEl = renderStoredProgressBlock(
      createMockEl(),
      {
        content: 'Inspect the vault',
        state: 'completed',
        durationSeconds: 4,
        items: [{ content: 'Inspect the vault', status: 'in_progress' }],
      },
      renderContent,
    );

    expect(wrapperEl.hasClass('grimoire-progress-block--waiting')).toBe(true);
    expect(wrapperEl.querySelector('.grimoire-progress-meta')?.textContent).toContain('Waiting');
    expect(setIcon).toHaveBeenCalledWith(expect.anything(), 'clock-3');
  });
});
