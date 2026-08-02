import { setIcon } from 'obsidian';

import { t } from '../../../../../i18n/i18n';

export interface FileChipsViewCallbacks {
  onRemoveAttachment: (path: string) => void;
  onOpenFile: (path: string) => void;
}

export class FileChipsView {
  private containerEl: HTMLElement;
  private callbacks: FileChipsViewCallbacks;
  private fileIndicatorEl: HTMLElement;

  constructor(containerEl: HTMLElement, callbacks: FileChipsViewCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;

    const firstChild = this.containerEl.firstChild;
    this.fileIndicatorEl = this.containerEl.createDiv({ cls: 'grimoire-file-indicator' });
    if (firstChild) {
      this.containerEl.insertBefore(this.fileIndicatorEl, firstChild);
    }
  }

  destroy(): void {
    this.fileIndicatorEl.remove();
  }

  renderCurrentNote(filePath: string | null): void {
    this.fileIndicatorEl.empty();

    if (!filePath) {
      this.fileIndicatorEl.removeClass('grimoire-visible-flex');
      this.fileIndicatorEl.addClass('grimoire-hidden');
      return;
    }

    this.fileIndicatorEl.addClass('grimoire-visible-flex');
    this.fileIndicatorEl.removeClass('grimoire-hidden');
    this.renderFileChip(filePath, () => {
      this.callbacks.onRemoveAttachment(filePath);
    });
  }

  private renderFileChip(filePath: string, onRemove: () => void): void {
    const chipEl = this.fileIndicatorEl.createDiv({ cls: 'grimoire-file-chip' });

    const iconEl = chipEl.createSpan({ cls: 'grimoire-file-chip-icon' });
    setIcon(iconEl, 'file-text');

    const normalizedPath = filePath.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || filePath;
    const nameEl = chipEl.createSpan({ cls: 'grimoire-file-chip-name' });
    nameEl.setText(filename);
    nameEl.setAttribute('title', filePath);

    const removeEl = chipEl.createSpan({ cls: 'grimoire-file-chip-remove' });
    removeEl.setText('\u00D7');
      removeEl.setAttribute('aria-label', t('common.remove'));

    chipEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.grimoire-file-chip-remove')) {
        this.callbacks.onOpenFile(filePath);
      }
    });

    removeEl.addEventListener('click', () => {
      onRemove();
    });
  }
}
