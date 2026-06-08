/**
 * @jest-environment jsdom
 */

import type { RelevantNote } from '@/core/context/types';
import { RelevantNotesView } from '@/features/chat/ui/RelevantNotesView';
import { setLocale } from '@/i18n/i18n';

function note(path: string, title: string, score = 1): RelevantNote {
  return {
    path,
    title,
    score,
    reasons: ['text'],
  };
}

describe('RelevantNotesView', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('renders an empty source state for empty notes', () => {
    const container = document.createElement('div');
    const view = new RelevantNotesView(container, jest.fn());

    view.render([]);

    expect(container.classList.contains('grimoire-source-card-stack')).toBe(true);
    expect(container.querySelector('.grimoire-source-empty')?.textContent).toBe('No source notes yet');
  });

  it('renders note buttons as source cards', () => {
    const container = document.createElement('div');
    const view = new RelevantNotesView(container, jest.fn());

    view.render([
      note('notes/A.md', 'Alpha'),
      note('notes/B.md', 'Beta'),
    ]);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.grimoire-source-card'));

    expect(container.classList.contains('grimoire-source-card-stack')).toBe(true);
    expect(buttons.map(button => button.querySelector('.grimoire-source-card-title')?.textContent)).toEqual(['Alpha', 'Beta']);
    expect(buttons.map(button => button.querySelector('.grimoire-source-card-path')?.textContent)).toEqual(['notes/A.md', 'notes/B.md']);
    expect(buttons.every(button => button.querySelector('.grimoire-source-card-dot') != null)).toBe(true);
    expect(buttons[0].querySelector('.grimoire-source-card-score')?.textContent).toBe('100% match');
    expect(buttons.map(button => button.type)).toEqual(['button', 'button']);
  });

  it('does not multiply scores that are already percentages', () => {
    const container = document.createElement('div');
    const view = new RelevantNotesView(container, jest.fn());

    view.render([note('notes/A.md', 'Alpha', 31)]);

    expect(container.querySelector('.grimoire-source-card-score')?.textContent).toBe('31% match');
  });

  it('caps source cards and shows an overflow count', () => {
    const container = document.createElement('div');
    const view = new RelevantNotesView(container, jest.fn());

    view.render([
      note('notes/A.md', 'Alpha'),
      note('notes/B.md', 'Beta'),
      note('notes/C.md', 'Gamma'),
      note('notes/D.md', 'Delta'),
      note('notes/E.md', 'Epsilon'),
      note('notes/F.md', 'Zeta'),
      note('notes/G.md', 'Eta'),
    ]);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.grimoire-source-card'));
    const more = container.querySelector('.grimoire-source-more');

    expect(buttons.map(button => button.querySelector('.grimoire-source-card-title')?.textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Epsilon',
      'Zeta',
    ]);
    expect(more?.textContent).toBe('+1 more notes');
  });

  it('opens the clicked note path', () => {
    const container = document.createElement('div');
    const openVaultPath = jest.fn();
    const view = new RelevantNotesView(container, openVaultPath);

    view.render([note('notes/A.md', 'Alpha')]);
    container.querySelector<HTMLButtonElement>('.grimoire-source-card')?.click();

    expect(openVaultPath).toHaveBeenCalledWith('notes/A.md');
  });

  it('filters linked and current sources from the source controls', () => {
    const container = document.createElement('div');
    const filtersEl = document.createElement('div');
    filtersEl.innerHTML = `
      <button class="grimoire-source-filter is-active" data-source-filter="all">All</button>
      <button class="grimoire-source-filter" data-source-filter="linked">Linked</button>
      <button class="grimoire-source-filter" data-source-filter="current">Current</button>
    `;
    const countEl = document.createElement('span');
    const view = new RelevantNotesView(container, jest.fn(), {
      filtersEl,
      shownCountEl: countEl,
    });

    view.render([
      note('notes/linked.md', 'Linked source', 0.81),
    ], [
      {
        path: 'notes/current.md',
        title: 'Current note',
        detail: 'current note',
        badge: 'live',
      },
    ]);

    expect(Array.from(container.querySelectorAll('.grimoire-source-card-title')).map(el => el.textContent)).toEqual([
      'Current note',
      'Linked source',
    ]);
    expect(container.querySelector<HTMLButtonElement>('[data-source-kind="current"] .grimoire-source-card-dot')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[data-source-kind="linked"] .grimoire-source-card-dot')).not.toBeNull();
    expect(countEl.textContent).toBe('2 shown');

    filtersEl.querySelector<HTMLButtonElement>('[data-source-filter="linked"]')?.click();
    expect(Array.from(container.querySelectorAll('.grimoire-source-card-title')).map(el => el.textContent)).toEqual([
      'Linked source',
    ]);
    expect(countEl.textContent).toBe('1 shown');

    filtersEl.querySelector<HTMLButtonElement>('[data-source-filter="current"]')?.click();
    expect(Array.from(container.querySelectorAll('.grimoire-source-card-title')).map(el => el.textContent)).toEqual([
      'Current note',
    ]);
    expect(countEl.textContent).toBe('1 shown');
  });

  it('localizes the empty source state', () => {
    const container = document.createElement('div');
    const view = new RelevantNotesView(container, jest.fn());
    setLocale('de');

    view.render([]);

    expect(container.textContent).toContain('Noch keine Quellnotizen');
  });
});
