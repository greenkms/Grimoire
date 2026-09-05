/**
 * @jest-environment jsdom
 */
import { setTooltip } from 'obsidian';

import { buildTabMenuHeading, MAX_TAB_MENU_HEADING_LENGTH } from '@/features/chat/GrimoireView';

const LONG_TITLE = 'Объяснить логику системного промпта и генерации заголовков Grimoire';

describe('buildTabMenuHeading', () => {
  it('passes a short title through untouched', () => {
    expect(buildTabMenuHeading('Объяснить логику Grimoire')).toBe('Объяснить логику Grimoire');
  });

  it('keeps a title of exactly the budget intact', () => {
    const exact = 'x'.repeat(MAX_TAB_MENU_HEADING_LENGTH);

    expect(buildTabMenuHeading(exact)).toBe(exact);
  });

  it('shortens a longer title to the budget', () => {
    const heading = buildTabMenuHeading(LONG_TITLE) as DocumentFragment;
    const shown = heading.textContent ?? '';

    expect(shown).toHaveLength(MAX_TAB_MENU_HEADING_LENGTH);
    expect(shown.endsWith('…')).toBe(true);
    expect(LONG_TITLE.startsWith(shown.slice(0, -1))).toBe(true);
  });

  it('still exposes the whole name through the accessible label and tooltip', () => {
    (setTooltip as jest.Mock).mockClear();

    const heading = buildTabMenuHeading(LONG_TITLE) as DocumentFragment;
    const span = heading.firstElementChild;

    expect(span?.getAttribute('aria-label')).toBe(LONG_TITLE);
    expect(setTooltip).toHaveBeenCalledWith(span, LONG_TITLE, expect.anything());
  });
});
