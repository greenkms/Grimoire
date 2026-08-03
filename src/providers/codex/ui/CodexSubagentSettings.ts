import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';
import type { CodexSubagentStorage } from '../storage/CodexSubagentStorage';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../types/models';
import type { CodexSubagentDefinition } from '../types/subagent';

const REASONING_EFFORT_OPTIONS = [
  { value: '', labelKey: 'settings.codexSubagents.options.inherit' },
  { value: 'low', labelKey: 'settings.codexSubagents.options.low' },
  { value: 'medium', labelKey: 'settings.codexSubagents.options.medium' },
  { value: 'high', labelKey: 'settings.codexSubagents.options.high' },
  { value: 'xhigh', labelKey: 'settings.codexSubagents.options.extraHigh' },
] as const;

const SANDBOX_MODE_OPTIONS = [
  { value: '', labelKey: 'settings.codexSubagents.options.inherit' },
  { value: 'read-only', labelKey: 'settings.codexSubagents.options.readOnly' },
  { value: 'danger-full-access', labelKey: 'settings.codexSubagents.options.dangerFullAccess' },
  { value: 'workspace-write', labelKey: 'settings.codexSubagents.options.workspaceWrite' },
] as const;

const MAX_NAME_LENGTH = 64;
const CODEX_AGENT_NAME_PATTERN = /^[a-z0-9_-]+$/;
const CODEX_NICKNAME_PATTERN = /^[A-Za-z0-9 _-]+$/;

export function validateCodexSubagentName(name: string): string | null {
  if (!name) return t('settings.codexSubagents.nameRequired');
  if (name.length > MAX_NAME_LENGTH) return t('settings.codexSubagents.nameTooLong', { count: MAX_NAME_LENGTH });
  if (!CODEX_AGENT_NAME_PATTERN.test(name)) return t('settings.codexSubagents.nameInvalid');
  return null;
}

export function validateCodexNicknameCandidates(candidates: string[]): string | null {
  const normalized = candidates.map(candidate => candidate.trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  const seen = new Set<string>();
  for (const candidate of normalized) {
    if (!CODEX_NICKNAME_PATTERN.test(candidate)) {
      return t('settings.codexSubagents.nicknamesInvalid');
    }

    const dedupeKey = candidate.toLowerCase();
    if (seen.has(dedupeKey)) {
      return t('settings.codexSubagents.nicknamesUnique');
    }
    seen.add(dedupeKey);
  }

  return null;
}

class CodexSubagentModal extends Modal {
  private existing: CodexSubagentDefinition | null;
  private allAgents: CodexSubagentDefinition[];
  private onSave: (agent: CodexSubagentDefinition) => Promise<void>;

  private _nameInput!: HTMLInputElement;
  private _descInput!: HTMLInputElement;
  private _instructionsArea!: HTMLTextAreaElement;
  private _nicknamesInput!: HTMLInputElement;
  private _modelInput!: HTMLInputElement;
  private _reasoningEffort = '';
  private _sandboxMode = '';
  private _triggerSave!: () => Promise<void>;

  constructor(
    app: App,
    existing: CodexSubagentDefinition | null,
    allAgents: CodexSubagentDefinition[],
    onSave: (agent: CodexSubagentDefinition) => Promise<void>,
  ) {
    super(app);
    this.existing = existing;
    this.allAgents = allAgents;
    this.onSave = onSave;
    this._reasoningEffort = existing?.modelReasoningEffort ?? '';
    this._sandboxMode = existing?.sandboxMode ?? '';
  }

  getTestInputs() {
    return {
      nameInput: this._nameInput,
      descInput: this._descInput,
      instructionsArea: this._instructionsArea,
      nicknamesInput: this._nicknamesInput,
      modelInput: this._modelInput,
      setReasoningEffort: (v: string) => { this._reasoningEffort = v; },
      setSandboxMode: (v: string) => { this._sandboxMode = v; },
      triggerSave: this._triggerSave,
    };
  }

  onOpen() {
    this.setTitle(this.existing ? t('settings.codexSubagents.titleEdit') : t('settings.codexSubagents.titleAdd'));
    this.modalEl.addClass('grimoire-sp-modal');

    const { contentEl } = this;

    new Setting(contentEl)
      .setName(t('settings.subagents.modal.name'))
      .setDesc(t('settings.codexSubagents.nameDesc'))
      .addText(text => {
        this._nameInput = text.inputEl;
        text.setValue(this.existing?.name ?? '')
          .setPlaceholder('Code_reviewer');
      });

    new Setting(contentEl)
      .setName(t('settings.subagents.modal.description'))
      .setDesc(t('settings.codexSubagents.descriptionDesc'))
      .addText(text => {
        this._descInput = text.inputEl;
        text.setValue(this.existing?.description ?? '')
          .setPlaceholder('Reviews code for correctness and security');
      });

    // Advanced options
    const details = contentEl.createEl('details', { cls: 'grimoire-sp-advanced-section' });
    details.createEl('summary', {
      text: t('settings.subagents.modal.advancedOptions'),
      cls: 'grimoire-sp-advanced-summary',
    });
    if (
      this.existing?.model ||
      this.existing?.modelReasoningEffort ||
      this.existing?.sandboxMode ||
      this.existing?.nicknameCandidates?.length
    ) {
      details.open = true;
    }

    new Setting(details)
      .setName(t('settings.subagents.modal.model'))
      .setDesc(t('settings.codexSubagents.modelDesc'))
      .addText(text => {
        this._modelInput = text.inputEl;
        text.setValue(this.existing?.model ?? '')
          .setPlaceholder(DEFAULT_CODEX_PRIMARY_MODEL);
      });

    new Setting(details)
      .setName(t('settings.codexSubagents.reasoningEffort'))
      .setDesc(t('settings.codexSubagents.reasoningEffortDesc'))
      .addDropdown(dropdown => {
        for (const opt of REASONING_EFFORT_OPTIONS) {
          dropdown.addOption(opt.value, t(opt.labelKey));
        }
        dropdown.setValue(this._reasoningEffort);
        dropdown.onChange(v => { this._reasoningEffort = v; });
      });

    new Setting(details)
      .setName(t('settings.codexSubagents.sandboxMode'))
      .setDesc(t('settings.codexSubagents.sandboxModeDesc'))
      .addDropdown(dropdown => {
        for (const opt of SANDBOX_MODE_OPTIONS) {
          dropdown.addOption(opt.value, t(opt.labelKey));
        }
        dropdown.setValue(this._sandboxMode);
        dropdown.onChange(v => { this._sandboxMode = v; });
      });

    new Setting(details)
      .setName(t('settings.codexSubagents.nicknameCandidates'))
      .setDesc(t('settings.codexSubagents.nicknameCandidatesDesc'))
      .addText(text => {
        this._nicknamesInput = text.inputEl;
        text.setValue(this.existing?.nicknameCandidates?.join(', ') ?? '');
      });

    // Developer instructions
    new Setting(contentEl)
      .setName(t('settings.codexSubagents.developerInstructions'))
      .setDesc(t('settings.codexSubagents.developerInstructionsDesc'));

    const instructionsArea = contentEl.createEl('textarea', {
      cls: 'grimoire-sp-content-area',
      attr: {
        rows: '10',
        placeholder: t('settings.codexSubagents.developerInstructionsPlaceholder'),
      },
    });
    instructionsArea.value = this.existing?.developerInstructions ?? '';
    this._instructionsArea = instructionsArea;

    // Buttons
    const doSave = async () => {
      const name = this._nameInput.value.trim();
      const nameError = validateCodexSubagentName(name);
      if (nameError) {
        new Notice(nameError);
        return;
      }

      const description = this._descInput.value.trim();
      if (!description) {
        new Notice(t('settings.subagents.descriptionRequired'));
        return;
      }

      const developerInstructions = this._instructionsArea.value;
      if (!developerInstructions.trim()) {
        new Notice(t('settings.codexSubagents.developerInstructionsRequired'));
        return;
      }

      const nicknameCandidates = this._nicknamesInput.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const nicknameError = validateCodexNicknameCandidates(nicknameCandidates);
      if (nicknameError) {
        new Notice(nicknameError);
        return;
      }

      const duplicate = this.allAgents.find(
        a => a.name.toLowerCase() === name.toLowerCase() &&
             a.persistenceKey !== this.existing?.persistenceKey,
      );
      if (duplicate) {
        new Notice(t('settings.subagents.duplicateName', { name }));
        return;
      }

      const agent: CodexSubagentDefinition = {
        name,
        description,
        developerInstructions,
        nicknameCandidates: nicknameCandidates.length > 0 ? nicknameCandidates : undefined,
        model: this._modelInput.value.trim() || undefined,
        modelReasoningEffort: this._reasoningEffort || undefined,
        sandboxMode: this._sandboxMode || undefined,
        persistenceKey: this.existing?.persistenceKey,
        extraFields: this.existing?.extraFields,
      };

      try {
        await this.onSave(agent);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('settings.agentEditor.unknownError');
        new Notice(t('settings.subagents.saveFailed', { message }));
        return;
      }
      this.close();
    };
    this._triggerSave = doSave;

    const buttonContainer = contentEl.createDiv({ cls: 'grimoire-sp-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: t('common.cancel'),
      cls: 'grimoire-cancel-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: t('common.save'),
      cls: 'grimoire-save-btn',
    });
    saveBtn.addEventListener('click', () => {
      void doSave();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class CodexSubagentSettings {
  private containerEl: HTMLElement;
  private storage: CodexSubagentStorage;
  private agents: CodexSubagentDefinition[] = [];
  private app?: App;
  private onChanged?: () => void;

  constructor(containerEl: HTMLElement, storage: CodexSubagentStorage, app?: App, onChanged?: () => void) {
    this.containerEl = containerEl;
    this.storage = storage;
    this.app = app;
    this.onChanged = onChanged;
    void this.render();
  }

  async render(): Promise<void> {
    this.containerEl.empty();

    try {
      this.agents = await this.storage.loadAll();
    } catch {
      this.agents = [];
    }

    const headerEl = this.containerEl.createDiv({ cls: 'grimoire-sp-header' });
    headerEl.createSpan({ text: t('settings.codexSubagents.title'), cls: 'grimoire-sp-label' });

    const actionsEl = headerEl.createDiv({ cls: 'grimoire-sp-header-actions' });

    const refreshBtn = actionsEl.createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.refresh') },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => { void this.render(); });

    const addBtn = actionsEl.createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.openModal(null));

    if (this.agents.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'grimoire-sp-empty-state' });
      emptyEl.setText(t('settings.codexSubagents.noAgents'));
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'grimoire-sp-list' });
    for (const agent of this.agents) {
      this.renderItem(listEl, agent);
    }
  }

  private renderItem(listEl: HTMLElement, agent: CodexSubagentDefinition): void {
    const itemEl = listEl.createDiv({ cls: 'grimoire-sp-item' });
    const infoEl = itemEl.createDiv({ cls: 'grimoire-sp-info' });

    const headerRow = infoEl.createDiv({ cls: 'grimoire-sp-item-header' });
    const nameEl = headerRow.createSpan({ cls: 'grimoire-sp-item-name' });
    nameEl.setText(agent.name);

    if (agent.model) {
      headerRow.createSpan({ text: agent.model, cls: 'grimoire-slash-item-badge' });
    }

    if (agent.description) {
      const descEl = infoEl.createDiv({ cls: 'grimoire-sp-item-desc' });
      descEl.setText(agent.description);
    }

    const actionsEl = itemEl.createDiv({ cls: 'grimoire-sp-item-actions' });

    const editBtn = actionsEl.createEl('button', {
      cls: 'grimoire-settings-action-btn',
      attr: { 'aria-label': t('common.edit') },
    });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => this.openModal(agent));

    const deleteBtn = actionsEl.createEl('button', {
      cls: 'grimoire-settings-action-btn grimoire-settings-delete-btn',
      attr: { 'aria-label': t('common.delete') },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', () => {
      void (async (): Promise<void> => {
      if (!this.app) return;
      const confirmed = await confirmDelete(
        this.app,
        t('settings.subagents.deleteConfirm', { name: agent.name }),
      );
      if (!confirmed) return;
      try {
        await this.storage.delete(agent);
        await this.render();
        this.onChanged?.();
        new Notice(t('settings.subagents.deleted', { name: agent.name }));
      } catch {
        new Notice(t('settings.codexSubagents.deleteFailed'));
      }
      })();
    });
  }

  private openModal(existing: CodexSubagentDefinition | null): void {
    if (!this.app) return;

    const modal = new CodexSubagentModal(
      this.app,
      existing,
      this.agents,
      async (agent) => {
        await this.storage.save(agent, existing);
        await this.render();
        this.onChanged?.();
        new Notice(
          existing
            ? t('settings.subagents.updated', { name: agent.name })
            : t('settings.subagents.created', { name: agent.name }),
        );
      },
    );
    modal.open();
  }
}
