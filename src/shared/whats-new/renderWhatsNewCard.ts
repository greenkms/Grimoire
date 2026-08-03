import type { ChangelogRelease } from '../../app/changelog/types';

export interface RenderWhatsNewCardOptions {
  release: ChangelogRelease;
  onDismiss: () => void | Promise<void>;
  fullChangelogUrl?: string;
}

export function renderWhatsNewCard(
  containerEl: HTMLElement,
  options: RenderWhatsNewCardOptions,
): void {
  if (containerEl.querySelector('.grimoire-whats-new-card')) {
    return;
  }

  const { release, onDismiss, fullChangelogUrl } = options;
  const cardEl = containerEl.createDiv({ cls: 'grimoire-whats-new-card' });
  const headerEl = cardEl.createDiv({ cls: 'grimoire-whats-new-card-header' });
  const titleBlockEl = headerEl.createDiv({ cls: 'grimoire-whats-new-card-title-block' });
  titleBlockEl.createDiv({
    cls: 'grimoire-whats-new-card-title',
    text: `What's New in Grimoire v${release.version}`,
  });
  titleBlockEl.createDiv({
    cls: 'grimoire-whats-new-card-summary',
    text: release.date ? `Released ${release.date}` : 'Latest release notes',
  });

  if (fullChangelogUrl) {
    headerEl.createEl('a', {
      cls: 'grimoire-whats-new-card-link',
      text: 'Full changelog',
      attr: {
        href: fullChangelogUrl,
        rel: 'noopener',
        target: '_blank',
      },
    });
  }

  const dismissButton = headerEl.createEl('button', {
    cls: 'grimoire-whats-new-card-dismiss',
    text: 'Got it',
    attr: {
      type: 'button',
      'aria-label': 'Dismiss release notes',
    },
  });

  const listEl = cardEl.createDiv({
    cls: 'grimoire-whats-new-card-list',
    attr: {
      role: 'region',
      tabindex: '0',
      'aria-label': 'Release notes',
    },
  });
  for (const category of release.categories) {
    const sectionEl = listEl.createDiv({ cls: 'grimoire-whats-new-card-section' });
    sectionEl.createDiv({ cls: 'grimoire-whats-new-card-section-title', text: category.title });
    const itemsEl = sectionEl.createEl('ul', { cls: 'grimoire-whats-new-card-items' });
    for (const item of category.items) {
      itemsEl.createEl('li', { cls: 'grimoire-whats-new-card-item', text: item });
    }
  }

  let dismissing = false;
  dismissButton.addEventListener('click', () => {
    if (dismissing) {
      return;
    }
    dismissing = true;
    void Promise.resolve(onDismiss())
      .catch(() => undefined)
      .finally(() => {
        containerEl.empty();
      });
  });
}
