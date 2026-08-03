import { createMockEl, type MockElement } from '@test/helpers/mockElement';

import type { ChangelogRelease } from '@/app/changelog/types';
import { renderWhatsNewCard } from '@/shared/whats-new/renderWhatsNewCard';

function collectText(el: MockElement): string {
  return [
    el.textContent,
    ...el.children.map(child => collectText(child)),
  ].filter(Boolean).join(' ');
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('renderWhatsNewCard', () => {
  const release: ChangelogRelease = {
    version: '1.0.0',
    date: '2026-06-21',
    categories: [
      { title: 'Added', items: ['Inline release card.'] },
      { title: 'Fixed', items: ['Small fix.'] },
    ],
  };

  it('renders release notes and acknowledges dismissal', async () => {
    const container = createMockEl('div') as MockElement;
    const onDismiss = jest.fn().mockResolvedValue(undefined);

    renderWhatsNewCard(container as unknown as HTMLElement, {
      release,
      onDismiss,
      fullChangelogUrl: 'https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md',
    });

    expect(collectText(container)).toContain('What\'s New in Grimoire v1.0.0');
    expect(collectText(container)).toContain('Released 2026-06-21');
    expect(collectText(container)).toContain('Inline release card.');
    expect(collectText(container)).toContain('Small fix.');
    const link = container.querySelector('.grimoire-whats-new-card-link');
    expect(link?.textContent).toBe('Full changelog');
    expect(link?.getAttribute('href')).toBe('https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md');
    expect(link?.getAttribute('target')).toBe('_blank');

    const list = container.querySelector('.grimoire-whats-new-card-list');
    expect(list?.getAttribute('role')).toBe('region');
    expect(list?.getAttribute('tabindex')).toBe('0');
    expect(list?.getAttribute('aria-label')).toBe('Release notes');

    const dismissButton = container.querySelector('.grimoire-whats-new-card-dismiss');
    dismissButton?.click();
    await flushPromises();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.grimoire-whats-new-card')).toBeNull();
  });

  it('does not render when a card is already present', () => {
    const container = createMockEl('div') as MockElement;

    renderWhatsNewCard(container as unknown as HTMLElement, {
      release,
      onDismiss: jest.fn(),
    });
    renderWhatsNewCard(container as unknown as HTMLElement, {
      release,
      onDismiss: jest.fn(),
    });

    expect(container.querySelectorAll('.grimoire-whats-new-card')).toHaveLength(1);
  });
});
