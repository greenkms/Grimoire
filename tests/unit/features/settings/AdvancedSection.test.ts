import { createMockEl } from '@test/helpers/mockElement';

import { renderAdvancedSection } from '@/features/settings/ui/AdvancedSection';

describe('renderAdvancedSection', () => {
  it('renders a collapsed advanced disclosure with count and aria state', () => {
    const container = createMockEl('div') as unknown as HTMLElement;

    const body = renderAdvancedSection(container, {
      count: 12,
      id: 'general',
      isOpen: () => false,
      setOpen: jest.fn(),
      summary: 'Prompts, hotkeys, environment variables, and more',
    });

    const toggle = (container as any).querySelector('.grimoire-adv-toggle');
    const wrap = (container as any).querySelector('.grimoire-adv-wrap');
    const count = (container as any).querySelector('.grimoire-adv-count');

    expect(body).toBe((container as any).querySelector('.grimoire-adv-body'));
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.hasClass('is-open')).toBe(false);
    expect(wrap?.hasClass('is-open')).toBe(false);
    expect(count?.textContent).toBe('12');
  });

  it('toggles persisted state when clicked', () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const setOpen = jest.fn();

    renderAdvancedSection(container, {
      count: 4,
      id: 'claude',
      isOpen: () => false,
      setOpen,
      summary: 'Safety, settings file, hidden commands, context overrides',
    });

    const toggle = (container as any).querySelector('.grimoire-adv-toggle');
    const wrap = (container as any).querySelector('.grimoire-adv-wrap');

    toggle?.click();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.hasClass('is-open')).toBe(true);
    expect(wrap?.hasClass('is-open')).toBe(true);
    expect(setOpen).toHaveBeenCalledWith('claude', true);
  });
});
