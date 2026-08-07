import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';
import { validateGeminiCommandName } from '../commands/GeminiCommandCatalog';

class GeminiCommandModal extends Modal {
  constructor(
    app: App,
    private readonly existing: ProviderCommandEntry | null,
    private readonly entries: ProviderCommandEntry[],
    private readonly onSave: (entry: ProviderCommandEntry) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const commandLabel = t('settings.slashCommandEditor.command');
    this.setTitle(this.existing
      ? t('settings.slashCommandEditor.titleEdit', { type: commandLabel })
      : t('settings.slashCommandEditor.titleAdd', { type: commandLabel }));
    this.modalEl.addClass('grimoire-sp-modal');

    let nameInput!: HTMLInputElement;
    let descriptionInput!: HTMLInputElement;
    new Setting(this.contentEl)
      .setName(t('settings.slashCommandEditor.name'))
      .setDesc(t('settings.slashCommandEditor.nameDesc'))
      .addText((text) => {
        nameInput = text.inputEl;
        text.setValue(this.existing?.name ?? '').setPlaceholder('Review:security');
      });
    new Setting(this.contentEl)
      .setName(t('settings.subagents.modal.description'))
      .setDesc(t('settings.slashCommandEditor.descriptionDesc'))
      .addText((text) => {
        descriptionInput = text.inputEl;
        text.setValue(this.existing?.description ?? '');
      });
    new Setting(this.contentEl)
      .setName(t('settings.slashCommandEditor.promptTemplate'))
      .setDesc(t('settings.slashCommandEditor.promptTemplateDesc'));
    const promptInput = this.contentEl.createEl('textarea', {
      cls: 'grimoire-sp-content-area',
      attr: { rows: '10', placeholder: t('settings.slashCommandEditor.promptTemplatePlaceholder') },
    });
    promptInput.value = this.existing?.content ?? '';

    const buttons = this.contentEl.createDiv({ cls: 'grimoire-sp-modal-buttons' });
    buttons.createEl('button', {
      text: t('common.cancel'),
      cls: 'grimoire-cancel-btn',
    }).addEventListener('click', () => this.close());
    buttons.createEl('button', {
      text: t('common.save'),
      cls: 'grimoire-save-btn',
    }).addEventListener('click', () => {
      void (async (): Promise<void> => {
        const name = nameInput.value.trim();
        const validationError = validateGeminiCommandName(name);
        if (validationError) {
          new Notice(t('settings.agentEditor.reservedCharacters'));
          return;
        }
        if (!promptInput.value.trim()) {
          new Notice(t('settings.slashCommandEditor.promptRequired'));
          return;
        }
        if (this.entries.some((entry) => (
          entry.id !== this.existing?.id && entry.name.toLowerCase() === name.toLowerCase()
        ))) {
          new Notice(t('settings.slashCommandEditor.commandExists', { name }));
          return;
        }
        await this.onSave({
          id: this.existing?.id ?? `gemini-command:${name}`,
          providerId: 'gemini',
          kind: 'command',
          name,
          description: descriptionInput.value.trim() || undefined,
          content: promptInput.value,
          scope: 'vault',
          source: 'user',
          isEditable: true,
          isDeletable: true,
          displayPrefix: '/',
          insertPrefix: '/',
          persistenceKey: this.existing?.persistenceKey,
        });
        this.close();
      })().catch(() => new Notice(t('settings.slashCommandEditor.saveCommandFailed')));
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class GeminiCommandSettings {
  private entries: ProviderCommandEntry[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly app: App,
    private readonly catalog: ProviderCommandCatalog,
  ) {
    void this.loadAndRender();
  }

  async loadAndRender(): Promise<void> {
    try {
      this.entries = (await this.catalog.listVaultEntries())
        .filter((entry) => entry.kind === 'command');
    } catch {
      this.entries = [];
    }
    this.render();
  }

  private render(): void {
    this.container.empty();
    const header = this.container.createDiv({ cls: 'grimoire-sp-header' });
    header.createSpan({ text: t('settings.slashCommands.name'), cls: 'grimoire-sp-label' });
    const addButton = header.createDiv({ cls: 'grimoire-sp-header-actions' }).createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(addButton, 'plus');
    addButton.addEventListener('click', () => this.openModal(null));
    if (this.entries.length === 0) {
      this.container.createDiv({
        cls: 'grimoire-sp-empty-state',
        text: t('settings.slashCommandEditor.noEntries'),
      });
      return;
    }
    const list = this.container.createDiv({ cls: 'grimoire-sp-list' });
    for (const entry of this.entries) {
      const item = list.createDiv({ cls: 'grimoire-sp-item' });
      const info = item.createDiv({ cls: 'grimoire-sp-info' });
      info.createDiv({ cls: 'grimoire-sp-item-name', text: `/${entry.name}` });
      if (entry.description) info.createDiv({ cls: 'grimoire-sp-item-desc', text: entry.description });
      const actions = item.createDiv({ cls: 'grimoire-sp-item-actions' });
      const editButton = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(editButton, 'pencil');
      editButton.addEventListener('click', () => this.openModal(entry));
      const deleteButton = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn grimoire-settings-delete-btn',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(deleteButton, 'trash-2');
      deleteButton.addEventListener('click', () => {
        void this.deleteEntry(entry);
      });
    }
  }

  private openModal(existing: ProviderCommandEntry | null): void {
    new GeminiCommandModal(this.app, existing, this.entries, async (entry) => {
      await this.catalog.saveVaultEntry(entry);
      await this.loadAndRender();
    }).open();
  }

  private async deleteEntry(entry: ProviderCommandEntry): Promise<void> {
    if (!(await confirmDelete(this.app, t('settings.hub.deleteConfirm', { name: entry.name })))) return;
    try {
      await this.catalog.deleteVaultEntry(entry);
      await this.loadAndRender();
    } catch {
      new Notice(t('settings.slashCommandEditor.deleteCommandFailed'));
    }
  }
}
