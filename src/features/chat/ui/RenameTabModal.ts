import { type App, Modal, setIcon, setTooltip } from 'obsidian';

import { t } from '../../../i18n/i18n';
import { MAX_TAB_TITLE_LENGTH } from '../tabs/types';

export function requestTabRename(app: App, currentTitle: string): Promise<string | null> {
  return new Promise((resolve) => {
    new RenameTabModal(app, currentTitle, resolve).open();
  });
}

class RenameTabModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly currentTitle: string,
    private readonly resolveResult: (title: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('grimoire-rename-tab-modal');
    this.setTitle(t('chat.ui.tabs.renameTitle'));

    const form = this.contentEl.createEl('form', { cls: 'grimoire-rename-tab-form' });
    const inputId = 'grimoire-rename-tab-input';
    form.createEl('label', {
      cls: 'grimoire-rename-tab-label',
      text: t('chat.ui.tabs.name'),
      attr: { for: inputId },
    });
    const field = form.createDiv({ cls: 'grimoire-rename-tab-field' });
    const input = field.createEl('input', {
      cls: 'grimoire-rename-tab-input',
      attr: {
        type: 'text',
        id: inputId,
        maxlength: String(MAX_TAB_TITLE_LENGTH),
        autocomplete: 'off',
        spellcheck: 'false',
      },
    });
    input.value = this.currentTitle.slice(0, MAX_TAB_TITLE_LENGTH);

    const resetButton = field.createEl('button', {
      cls: 'grimoire-rename-tab-reset',
      attr: {
        type: 'button',
        'aria-label': t('chat.ui.tabs.resetName'),
      },
    });
    setIcon(resetButton, 'rotate-ccw');
    setTooltip(resetButton, t('chat.ui.tabs.resetName'), { placement: 'top' });

    const footer = form.createDiv({ cls: 'grimoire-rename-tab-footer' });
    const counter = footer.createDiv({ cls: 'grimoire-rename-tab-counter' });
    const actions = footer.createDiv({ cls: 'grimoire-rename-tab-actions' });
    const cancelButton = actions.createEl('button', {
      cls: 'grimoire-rename-tab-cancel',
      text: t('common.cancel'),
      attr: { type: 'button' },
    });
    const saveButton = actions.createEl('button', {
      cls: 'grimoire-rename-tab-save mod-cta',
      text: t('common.save'),
      attr: { type: 'submit' },
    });

    const updateState = () => {
      const remaining = Math.max(0, MAX_TAB_TITLE_LENGTH - input.value.length);
      counter.setText(t('chat.ui.tabs.charactersLeft', { count: remaining }));
      saveButton.disabled = input.value.trim().length === 0;
    };
    const restoreCurrentTitle = () => {
      input.value = this.currentTitle.slice(0, MAX_TAB_TITLE_LENGTH);
      updateState();
      input.focus();
      input.select();
    };

    input.addEventListener('input', updateState);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
    resetButton.addEventListener('click', restoreCurrentTitle);
    cancelButton.addEventListener('click', () => this.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!saveButton.disabled) this.submit(input.value);
    });

    updateState();
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  private submit(title: string): void {
    this.resolved = true;
    this.resolveResult(title.trim());
    this.close();
  }

  onClose(): void {
    if (!this.resolved) this.resolveResult(null);
    this.contentEl.empty();
  }
}
