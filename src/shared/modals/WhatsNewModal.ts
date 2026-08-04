import { type App, Modal, Setting } from 'obsidian';

import type { ChangelogRelease } from '../../app/changelog/types';
import { t } from '../../i18n/i18n';

export interface ShowWhatsNewModalOptions {
  app: App;
  release: ChangelogRelease;
  fullChangelogUrl?: string;
  onDismiss?: () => void | Promise<void>;
  onClose?: () => void | Promise<void>;
}

export function showWhatsNewModal(options: ShowWhatsNewModalOptions): Promise<void> {
  return new Promise(resolve => {
    new WhatsNewModal(
      options.app,
      options.release,
      resolve,
      options.fullChangelogUrl,
      options.onDismiss,
      options.onClose,
    ).open();
  });
}

class WhatsNewModal extends Modal {
  private readonly release: ChangelogRelease;
  private readonly resolve: () => void;
  private readonly fullChangelogUrl?: string;
  private readonly onDismiss?: () => void | Promise<void>;
  private readonly onCloseCallback?: () => void | Promise<void>;
  private primaryActionStarted = false;
  private primaryActionFinished = false;
  private closeCallbackStarted = false;
  private resolved = false;

  constructor(
    app: App,
    release: ChangelogRelease,
    resolve: () => void,
    fullChangelogUrl?: string,
    onDismiss?: () => void | Promise<void>,
    onCloseCallback?: () => void | Promise<void>,
  ) {
    super(app);
    this.release = release;
    this.resolve = resolve;
    this.fullChangelogUrl = fullChangelogUrl;
    this.onDismiss = onDismiss;
    this.onCloseCallback = onCloseCallback;
  }

  onOpen() {
    this.setTitle(t('shared.whatsNew.title', { version: this.release.version }));
    this.modalEl.addClass('grimoire-whats-new-modal');

    this.contentEl.createEl('p', {
      cls: 'grimoire-whats-new-summary',
      text: this.release.date
        ? t('shared.whatsNew.released', { date: this.release.date })
        : t('shared.whatsNew.latestReleaseNotes'),
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

    if (this.fullChangelogUrl) {
      this.contentEl.createEl('a', {
        cls: 'grimoire-whats-new-link',
        text: t('shared.whatsNew.fullChangelog'),
        attr: {
          href: this.fullChangelogUrl,
          rel: 'noopener',
          target: '_blank',
        },
      });
    }

    new Setting(this.contentEl)
      .addButton(btn =>
        btn
          .setButtonText(t('shared.whatsNew.gotIt'))
          .setCta()
          .onClick(() => this.dismiss())
      );
  }

  onClose() {
    this.contentEl.empty();
    if (this.primaryActionStarted && !this.primaryActionFinished) {
      return;
    }
    if (this.primaryActionStarted) {
      this.complete();
      return;
    }
    void this.completeNonPrimaryClose();
  }

  private async dismiss(): Promise<void> {
    if (this.primaryActionStarted) {
      return;
    }

    this.primaryActionStarted = true;
    try {
      await this.onDismiss?.();
    } catch {
      // Dismiss persistence failure should not block closing the plugin UI.
    } finally {
      this.primaryActionFinished = true;
      this.close();
      this.complete();
    }
  }

  private complete(): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.resolve();
  }

  private async completeNonPrimaryClose(): Promise<void> {
    if (this.closeCallbackStarted) {
      return;
    }

    this.closeCallbackStarted = true;
    try {
      await this.onCloseCallback?.();
    } catch {
      // Close acknowledgement persistence failure should not block modal cleanup.
    } finally {
      this.complete();
    }
  }
}
