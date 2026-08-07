import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';

const INVALID_SEGMENT = /[<>:"\\|?*/]/;

function validName(name: string): boolean {
  return name.split(':').every((part) => (
    part && part === part.trim() && part !== '.' && part !== '..' && !INVALID_SEGMENT.test(part)
  ));
}

class QwenCommandModal extends Modal {
  constructor(
    app: App,
    private readonly existing: ProviderCommandEntry | null,
    private readonly entries: ProviderCommandEntry[],
    private readonly save: (entry: ProviderCommandEntry) => Promise<void>,
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
    const content = this.contentEl.createEl('textarea', {
      cls: 'grimoire-sp-content-area',
      attr: { rows: '10', placeholder: t('settings.slashCommandEditor.promptTemplatePlaceholder') },
    });
    content.value = this.existing?.content ?? '';
    const buttons = this.contentEl.createDiv({ cls: 'grimoire-sp-modal-buttons' });
    buttons.createEl('button', {
      text: t('common.cancel'),
      cls: 'grimoire-cancel-btn',
    }).addEventListener('click', () => this.close());
    buttons.createEl('button', {
      text: t('common.save'),
      cls: 'grimoire-save-btn',
    }).addEventListener('click', () => {
      void this.persist(nameInput.value.trim(), descriptionInput.value.trim(), content.value);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async persist(name: string, description: string, content: string): Promise<void> {
    if (!validName(name)) {
      new Notice(t('settings.agentEditor.reservedCharacters'));
      return;
    }
    if (!content.trim()) {
      new Notice(t('settings.slashCommandEditor.promptRequired'));
      return;
    }
    if (this.entries.some((entry) => (
      entry.name.toLowerCase() === name.toLowerCase()
      && entry.persistenceKey !== this.existing?.persistenceKey
    ))) {
      new Notice(t('settings.slashCommandEditor.commandExists', { name }));
      return;
    }
    try {
      await this.save({
        id: this.existing?.id ?? `qwen-command:${name}`,
        providerId: 'qwen',
        kind: 'command',
        name,
        description: description || undefined,
        content,
        scope: 'vault',
        source: 'user',
        isEditable: true,
        isDeletable: true,
        displayPrefix: '/',
        insertPrefix: '/',
        persistenceKey: this.existing?.persistenceKey,
      });
      this.close();
    } catch {
      new Notice(t('settings.slashCommandEditor.saveCommandFailed'));
    }
  }
}

export class QwenCommandSettings {
  private entries: ProviderCommandEntry[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly app: App,
    private readonly catalog: ProviderCommandCatalog,
    private readonly onChanged: () => Promise<void>,
  ) {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    this.entries = (await this.catalog.listVaultEntries()).filter((entry) => entry.kind === 'command');
    this.render();
  }

  private render(): void {
    this.container.empty();
    const header = this.container.createDiv({ cls: 'grimoire-sp-header' });
    header.createSpan({ text: t('settings.slashCommands.name'), cls: 'grimoire-sp-label' });
    const add = header.createDiv({ cls: 'grimoire-sp-header-actions' }).createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(add, 'plus');
    add.addEventListener('click', () => this.openModal(null));
    if (this.entries.length === 0) {
      this.container.createDiv({
        cls: 'grimoire-sp-empty-state',
        text: t('settings.slashCommandEditor.noEntries'),
      });
      return;
    }
    const list = this.container.createDiv({ cls: 'grimoire-sp-list' });
    for (const entry of this.entries) {
      const row = list.createDiv({ cls: 'grimoire-sp-item' });
      const info = row.createDiv({ cls: 'grimoire-sp-info' });
      info.createDiv({ cls: 'grimoire-sp-item-name', text: `/${entry.name}` });
      if (entry.description) info.createDiv({ cls: 'grimoire-sp-item-desc', text: entry.description });
      const actions = row.createDiv({ cls: 'grimoire-sp-item-actions' });
      const edit = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(edit, 'pencil');
      edit.addEventListener('click', () => this.openModal(entry));
      const remove = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn grimoire-settings-delete-btn',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(remove, 'trash-2');
      remove.addEventListener('click', () => { void this.remove(entry); });
    }
  }

  private openModal(existing: ProviderCommandEntry | null): void {
    new QwenCommandModal(this.app, existing, this.entries, async (entry) => {
      await this.catalog.saveVaultEntry(entry);
      await this.onChanged();
      await this.refresh();
    }).open();
  }

  private async remove(entry: ProviderCommandEntry): Promise<void> {
    if (!(await confirmDelete(this.app, t('settings.hub.deleteConfirm', { name: entry.name })))) return;
    try {
      await this.catalog.deleteVaultEntry(entry);
      await this.onChanged();
      await this.refresh();
    } catch {
      new Notice(t('settings.slashCommandEditor.deleteCommandFailed'));
    }
  }
}
