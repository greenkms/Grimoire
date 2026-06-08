import { ProjectWorkspaceStore } from '../../core/context/ProjectWorkspaceStore';
import type { ProjectWorkspace } from '../../core/context/types';
import type { ContextEngineSettings } from '../../core/types/settings';
import { t } from '../../i18n/i18n';
import type GrimoirePlugin from '../../main';

type ProjectWorkspaceSettingsContext = {
  plugin: Pick<GrimoirePlugin, 'settings' | 'saveSettings'>;
};

const DEFAULT_CONTEXT_ENGINE_SETTINGS: ContextEngineSettings = {
  vaultSearchEnabled: true,
  vaultSearchMaxResults: 8,
  vaultSearchMaxSnippetChars: 700,
  relevantNotesEnabled: true,
  relevantNotesMaxResults: 6,
  projectWorkspaces: [],
  activeProjectWorkspaceId: '',
};

function ensureContextEngineSettings(plugin: ProjectWorkspaceSettingsContext['plugin']): ContextEngineSettings {
  const existing = plugin.settings.contextEngine as ContextEngineSettings | undefined;
  if (!existing) {
    plugin.settings.contextEngine = { ...DEFAULT_CONTEXT_ENGINE_SETTINGS };
    return plugin.settings.contextEngine;
  }

  plugin.settings.contextEngine = {
    ...DEFAULT_CONTEXT_ENGINE_SETTINGS,
    ...existing,
    projectWorkspaces: ProjectWorkspaceStore.normalizeWorkspaceList(existing.projectWorkspaces),
    activeProjectWorkspaceId: existing.activeProjectWorkspaceId ?? '',
  };
  return plugin.settings.contextEngine;
}

function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseBoundedInteger(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function createControlRow(container: HTMLElement, label: string): HTMLElement {
  const rowEl = container.createDiv({ cls: 'grimoire-context-engine-setting' });
  rowEl.createSpan({ cls: 'grimoire-context-engine-setting-label', text: label });
  return rowEl.createDiv({ cls: 'grimoire-context-engine-setting-control' });
}

function createCheckboxInput(
  container: HTMLElement,
  label: string,
  value: boolean,
  onChange: (value: boolean) => void | Promise<void>,
): HTMLInputElement {
  const rowEl = createControlRow(container, label);
  const input = rowEl.createEl('input', {
    attr: {
      'aria-label': label,
      type: 'checkbox',
    },
  }) as HTMLInputElement;
  input.checked = value;
  input.addEventListener('change', () => {
    void onChange(input.checked);
  });
  return input;
}

function createNumberInput(
  container: HTMLElement,
  label: string,
  value: number,
  onChange: (value: number) => void | Promise<void>,
  options: { min: number; max: number },
): HTMLInputElement {
  const rowEl = createControlRow(container, label);
  const input = rowEl.createEl('input', {
    attr: {
      'aria-label': label,
      max: String(options.max),
      min: String(options.min),
      type: 'number',
      value: String(value),
    },
  }) as HTMLInputElement;
  input.value = String(value);
  input.addEventListener('change', () => {
    const nextValue = parseBoundedInteger(input.value, value, options.min, options.max);
    input.value = String(nextValue);
    void onChange(nextValue);
  });
  return input;
}

function createTextInput(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (value: string) => void | Promise<void>,
  placeholder = '',
): HTMLInputElement {
  const input = container.createEl('input', {
    type: 'text',
    value,
    attr: {
      'aria-label': label,
      ...(placeholder ? { placeholder } : {}),
    },
  });
  input.addEventListener('change', () => {
    void onChange(input.value);
  });
  return input;
}

function createTextArea(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (value: string) => void | Promise<void>,
): HTMLTextAreaElement {
  const textArea = container.createEl('textarea', {
    text: value,
    attr: { 'aria-label': label },
  });
  textArea.value = value;
  textArea.rows = 3;
  textArea.addEventListener('change', () => {
    void onChange(textArea.value);
  });
  return textArea;
}

function renderContextEngineControls(
  container: HTMLElement,
  settings: ContextEngineSettings,
  plugin: ProjectWorkspaceSettingsContext['plugin'],
): void {
  const sectionEl = container.createDiv({ cls: 'grimoire-context-engine-settings grimoire-settings-panel' });
  sectionEl.createEl('h3', { text: t('settings.contextEngine.name') });
  sectionEl.createEl('p', { text: t('settings.contextEngine.desc') });

  createCheckboxInput(sectionEl, t('settings.contextEngine.vaultSearchEnabled'), settings.vaultSearchEnabled, async (value) => {
    settings.vaultSearchEnabled = value;
    await plugin.saveSettings();
  });
  createNumberInput(sectionEl, t('settings.contextEngine.vaultSearchMaxResults'), settings.vaultSearchMaxResults, async (value) => {
    settings.vaultSearchMaxResults = value;
    await plugin.saveSettings();
  }, { min: 1, max: 50 });
  createNumberInput(sectionEl, t('settings.contextEngine.vaultSearchMaxSnippetChars'), settings.vaultSearchMaxSnippetChars, async (value) => {
    settings.vaultSearchMaxSnippetChars = value;
    await plugin.saveSettings();
  }, { min: 120, max: 4000 });
  createCheckboxInput(sectionEl, t('settings.contextEngine.relevantNotesEnabled'), settings.relevantNotesEnabled, async (value) => {
    settings.relevantNotesEnabled = value;
    await plugin.saveSettings();
  });
  createNumberInput(sectionEl, t('settings.contextEngine.relevantNotesMaxResults'), settings.relevantNotesMaxResults, async (value) => {
    settings.relevantNotesMaxResults = value;
    await plugin.saveSettings();
  }, { min: 1, max: 30 });
}

export function renderProjectWorkspaceSettings(
  container: HTMLElement,
  context: ProjectWorkspaceSettingsContext,
): void {
  const { plugin } = context;
  const settings = ensureContextEngineSettings(plugin);
  renderContextEngineControls(container, settings, plugin);

  const sectionEl = container.createDiv({ cls: 'grimoire-project-workspaces-settings grimoire-settings-panel' });
  const headerEl = sectionEl.createDiv({ cls: 'grimoire-project-workspaces-header' });
  headerEl.createEl('h3', { text: t('settings.projectWorkspaces.name') });
  const addButton = headerEl.createEl('button', {
    cls: 'grimoire-project-workspace-add',
    text: t('settings.projectWorkspaces.add'),
  });

  const listEl = sectionEl.createDiv({ cls: 'grimoire-project-workspaces-list' });

  const saveWorkspace = async (workspaceId: string, patch: Partial<ProjectWorkspace>): Promise<void> => {
    const index = settings.projectWorkspaces.findIndex((candidate) => candidate.id === workspaceId);
    if (index >= 0) {
      const normalized = ProjectWorkspaceStore.normalizeWorkspace({
        ...settings.projectWorkspaces[index],
        ...patch,
        id: workspaceId,
      });
      settings.projectWorkspaces[index] = normalized;
    }
    await plugin.saveSettings();
  };

  const renderWorkspace = (workspace: ProjectWorkspace): void => {
    const itemEl = listEl.createDiv({ cls: 'grimoire-project-workspace-item' });

    createTextInput(
      itemEl,
      t('settings.projectWorkspaces.workspaceName'),
      workspace.name,
      async (value) => {
        await saveWorkspace(workspace.id, { name: value });
      },
      t('settings.projectWorkspaces.new'),
    );
    createTextArea(itemEl, t('settings.projectWorkspaces.systemPrompt'), workspace.systemPrompt, async (value) => {
      await saveWorkspace(workspace.id, { systemPrompt: value });
    });
    createTextArea(itemEl, t('settings.projectWorkspaces.vaultFolders'), workspace.vaultFolders.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { vaultFolders: parseList(value) });
    });
    createTextArea(itemEl, t('settings.projectWorkspaces.vaultFiles'), workspace.vaultFiles.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { vaultFiles: parseList(value) });
    });
    createTextArea(itemEl, t('settings.projectWorkspaces.tags'), workspace.tags.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { tags: parseList(value) });
    });
    createTextArea(itemEl, t('settings.projectWorkspaces.externalPaths'), workspace.externalContextPaths.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { externalContextPaths: parseList(value) });
    });
    createTextInput(itemEl, t('settings.projectWorkspaces.provider'), workspace.providerId ?? '', async (value) => {
      await saveWorkspace(workspace.id, { providerId: value });
    });
    createTextInput(itemEl, t('settings.projectWorkspaces.model'), workspace.model ?? '', async (value) => {
      await saveWorkspace(workspace.id, { model: value });
    });

    const deleteButton = itemEl.createEl('button', { text: t('settings.projectWorkspaces.delete') });
    deleteButton.addEventListener('click', () => {
      settings.projectWorkspaces = settings.projectWorkspaces.filter((candidate) => candidate.id !== workspace.id);
      if (settings.activeProjectWorkspaceId === workspace.id) {
        settings.activeProjectWorkspaceId = '';
      }
      void plugin.saveSettings();
      itemEl.remove();
    });
  };

  for (const workspace of settings.projectWorkspaces) {
    renderWorkspace(workspace);
  }

  addButton.addEventListener('click', () => {
    const workspace = ProjectWorkspaceStore.normalizeWorkspace({
      name: '',
      systemPrompt: '',
      vaultFolders: [],
      vaultFiles: [],
      tags: [],
      externalContextPaths: [],
    });
    settings.projectWorkspaces.push(workspace);
    settings.activeProjectWorkspaceId = workspace.id;
    renderWorkspace(workspace);
    void plugin.saveSettings();
  });
}
