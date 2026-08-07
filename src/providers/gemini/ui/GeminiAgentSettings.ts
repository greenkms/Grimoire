import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';
import type { GeminiAgentStorage } from '../storage/GeminiAgentStorage';
import { validateGeminiAgentName } from '../storage/GeminiAgentStorage';
import type { GeminiAgentDefinition } from '../types/agent';

class GeminiAgentModal extends Modal {
  constructor(
    app: App,
    private readonly existing: GeminiAgentDefinition | null,
    private readonly agents: GeminiAgentDefinition[],
    private readonly onSave: (agent: GeminiAgentDefinition) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.existing
      ? t('settings.subagents.modal.titleEdit')
      : t('settings.subagents.modal.titleAdd'));
    this.modalEl.addClass('grimoire-sp-modal');
    let nameInput!: HTMLInputElement;
    let descriptionInput!: HTMLInputElement;
    let modelInput!: HTMLInputElement;
    let toolsInput!: HTMLInputElement;
    new Setting(this.contentEl)
      .setName(t('settings.subagents.modal.name'))
      .setDesc(t('settings.subagents.modal.nameDesc'))
      .addText((text) => {
        nameInput = text.inputEl;
        text.setValue(this.existing?.name ?? '').setPlaceholder('Security-auditor');
      });
    new Setting(this.contentEl)
      .setName(t('settings.subagents.modal.description'))
      .setDesc(t('settings.subagents.modal.descriptionDesc'))
      .addText((text) => {
        descriptionInput = text.inputEl;
        text.setValue(this.existing?.description ?? '');
      });
    const details = this.contentEl.createEl('details', { cls: 'grimoire-sp-advanced-section' });
    details.createEl('summary', {
      text: t('settings.subagents.modal.advancedOptions'),
      cls: 'grimoire-sp-advanced-summary',
    });
    new Setting(details)
      .setName(t('settings.subagents.modal.model'))
      .setDesc(t('settings.subagents.modal.modelDesc'))
      .addText((text) => {
        modelInput = text.inputEl;
        text.setValue(this.existing?.model ?? '').setPlaceholder('Inherit');
      });
    new Setting(details)
      .setName(t('settings.subagents.modal.tools'))
      .setDesc(t('settings.subagents.modal.toolsDesc'))
      .addText((text) => {
        toolsInput = text.inputEl;
        text.setValue(this.existing?.tools?.join(', ') ?? '');
      });
    new Setting(this.contentEl)
      .setName(t('settings.subagents.modal.prompt'))
      .setDesc(t('settings.subagents.modal.promptDesc'));
    const promptInput = this.contentEl.createEl('textarea', {
      cls: 'grimoire-sp-content-area',
      attr: { rows: '10', placeholder: t('settings.subagents.modal.promptPlaceholder') },
    });
    promptInput.value = this.existing?.prompt ?? '';

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
        try {
          validateGeminiAgentName(name);
        } catch {
          new Notice(t('settings.agentEditor.reservedCharacters'));
          return;
        }
        const description = descriptionInput.value.trim();
        if (!description) {
          new Notice(t('settings.subagents.descriptionRequired'));
          return;
        }
        if (!promptInput.value.trim()) {
          new Notice(t('settings.subagents.promptRequired'));
          return;
        }
        if (this.agents.some((agent) => (
          agent.filePath !== this.existing?.filePath && agent.name.toLowerCase() === name.toLowerCase()
        ))) {
          new Notice(t('settings.subagents.duplicateName', { name }));
          return;
        }
        const tools = toolsInput.value.split(',').map((value) => value.trim()).filter(Boolean);
        await this.onSave({
          ...(this.existing ?? {}),
          id: name,
          name,
          description,
          prompt: promptInput.value,
          tools: tools.length > 0 ? tools : undefined,
          model: modelInput.value.trim() || undefined,
          source: 'vault',
        });
        this.close();
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : t('settings.agentEditor.unknownError');
        new Notice(t('settings.subagents.saveFailed', { message }));
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class GeminiAgentSettings {
  private agents: GeminiAgentDefinition[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly storage: GeminiAgentStorage,
    private readonly app: App,
    private readonly onChanged?: () => Promise<void> | void,
  ) {
    void this.loadAndRender();
  }

  async loadAndRender(): Promise<void> {
    this.agents = await this.storage.loadAll();
    this.render();
  }

  private render(): void {
    this.container.empty();
    const header = this.container.createDiv({ cls: 'grimoire-sp-header' });
    header.createSpan({ text: t('settings.subagents.name'), cls: 'grimoire-sp-label' });
    const addButton = header.createDiv({ cls: 'grimoire-sp-header-actions' }).createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(addButton, 'plus');
    addButton.addEventListener('click', () => this.openModal(null));
    if (this.agents.length === 0) {
      this.container.createDiv({ cls: 'grimoire-sp-empty-state', text: t('settings.subagents.noAgents') });
      return;
    }
    const list = this.container.createDiv({ cls: 'grimoire-sp-list' });
    for (const agent of this.agents) {
      const item = list.createDiv({ cls: 'grimoire-sp-item' });
      const info = item.createDiv({ cls: 'grimoire-sp-info' });
      info.createDiv({ cls: 'grimoire-sp-item-name', text: agent.name });
      info.createDiv({ cls: 'grimoire-sp-item-desc', text: agent.description });
      const actions = item.createDiv({ cls: 'grimoire-sp-item-actions' });
      const editButton = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(editButton, 'pencil');
      editButton.addEventListener('click', () => this.openModal(agent));
      const deleteButton = actions.createEl('button', {
        cls: 'grimoire-settings-action-btn grimoire-settings-delete-btn',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(deleteButton, 'trash-2');
      deleteButton.addEventListener('click', () => {
        void this.deleteAgent(agent);
      });
    }
  }

  private openModal(existing: GeminiAgentDefinition | null): void {
    new GeminiAgentModal(this.app, existing, this.agents, async (agent) => {
      await this.storage.save(agent, existing);
      await this.loadAndRender();
      await this.onChanged?.();
    }).open();
  }

  private async deleteAgent(agent: GeminiAgentDefinition): Promise<void> {
    if (!(await confirmDelete(this.app, t('settings.subagents.deleteConfirm', { name: agent.name })))) return;
    try {
      await this.storage.delete(agent);
      await this.loadAndRender();
      await this.onChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.agentEditor.unknownError');
      new Notice(t('settings.subagents.deleteFailed', { message }));
    }
  }
}
