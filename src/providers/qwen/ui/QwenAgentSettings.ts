import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';
import type { QwenAgentStorage } from '../storage/QwenAgentStorage';
import { isValidQwenAgentName } from '../storage/QwenAgentStorage';
import type { QwenAgentDefinition } from '../types/agent';

export function validateQwenAgentName(name: string): string | null {
  if (!name) return t('settings.agentEditor.nameRequired');
  if (name.length > 50) return t('settings.codexSubagents.nameTooLong', { count: 50 });
  return isValidQwenAgentName(name) ? null : t('settings.codexSubagents.nameInvalid');
}

export function findQwenAgentNameConflict(
  agents: QwenAgentDefinition[], name: string, currentPersistenceKey?: string,
): QwenAgentDefinition | null {
  return agents.find((agent) => agent.name.toLowerCase() === name.toLowerCase()
    && agent.persistenceKey !== currentPersistenceKey) ?? null;
}

class QwenAgentModal extends Modal {
  constructor(
    app: App,
    private readonly existing: QwenAgentDefinition | null,
    private readonly allAgents: QwenAgentDefinition[],
    private readonly onSave: (agent: QwenAgentDefinition) => Promise<void>,
  ) { super(app); }

  onOpen(): void {
    this.setTitle(this.existing
      ? t('settings.agentEditor.modalTitleEdit', { provider: 'Qwen Code' })
      : t('settings.agentEditor.modalTitleAdd', { provider: 'Qwen Code' }));
    this.modalEl.addClass('grimoire-sp-modal');
    let nameInput!: HTMLInputElement;
    let descriptionInput!: HTMLInputElement;
    new Setting(this.contentEl).setName(t('settings.subagents.modal.name'))
      .setDesc(t('settings.codexSubagents.nameInvalid'))
      .addText((text) => { nameInput = text.inputEl; text.setValue(this.existing?.name ?? ''); });
    new Setting(this.contentEl).setName(t('settings.subagents.modal.description'))
      .setDesc(t('settings.agentEditor.descriptionDesc', { provider: 'Qwen Code' }))
      .addText((text) => { descriptionInput = text.inputEl; text.setValue(this.existing?.description ?? ''); });
    new Setting(this.contentEl).setName(t('settings.subagents.modal.prompt'))
      .setDesc(t('settings.agentEditor.promptDesc'));
    const promptInput = this.contentEl.createEl('textarea', { cls: 'grimoire-sp-content-area', attr: { rows: '10' } });
    promptInput.value = this.existing?.prompt ?? '';
    const buttons = this.contentEl.createDiv({ cls: 'grimoire-sp-modal-buttons' });
    buttons.createEl('button', { text: t('common.cancel'), cls: 'grimoire-cancel-btn' })
      .addEventListener('click', () => this.close());
    buttons.createEl('button', { text: t('common.save'), cls: 'grimoire-save-btn' })
      .addEventListener('click', () => {
        void this.save(nameInput.value, descriptionInput.value, promptInput.value).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : t('settings.agentEditor.unknownError');
          new Notice(t('settings.subagents.saveFailed', { message }));
        });
      });
  }

  private async save(rawName: string, rawDescription: string, prompt: string): Promise<void> {
    const name = rawName.trim();
    const nameError = validateQwenAgentName(name);
    if (nameError) return void new Notice(nameError);
    const description = rawDescription.trim();
    if (!description) return void new Notice(t('settings.subagents.descriptionRequired'));
    if (prompt.trim().length < 10) return void new Notice(t('settings.subagents.promptRequired'));
    if (findQwenAgentNameConflict(this.allAgents, name, this.existing?.persistenceKey)) {
      return void new Notice(t('settings.subagents.duplicateName', { name }));
    }
    await this.onSave({ name, description, prompt, persistenceKey: this.existing?.persistenceKey,
      extraFrontmatter: this.existing?.extraFrontmatter });
    this.close();
  }
}

export class QwenAgentSettings {
  private agents: QwenAgentDefinition[] = [];
  constructor(
    private readonly container: HTMLElement,
    private readonly storage: QwenAgentStorage,
    private readonly app: App,
    private readonly onChanged: () => Promise<void>,
  ) { void this.refresh(); }

  private async refresh(): Promise<void> {
    this.agents = await this.storage.loadAll();
    this.render();
  }

  private render(): void {
    this.container.empty();
    const header = this.container.createDiv({ cls: 'grimoire-sp-header' });
    header.createSpan({ text: t('settings.subagents.name'), cls: 'grimoire-sp-label' });
    const add = header.createDiv({ cls: 'grimoire-sp-header-actions' }).createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(add, 'plus');
    add.addEventListener('click', () => new QwenAgentModal(this.app, null, this.agents,
      async (agent) => { await this.storage.save(agent); await this.changed(); }).open());
    if (this.agents.length === 0) {
      this.container.createDiv({ cls: 'grimoire-sp-empty-state', text: t('settings.subagents.noAgents') });
      return;
    }
    const list = this.container.createDiv({ cls: 'grimoire-sp-list' });
    for (const agent of this.agents) {
      const row = list.createDiv({ cls: 'grimoire-sp-item' });
      const info = row.createDiv({ cls: 'grimoire-sp-info' });
      info.createDiv({ cls: 'grimoire-sp-item-name', text: agent.name });
      info.createDiv({ cls: 'grimoire-sp-item-desc', text: agent.description });
      const actions = row.createDiv({ cls: 'grimoire-sp-item-actions' });
      const edit = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(edit, 'pencil');
      edit.addEventListener('click', () => new QwenAgentModal(this.app, agent, this.agents,
        async (updated) => { await this.storage.save(updated, agent); await this.changed(); }).open());
      const remove = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn grimoire-settings-delete-btn',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(remove, 'trash-2');
      remove.addEventListener('click', () => { void this.remove(agent); });
    }
  }

  private async changed(): Promise<void> { await this.onChanged(); await this.refresh(); }
  private async remove(agent: QwenAgentDefinition): Promise<void> {
    if (await confirmDelete(this.app, t('settings.subagents.deleteConfirm', { name: agent.name }))) {
      await this.storage.delete(agent);
      await this.changed();
    }
  }
}
