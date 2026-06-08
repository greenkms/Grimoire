import * as fs from 'fs';
import { Setting } from 'obsidian';

import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { renderProviderDisabledNotice } from '../../../features/settings/ui/ProviderDisabledNotice';
import { t } from '../../../i18n/i18n';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getCodexWorkspaceServices } from '../app/CodexWorkspaceServices';
import { parseConfiguredCustomModelIds, resolveCodexModelSelection } from '../modelOptions';
import { isWindowsStyleCliReference } from '../runtime/CodexBinaryLocator';
import { getCodexProviderSettings, updateCodexProviderSettings } from '../settings';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../types/models';
import { CodexSkillSettings } from './CodexSkillSettings';
import { CodexSubagentSettings } from './CodexSubagentSettings';

export const codexSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const codexWorkspace = getCodexWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const codexSettings = getCodexProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();
    const isWindowsHost = process.platform === 'win32';
    let installationMethod = codexSettings.installationMethod;

    if (!codexSettings.enabled) {
      renderProviderDisabledNotice(container, 'Codex');
    }

    const reconcileActiveCodexModelSelection = (): void => {
      const activeProvider = settingsBag.settingsProvider;
      if (activeProvider !== 'codex') {
        return;
      }

      const currentModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
      const nextModel = resolveCodexModelSelection(settingsBag, currentModel);
      if (!nextModel || nextModel === currentModel) {
        return;
      }

      settingsBag.model = nextModel;
    };

    // --- Setup ---

    new Setting(container).setName(t('settings.setup')).setHeading();

    if (isWindowsHost) {
      new Setting(container)
        .setName('Installation method')
        .setDesc('How Grimoire should launch Codex on Windows. Native Windows uses a Windows executable path. WSL launches the Linux CLI inside a selected distro.')
        .addDropdown((dropdown) => {
          dropdown
            .addOption('native-windows', 'Native Windows')
            .addOption('wsl', 'WSL')
            .setValue(installationMethod)
            .onChange(async (value) => {
              installationMethod = value === 'wsl' ? 'wsl' : 'native-windows';
              updateCodexProviderSettings(settingsBag, { installationMethod });
              refreshInstallationMethodUI();
              await context.plugin.saveSettings();
            });
        });
    }

    const getCliPathCopy = (): { desc: string; placeholder: string } => {
      if (!isWindowsHost) {
        return {
          desc: 'Custom path to the local Codex CLI. Leave empty for auto-detection from PATH.',
          placeholder: '/usr/local/bin/codex',
        };
      }

      if (installationMethod === 'wsl') {
        return {
          desc: 'Linux-side Codex command or absolute path to run inside WSL. Leave empty for PATH lookup inside the selected distro.',
          placeholder: 'codex',
        };
      }

      return {
        desc: 'Custom path to the local Codex CLI. Leave empty for auto-detection from PATH. Use the native Windows executable path, usually `codex.exe`.',
        placeholder: 'C:\\Users\\you\\AppData\\Roaming\\npm\\codex.exe',
      };
    };

    const shouldValidateCliPathAsFile = (): boolean => !isWindowsHost || installationMethod !== 'wsl';

    const cliPathSetting = new Setting(container)
      .setName('Codex CLI path')
      .setDesc(getCliPathCopy().desc);

    const validationEl = container.createDiv({
      cls: 'grimoire-cli-path-validation grimoire-setting-validation grimoire-setting-validation-error grimoire-hidden',
    });

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (!shouldValidateCliPathAsFile()) {
        if (isWindowsStyleCliReference(trimmed)) {
          return 'WSL mode expects a Linux command or Linux absolute path, not a Windows executable path.';
        }
        return null;
      }

      const expandedPath = expandHomePath(trimmed);

      if (!fs.existsSync(expandedPath)) {
        return t('settings.cliPath.validation.notExist');
      }
      const stat = fs.statSync(expandedPath);
      if (!stat.isFile()) {
        return t('settings.cliPath.validation.isDirectory');
      }
      return null;
    };

    const updateCliPathValidation = (value: string, inputEl?: HTMLInputElement): boolean => {
      const error = validatePath(value);
      if (error) {
        validationEl.setText(error);
        validationEl.toggleClass('grimoire-hidden', false);
        if (inputEl) {
          inputEl.toggleClass('grimoire-input-error', true);
        }
        return false;
      }

      validationEl.toggleClass('grimoire-hidden', true);
      if (inputEl) {
        inputEl.toggleClass('grimoire-input-error', false);
      }
      return true;
    };

    const cliPathsByHost = { ...codexSettings.cliPathsByHost };
    let cliPathInputEl: HTMLInputElement | null = null;
    let wslDistroSettingEl: HTMLElement | null = null;
    let wslDistroInputEl: HTMLInputElement | null = null;

    const refreshInstallationMethodUI = (): void => {
      const cliCopy = getCliPathCopy();
      cliPathSetting.setDesc(cliCopy.desc);
      if (cliPathInputEl) {
        cliPathInputEl.placeholder = cliCopy.placeholder;
        updateCliPathValidation(cliPathInputEl.value, cliPathInputEl);
      }
      if (wslDistroSettingEl) {
        wslDistroSettingEl.toggleClass('grimoire-hidden', installationMethod !== 'wsl');
      }
      if (wslDistroInputEl) {
        wslDistroInputEl.disabled = installationMethod !== 'wsl';
      }
    };

    const persistCliPath = async (value: string): Promise<boolean> => {
      const isValid = updateCliPathValidation(value, cliPathInputEl ?? undefined);
      if (!isValid) {
        return false;
      }

      const trimmed = value.trim();
      if (trimmed) {
        cliPathsByHost[hostnameKey] = trimmed;
      } else {
        delete cliPathsByHost[hostnameKey];
      }

      updateCodexProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      const view = context.plugin.getView();
      await view?.getTabManager()?.broadcastToAllTabs(
        (service) => Promise.resolve(service.cleanup())
      );
      return true;
    };

    const currentValue = codexSettings.cliPathsByHost[hostnameKey] || '';

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(getCliPathCopy().placeholder)
        .setValue(currentValue)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('grimoire-settings-cli-path-input');
      cliPathInputEl = text.inputEl;

      updateCliPathValidation(currentValue, text.inputEl);
    });

    if (isWindowsHost) {
      const wslDistroSetting = new Setting(container)
        .setName('WSL distro override')
        .setDesc('Optional advanced override. Leave empty to infer the distro from a WSL workspace path when possible, otherwise use the default WSL distro.');

      wslDistroSettingEl = wslDistroSetting.settingEl;
      wslDistroSetting.addText((text) => {
        text
          .setPlaceholder('Ubuntu')
          .setValue(codexSettings.wslDistroOverride)
          .onChange(async (value) => {
            updateCodexProviderSettings(settingsBag, { wslDistroOverride: value });
            await context.plugin.saveSettings();
          });

        text.inputEl.addClass('grimoire-settings-cli-path-input');
        text.inputEl.disabled = installationMethod !== 'wsl';
        wslDistroInputEl = text.inputEl;
      });
    }

    refreshInstallationMethodUI();

    // --- Models ---

    new Setting(container).setName(t('settings.models')).setHeading();

    const SUMMARY_OPTIONS: { value: string; label: string }[] = [
      { value: 'auto', label: 'Auto' },
      { value: 'concise', label: 'Concise' },
      { value: 'detailed', label: 'Detailed' },
      { value: 'none', label: 'Off' },
    ];

    new Setting(container)
      .setName('Custom models')
      .setDesc('Append additional Codex model ids to the picker, one per line. `OPENAI_MODEL` still takes precedence when set.')
      .addTextArea((text) => {
        let pendingCustomModels = codexSettings.customModels;
        let savedCustomModels = codexSettings.customModels;

        const reconcileInactiveCodexProjection = (
          previousCustomModels: string,
        ): boolean => {
          if (settingsBag.settingsProvider === 'codex') {
            return false;
          }

          const savedProviderModel = (
            settingsBag.savedProviderModel
            && typeof settingsBag.savedProviderModel === 'object'
          )
            ? settingsBag.savedProviderModel as Record<string, unknown>
            : {};
          const currentSavedModel = typeof savedProviderModel.codex === 'string'
            ? savedProviderModel.codex
            : '';
          if (!currentSavedModel) {
            return false;
          }

          const previousCustomModelIds = new Set(parseConfiguredCustomModelIds(previousCustomModels));
          if (!previousCustomModelIds.has(currentSavedModel)) {
            return false;
          }

          const nextSavedModel = resolveCodexModelSelection(settingsBag, currentSavedModel);
          if (!nextSavedModel || nextSavedModel === currentSavedModel) {
            return false;
          }

          settingsBag.savedProviderModel = {
            ...savedProviderModel,
            codex: nextSavedModel,
          };
          return true;
        };

        const commitCustomModels = async (): Promise<void> => {
          const previousCustomModels = savedCustomModels;
          const previousModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
          const previousTitleModel = typeof settingsBag.titleGenerationModel === 'string'
            ? settingsBag.titleGenerationModel
            : '';

          if (pendingCustomModels !== savedCustomModels) {
            updateCodexProviderSettings(settingsBag, { customModels: pendingCustomModels });
            savedCustomModels = pendingCustomModels;
          }

          reconcileActiveCodexModelSelection();
          const didReconcileInactiveProjection = reconcileInactiveCodexProjection(previousCustomModels);
          const didReconcileTitleModel = ProviderSettingsCoordinator
            .reconcileTitleGenerationModelSelection(settingsBag);
          const nextModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
          const nextTitleModel = typeof settingsBag.titleGenerationModel === 'string'
            ? settingsBag.titleGenerationModel
            : '';
          const didModelSelectionChange = previousModel !== nextModel;
          const didCustomModelsChange = previousCustomModels !== savedCustomModels;

          if (!didCustomModelsChange && !didModelSelectionChange && !didReconcileInactiveProjection
            && !didReconcileTitleModel
            && previousTitleModel === nextTitleModel) {
            return;
          }

          await context.plugin.saveSettings();
          context.refreshModelSelectors();
        };

        text
          .setPlaceholder('gpt-5.4\ngpt-5.3-codex-spark')
          .setValue(codexSettings.customModels)
          .onChange((value) => {
            pendingCustomModels = value;
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 40;
        text.inputEl.addEventListener('blur', () => {
          void commitCustomModels();
        });
      });

    new Setting(container)
      .setName('Reasoning summary')
      .setDesc('Show a summary of the model\'s reasoning process in the thinking block.')
      .addDropdown((dropdown) => {
        for (const opt of SUMMARY_OPTIONS) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(codexSettings.reasoningSummary);
        dropdown.onChange(async (value) => {
          updateCodexProviderSettings(
            settingsBag,
            { reasoningSummary: value as 'auto' | 'concise' | 'detailed' | 'none' },
          );
          await context.plugin.saveSettings();
        });
      });

    const advancedContainer = context.renderAdvancedSection(container, {
      count: 5,
      summary: 'Skills, subagents, MCP, and launch settings',
    });

    // --- Skills ---

    const codexCatalog = codexWorkspace.commandCatalog;
    if (codexCatalog) {
      new Setting(advancedContainer).setName('Codex skills').setHeading();

      const skillsDesc = advancedContainer.createDiv({ cls: 'grimoire-sp-settings-desc' });
      skillsDesc.createEl('p', {
        cls: 'setting-item-description',
        text: 'Manage vault-level Codex skills stored in .codex/skills/ or .agents/skills/. Home-level skills are excluded here.',
      });

      const skillsContainer = advancedContainer.createDiv({ cls: 'grimoire-slash-commands-container' });
      new CodexSkillSettings(skillsContainer, codexCatalog, context.plugin.app);
    }

    context.renderHiddenProviderCommandSetting(advancedContainer, 'codex', {
      name: 'Hidden Skills',
      desc: 'Hide specific Codex skills from the dropdown. Enter skill names without the leading $, one per line.',
      placeholder: 'analyze\nexplain\nfix',
    });

    // --- Subagents ---

    new Setting(advancedContainer).setName('Codex subagents').setHeading();

    const subagentDesc = advancedContainer.createDiv({ cls: 'grimoire-sp-settings-desc' });
    subagentDesc.createEl('p', {
      cls: 'setting-item-description',
      text: 'Manage vault-level Codex subagents stored in .codex/agents/. Each TOML file defines one custom agent.',
    });

    const subagentContainer = advancedContainer.createDiv({ cls: 'grimoire-slash-commands-container' });
    new CodexSubagentSettings(subagentContainer, codexWorkspace.subagentStorage, context.plugin.app, () => {
      void codexWorkspace.refreshAgentMentions?.();
    });

    // --- MCP Servers ---

    new Setting(advancedContainer).setName(t('settings.mcpServers.name')).setHeading();
    const mcpNotice = advancedContainer.createDiv({ cls: 'grimoire-mcp-settings-desc' });
    const mcpDesc = mcpNotice.createEl('p', { cls: 'setting-item-description' });
    mcpDesc.appendText('Codex manages MCP servers via its own CLI. Configure with ');
    mcpDesc.createEl('code').appendText('codex mcp');
    mcpDesc.appendText(' and they will be available in Grimoire. ');
    mcpDesc.createEl('a', {
      text: 'Learn more',
      href: 'https://developers.openai.com/codex/mcp',
    });

    // --- Environment ---

    renderEnvironmentSettingsSection({
      container: advancedContainer,
      plugin: context.plugin,
      scope: 'provider:codex',
      heading: t('settings.environment'),
      name: 'Codex environment',
      desc: 'Codex-owned runtime variables only. Use this for OPENAI_* and CODEX_* settings. If Codex auto-detection needs help, add its install directory to shared PATH instead of this provider section.',
      placeholder: `OPENAI_API_KEY=your-key\nOPENAI_BASE_URL=https://api.openai.com/v1\nOPENAI_MODEL=${DEFAULT_CODEX_PRIMARY_MODEL}\nCODEX_SANDBOX=workspace-write`,
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'codex'),
    });
  },
};
