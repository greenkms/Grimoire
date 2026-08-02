import type { App } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import { t } from '../../../i18n/i18n';
import { confirmDelete } from '../../../shared/modals/ConfirmModal';
import type { KimicodeAgentStorage } from '../storage/KimicodeAgentStorage';
import type { KimicodeAgentDefinition } from '../types/agent';

const KIMICODE_AGENT_INVALID_SEGMENT_PATTERN = /[<>:"\\|?*]/;

export function validateKimicodeAgentName(name: string): string | null {
  if (!name) return t('settings.agentEditor.nameRequired');

  const segments = name.split('/');
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return t('settings.agentEditor.pathSegmentsRequired');
  }

  for (const segment of segments) {
    if (!segment.trim()) {
      return t('settings.agentEditor.segmentEmpty');
    }

    if (segment !== segment.trim()) {
      return t('settings.agentEditor.segmentWhitespace');
    }

    if (segment === '.' || segment === '..') {
      return t('settings.agentEditor.dotSegments');
    }

    if (segment.includes('\0') || KIMICODE_AGENT_INVALID_SEGMENT_PATTERN.test(segment)) {
      return t('settings.agentEditor.reservedCharacters');
    }
  }

  return null;
}

export function findKimicodeAgentNameConflict(
  agents: KimicodeAgentDefinition[],
  name: string,
  currentPersistenceKey?: string,
): KimicodeAgentDefinition | null {
  const normalizedName = name.toLowerCase();
  return agents.find(
    (agent) => agent.name.toLowerCase() === normalizedName
      && agent.persistenceKey !== currentPersistenceKey,
  ) ?? null;
}

class KimicodeAgentModal extends Modal {
  private existing: KimicodeAgentDefinition | null;
  private allAgents: KimicodeAgentDefinition[];
  private onSave: (agent: KimicodeAgentDefinition) => Promise<void>;

  constructor(
    app: App,
    existing: KimicodeAgentDefinition | null,
    allAgents: KimicodeAgentDefinition[],
    onSave: (agent: KimicodeAgentDefinition) => Promise<void>,
  ) {
    super(app);
    this.existing = existing;
    this.allAgents = allAgents;
    this.onSave = onSave;
  }

  onOpen() {
    this.setTitle(this.existing
      ? t('settings.agentEditor.modalTitleEdit', { provider: 'Kimi Code' })
      : t('settings.agentEditor.modalTitleAdd', { provider: 'Kimi Code' }));
    this.modalEl.addClass('grimoire-sp-modal');

    const { contentEl } = this;

    let nameInput!: HTMLInputElement;
    let descriptionInput!: HTMLInputElement;
    let modelInput!: HTMLInputElement;
    let variantInput!: HTMLInputElement;
    let temperatureInput!: HTMLInputElement;
    let topPInput!: HTMLInputElement;
    let colorInput!: HTMLInputElement;
    let stepsInput!: HTMLInputElement;
    let hiddenValue = this.existing?.hidden ?? false;
    let disableValue = this.existing?.disable ?? false;
    let toolsInput!: HTMLTextAreaElement;
    let permissionInput!: HTMLTextAreaElement;
    let optionsInput!: HTMLTextAreaElement;

    new Setting(contentEl)
      .setName(t('settings.subagents.modal.name'))
      .setDesc(t('settings.agentEditor.nameDesc', { provider: 'Kimi Code' }))
      .addText((text) => {
        nameInput = text.inputEl;
        text.setValue(this.existing?.name ?? '')
          .setPlaceholder(t('settings.agentEditor.namePlaceholder'));
      });

    new Setting(contentEl)
      .setName(t('settings.subagents.modal.description'))
      .setDesc(t('settings.agentEditor.descriptionDesc', { provider: 'Kimi Code' }))
      .addText((text) => {
        descriptionInput = text.inputEl;
        text.setValue(this.existing?.description ?? '')
          .setPlaceholder(t('settings.agentEditor.descriptionPlaceholder'));
      });

    const details = contentEl.createEl('details', { cls: 'grimoire-sp-advanced-section' });
    details.createEl('summary', {
      text: t('settings.subagents.modal.advancedOptions'),
      cls: 'grimoire-sp-advanced-summary',
    });
    if (
      this.existing?.model ||
      this.existing?.variant ||
      this.existing?.temperature !== undefined ||
      this.existing?.topP !== undefined ||
      this.existing?.color ||
      this.existing?.steps !== undefined ||
      this.existing?.hidden ||
      this.existing?.disable ||
      this.existing?.tools ||
      this.existing?.permission !== undefined ||
      this.existing?.options
    ) {
      details.open = true;
    }

    new Setting(details)
      .setName(t('settings.subagents.modal.model'))
      .setDesc(t('settings.agentEditor.modelDesc'))
      .addText((text) => {
        modelInput = text.inputEl;
        text.setValue(this.existing?.model ?? '')
          .setPlaceholder('Anthropic/Claude-sonnet-4-20250514');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.variant'))
      .setDesc(t('settings.agentEditor.variantDesc'))
      .addText((text) => {
        variantInput = text.inputEl;
        text.setValue(this.existing?.variant ?? '')
          .setPlaceholder('High');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.temperature'))
      .setDesc(t('settings.agentEditor.temperatureDesc'))
      .addText((text) => {
        temperatureInput = text.inputEl;
        text.setValue(this.existing?.temperature !== undefined ? String(this.existing.temperature) : '')
          .setPlaceholder('0.1');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.topP'))
      .setDesc(t('settings.agentEditor.topPDesc'))
      .addText((text) => {
        topPInput = text.inputEl;
        text.setValue(this.existing?.topP !== undefined ? String(this.existing.topP) : '')
          .setPlaceholder('0.9');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.color'))
      .setDesc(t('settings.agentEditor.colorDesc'))
      .addText((text) => {
        colorInput = text.inputEl;
        text.setValue(this.existing?.color ?? '')
          .setPlaceholder('#Ff5733');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.steps'))
      .setDesc(t('settings.agentEditor.stepsDesc'))
      .addText((text) => {
        stepsInput = text.inputEl;
        text.setValue(this.existing?.steps !== undefined ? String(this.existing.steps) : '')
          .setPlaceholder('10');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.hideFromMention'))
      .setDesc(t('settings.agentEditor.hideFromMentionDesc'))
      .addToggle((toggle) => {
        toggle.setValue(hiddenValue).onChange((value) => {
          hiddenValue = value;
        });
      });

    new Setting(details)
      .setName(t('settings.agentEditor.disableAgent'))
      .setDesc(t('settings.agentEditor.disableAgentDesc'))
      .addToggle((toggle) => {
        toggle.setValue(disableValue).onChange((value) => {
          disableValue = value;
        });
      });

    new Setting(details)
      .setName(t('settings.agentEditor.enabledTools'))
      .setDesc(t('settings.agentEditor.enabledToolsDesc'))
      .addTextArea((text) => {
        toolsInput = text.inputEl;
        text.setValue(this.existing?.tools ? JSON.stringify(this.existing.tools, null, 2) : '')
          .setPlaceholder('{\n  "write": false,\n  "edit": false\n}');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.permission'))
      .setDesc(t('settings.agentEditor.permissionDesc'))
      .addTextArea((text) => {
        permissionInput = text.inputEl;
        text.setValue(this.existing?.permission !== undefined ? JSON.stringify(this.existing.permission, null, 2) : '')
          .setPlaceholder('{\n  "edit": "deny"\n}');
      });

    new Setting(details)
      .setName(t('settings.agentEditor.options'))
      .setDesc(t('settings.agentEditor.optionsDesc'))
      .addTextArea((text) => {
        optionsInput = text.inputEl;
        text.setValue(this.existing?.options ? JSON.stringify(this.existing.options, null, 2) : '')
          .setPlaceholder('{\n  "focus": "security"\n}');
      });

    new Setting(contentEl)
      .setName(t('settings.subagents.modal.prompt'))
      .setDesc(t('settings.agentEditor.promptDesc'));

    const promptArea = contentEl.createEl('textarea', {
      cls: 'grimoire-sp-content-area',
      attr: {
        rows: '10',
        placeholder: t('settings.agentEditor.promptPlaceholder'),
      },
    });
    promptArea.value = this.existing?.prompt ?? '';

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
      void (async (): Promise<void> => {
      const name = nameInput.value.trim();
      const nameError = validateKimicodeAgentName(name);
      if (nameError) {
        new Notice(nameError);
        return;
      }

      const description = descriptionInput.value.trim();
      if (!description) {
        new Notice(t('settings.subagents.descriptionRequired'));
        return;
      }

      const prompt = promptArea.value;
      if (!prompt.trim()) {
        new Notice(t('settings.subagents.promptRequired'));
        return;
      }

      const duplicate = findKimicodeAgentNameConflict(
        this.allAgents,
        name,
        this.existing?.persistenceKey,
      );
      if (duplicate) {
        new Notice(t('settings.subagents.duplicateName', { name }));
        return;
      }

      const temperature = parseOptionalNumber(temperatureInput.value, t('settings.agentEditor.temperature'));
      if (temperature.error) {
        new Notice(temperature.error);
        return;
      }

      const topP = parseOptionalNumber(topPInput.value, t('settings.agentEditor.topP'));
      if (topP.error) {
        new Notice(topP.error);
        return;
      }

      const steps = parseOptionalPositiveInteger(stepsInput.value, t('settings.agentEditor.steps'));
      if (steps.error) {
        new Notice(steps.error);
        return;
      }

      const tools = parseOptionalJsonObjectOfBooleans(toolsInput.value, t('settings.agentEditor.enabledTools'));
      if (tools.error) {
        new Notice(tools.error);
        return;
      }

      const permission = parseOptionalJson(permissionInput.value, t('settings.agentEditor.permission'));
      if (permission.error) {
        new Notice(permission.error);
        return;
      }

      const options = parseOptionalJsonObject(optionsInput.value, t('settings.agentEditor.options'));
      if (options.error) {
        new Notice(options.error);
        return;
      }

      const agent: KimicodeAgentDefinition = {
        name,
        description,
        prompt,
        mode: 'subagent',
        hidden: hiddenValue || undefined,
        disable: disableValue || undefined,
        model: modelInput.value.trim() || undefined,
        variant: variantInput.value.trim() || undefined,
        temperature: temperature.value,
        topP: topP.value,
        color: colorInput.value.trim() || undefined,
        steps: steps.value,
        tools: tools.value,
        permission: permission.value,
        options: options.value,
        persistenceKey: this.existing?.persistenceKey,
        extraFrontmatter: this.existing?.extraFrontmatter,
      };

      try {
        await this.onSave(agent);
      } catch (error) {
        const message = error instanceof Error ? error.message : t('settings.agentEditor.unknownError');
        new Notice(t('settings.subagents.saveFailed', { message }));
        return;
      }
      this.close();
      })();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class KimicodeAgentSettings {
  private containerEl: HTMLElement;
  private storage: KimicodeAgentStorage;
  private agents: KimicodeAgentDefinition[] = [];
  private app?: App;
  private onChanged?: () => Promise<void> | void;

  constructor(
    containerEl: HTMLElement,
    storage: KimicodeAgentStorage,
    app?: App,
    onChanged?: () => Promise<void> | void,
  ) {
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

    const visibleAgents = this.agents.filter((agent) => agent.mode === 'subagent');

    const headerEl = this.containerEl.createDiv({ cls: 'grimoire-sp-header' });
    headerEl.createSpan({
      text: t('settings.agentEditor.title', { provider: 'Kimi Code' }),
      cls: 'grimoire-sp-label',
    });

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

    if (visibleAgents.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'grimoire-sp-empty-state' });
      emptyEl.setText(t('settings.agentEditor.noAgents', { provider: 'Kimi Code' }));
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'grimoire-sp-list' });
    for (const agent of visibleAgents) {
      this.renderItem(listEl, agent);
    }
  }

  private renderItem(listEl: HTMLElement, agent: KimicodeAgentDefinition): void {
    const itemEl = listEl.createDiv({ cls: 'grimoire-sp-item' });
    const infoEl = itemEl.createDiv({ cls: 'grimoire-sp-info' });

    const headerRow = infoEl.createDiv({ cls: 'grimoire-sp-item-header' });
    const nameEl = headerRow.createSpan({ cls: 'grimoire-sp-item-name' });
    nameEl.setText(agent.name);

    headerRow.createSpan({
      text: t('settings.agentEditor.badge'),
      cls: 'grimoire-slash-item-badge',
    });

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
        await this.onChanged?.();
        new Notice(t('settings.subagents.deleted', { name: agent.name }));
      } catch {
        new Notice(t('settings.agentEditor.deleteFailed'));
      }
      })();
    });
  }

  private openModal(existing: KimicodeAgentDefinition | null): void {
    if (!this.app) return;

    const modal = new KimicodeAgentModal(
      this.app,
      existing,
      this.agents,
      async (agent) => {
        await this.storage.save(agent, existing);
        await this.render();
        await this.onChanged?.();
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

function parseOptionalNumber(
  value: string,
  label: string,
): { error?: string; value?: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { error: t('settings.agentEditor.invalidNumber', { label }) };
  }

  return { value: parsed };
}

function parseOptionalPositiveInteger(
  value: string,
  label: string,
): { error?: string; value?: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: t('settings.agentEditor.invalidPositiveInteger', { label }) };
  }

  return { value: parsed };
}

function parseOptionalJson(
  value: string,
  label: string,
): { error?: string; value?: unknown } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return { value: JSON.parse(trimmed) };
  } catch {
    return { error: t('settings.agentEditor.invalidJson', { label }) };
  }
}

function parseOptionalJsonObject(
  value: string,
  label: string,
): { error?: string; value?: Record<string, unknown> } {
  const parsed = parseOptionalJson(value, label);
  if (parsed.error || parsed.value === undefined) {
    return parsed.error ? { error: parsed.error } : {};
  }

  if (!isJsonObject(parsed.value)) {
    return { error: t('settings.agentEditor.invalidJsonObject', { label }) };
  }

  return { value: parsed.value };
}

function parseOptionalJsonObjectOfBooleans(
  value: string,
  label: string,
): { error?: string; value?: Record<string, boolean> } {
  const parsed = parseOptionalJsonObject(value, label);
  if (parsed.error || parsed.value === undefined) {
    return parsed.error ? { error: parsed.error } : {};
  }

  if (!Object.values(parsed.value).every((entry) => typeof entry === 'boolean')) {
    return { error: t('settings.agentEditor.invalidBooleanMap', { label }) };
  }

  return { value: parsed.value as Record<string, boolean> };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
