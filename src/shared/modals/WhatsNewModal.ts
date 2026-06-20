import { type App, Modal, Setting } from 'obsidian';

import type { ChangelogRelease } from '../../app/changelog/types';

export interface ShowWhatsNewModalOptions {
  app: App;
  release: ChangelogRelease;
  onDismiss?: () => void | Promise<void>;
}

export function showWhatsNewModal(options: ShowWhatsNewModalOptions): Promise<void> {
  return new Promise(resolve => {
    new WhatsNewModal(options.app, options.release, resolve, options.onDismiss).open();
  });
}

class WhatsNewModal extends Modal {
  private readonly release: ChangelogRelease;
  private readonly resolve: () => void;
  private readonly onDismiss?: () => void | Promise<void>;
  private primaryActionStarted = false;
  private resolved = false;

  constructor(
    app: App,
    release: ChangelogRelease,
    resolve: () => void,
    onDismiss?: () => void | Promise<void>,
  ) {
    super(app);
    this.release = release;
    this.resolve = resolve;
    this.onDismiss = onDismiss;
  }

  onOpen() {
    this.setTitle(`What's New in Grimoire v${this.release.version}`);
    this.modalEl.addClass('grimoire-whats-new-modal');

    this.contentEl.createEl('p', {
      cls: 'grimoire-whats-new-summary',
      text: this.release.date ? `Released ${this.release.date}` : 'Latest release notes',
    });

    const listEl = this.contentEl.createDiv({ cls: 'grimoire-whats-new-list' });
    for (const category of this.release.categories) {
      const sectionEl = listEl.createDiv({ cls: 'grimoire-whats-new-section' });
      sectionEl.createEl('h3', { text: category.title });

      const itemsEl = sectionEl.createEl('ul');
      for (const item of category.items) {
        itemsEl.createEl('li', { text: item });
      }
    }

    new Setting(this.contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Got it')
          .setCta()
          .onClick(() => this.dismiss())
      );
  }

  onClose() {
    this.complete();
    this.contentEl.empty();
  }

  private async dismiss(): Promise<void> {
    if (this.primaryActionStarted) {
      return;
    }

    this.primaryActionStarted = true;
    await this.onDismiss?.();
    this.close();
  }

  private complete(): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.resolve();
  }
}
