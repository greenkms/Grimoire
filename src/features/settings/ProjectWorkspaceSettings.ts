import { Setting } from 'obsidian';

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

function addToggleSetting(
  container: HTMLElement,
  label: string,
  value: boolean,
  onChange: (value: boolean) => void | Promise<void>,
): void {
  new Setting(container)
    .setName(label)
    .addToggle((toggle) => {
      toggle.toggleEl.setAttribute('aria-label', label);
      toggle.setValue(value).onChange(onChange);
    });
}

function addNumberSetting(
  container: HTMLElement,
  label: string,
  value: number,
  onChange: (value: number) => void | Promise<void>,
  options: { min: number; max: number },
): void {
  const setting = new Setting(container)
    .setName(label)
    .addText((text) => {
      text.inputEl.type = 'number';
      text.inputEl.min = String(options.min);
      text.inputEl.max = String(options.max);
      text.inputEl.setAttribute('aria-label', label);
      text.setValue(String(value)).onChange((rawValue) => {
        const nextValue = parseBoundedInteger(rawValue, value, options.min, options.max);
        text.setValue(String(nextValue));
        void onChange(nextValue);
      });
    });
  setting.settingEl.addClass('grimoire-context-engine-number-setting');
}

function addTextSetting(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (value: string) => void | Promise<void>,
  placeholder = '',
): void {
  new Setting(container)
    .setName(label)
    .addText((text) => {
      text.inputEl.setAttribute('aria-label', label);
      text.setValue(value);
      if (placeholder) {
        text.setPlaceholder(placeholder);
      }
      text.onChange(onChange);
    });
}

function addTextAreaSetting(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (value: string) => void | Promise<void>,
): void {
  const setting = new Setting(container)
    .setName(label)
    .addTextArea((textArea) => {
      textArea.inputEl.setAttribute('aria-label', label);
      textArea.inputEl.rows = 3;
      textArea.setValue(value).onChange(onChange);
    });
  setting.settingEl.addClass('grimoire-settings-textarea-row');
}

function renderContextEngineControls(
  container: HTMLElement,
  settings: ContextEngineSettings,
  plugin: ProjectWorkspaceSettingsContext['plugin'],
): void {
  const heading = new Setting(container)
    .setName(t('settings.contextEngine.name'))
    .setDesc(t('settings.contextEngine.desc'))
    .setHeading();
  heading.settingEl.addClass('grimoire-context-engine-heading');

  addToggleSetting(container, t('settings.contextEngine.vaultSearchEnabled'), settings.vaultSearchEnabled, async (value) => {
    settings.vaultSearchEnabled = value;
    await plugin.saveSettings();
  });
  addNumberSetting(container, t('settings.contextEngine.vaultSearchMaxResults'), settings.vaultSearchMaxResults, async (value) => {
    settings.vaultSearchMaxResults = value;
    await plugin.saveSettings();
  }, { min: 1, max: 50 });
  addNumberSetting(container, t('settings.contextEngine.vaultSearchMaxSnippetChars'), settings.vaultSearchMaxSnippetChars, async (value) => {
    settings.vaultSearchMaxSnippetChars = value;
    await plugin.saveSettings();
  }, { min: 120, max: 4000 });
  addToggleSetting(container, t('settings.contextEngine.relevantNotesEnabled'), settings.relevantNotesEnabled, async (value) => {
    settings.relevantNotesEnabled = value;
    await plugin.saveSettings();
  });
  addNumberSetting(container, t('settings.contextEngine.relevantNotesMaxResults'), settings.relevantNotesMaxResults, async (value) => {
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

  const heading = new Setting(container)
    .setName(t('settings.projectWorkspaces.name'))
    .setDesc(t('settings.projectWorkspaces.desc'))
    .setHeading();
  heading.settingEl.addClass('grimoire-project-workspaces-header');

  const listEl = container.createDiv({ cls: 'grimoire-project-workspaces-list' });

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

    addTextSetting(itemEl, t('settings.projectWorkspaces.workspaceName'), workspace.name, async (value) => {
      await saveWorkspace(workspace.id, { name: value });
    }, t('settings.projectWorkspaces.new'));
    addTextAreaSetting(itemEl, t('settings.projectWorkspaces.systemPrompt'), workspace.systemPrompt, async (value) => {
      await saveWorkspace(workspace.id, { systemPrompt: value });
    });
    addTextAreaSetting(itemEl, t('settings.projectWorkspaces.vaultFolders'), workspace.vaultFolders.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { vaultFolders: parseList(value) });
    });
    addTextAreaSetting(itemEl, t('settings.projectWorkspaces.vaultFiles'), workspace.vaultFiles.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { vaultFiles: parseList(value) });
    });
    addTextAreaSetting(itemEl, t('settings.projectWorkspaces.tags'), workspace.tags.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { tags: parseList(value) });
    });
    addTextAreaSetting(itemEl, t('settings.projectWorkspaces.externalPaths'), workspace.externalContextPaths.join('\n'), async (value) => {
      await saveWorkspace(workspace.id, { externalContextPaths: parseList(value) });
    });
    addTextSetting(itemEl, t('settings.projectWorkspaces.provider'), workspace.providerId ?? '', async (value) => {
      await saveWorkspace(workspace.id, { providerId: value });
    });
    addTextSetting(itemEl, t('settings.projectWorkspaces.model'), workspace.model ?? '', async (value) => {
      await saveWorkspace(workspace.id, { model: value });
    });

    const deleteSetting = new Setting(itemEl)
      .setName(workspace.name || t('settings.projectWorkspaces.untitled'))
      .addButton((button) => {
        button.setButtonText(t('settings.projectWorkspaces.delete')).onClick(() => {
          settings.projectWorkspaces = settings.projectWorkspaces.filter((candidate) => candidate.id !== workspace.id);
          if (settings.activeProjectWorkspaceId === workspace.id) {
            settings.activeProjectWorkspaceId = '';
          }
          void plugin.saveSettings();
          itemEl.remove();
        });
      });
    deleteSetting.settingEl.addClass('grimoire-project-workspace-delete-row');
  };

  for (const workspace of settings.projectWorkspaces) {
    renderWorkspace(workspace);
  }

  heading.addButton((button) => {
      button.setButtonText(t('settings.projectWorkspaces.add')).onClick(() => {
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
    });
}
