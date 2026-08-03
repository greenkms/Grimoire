import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { renderProviderDisabledNotice } from '../../../features/settings/ui/ProviderDisabledNotice';
import { t } from '../../../i18n/i18n';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getQwenProviderSettings, updateQwenProviderSettings } from '../settings';

const QWEN_CLI_PATH_PLACEHOLDER = '/usr/local/bin/qwen';

export const qwenSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const qwenSettings = getQwenProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    if (!qwenSettings.enabled) {
      renderProviderDisabledNotice(container, 'Qwen Code');
    }

    new Setting(container).setName(t('settings.setup')).setHeading();

    const cliPathSetting = new Setting(container)
      .setName(t('settings.providerTabs.qwen.cliPath.name'))
      .setDesc(t('settings.providerTabs.qwen.cliPath.desc'));

    const validationEl = container.createDiv({
      cls: 'grimoire-cli-path-validation grimoire-setting-validation grimoire-setting-validation-error grimoire-hidden',
    });
    const cliPathsByHost = { ...qwenSettings.cliPathsByHost };
    let cliPathInputEl: HTMLInputElement | null = null;

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;
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
        inputEl?.toggleClass('grimoire-input-error', true);
        return false;
      }

      validationEl.toggleClass('grimoire-hidden', true);
      inputEl?.toggleClass('grimoire-input-error', false);
      return true;
    };

    const persistCliPath = async (value: string): Promise<boolean> => {
      if (!updateCliPathValidation(value, cliPathInputEl ?? undefined)) {
        return false;
      }

      const trimmed = value.trim();
      if (trimmed) {
        cliPathsByHost[hostnameKey] = trimmed;
      } else {
        delete cliPathsByHost[hostnameKey];
      }

      updateQwenProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      return true;
    };

    const currentValue = qwenSettings.cliPathsByHost[hostnameKey] || '';
    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(QWEN_CLI_PATH_PLACEHOLDER)
        .setValue(currentValue)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('grimoire-settings-cli-path-input');
      cliPathInputEl = text.inputEl;
      updateCliPathValidation(currentValue, text.inputEl);
    });

    const advancedContainer = context.renderAdvancedSection(container, {
      count: 3,
      summary: t('settings.providerTabs.qwen.advancedSummary'),
    });

    context.renderHiddenProviderCommandSetting(advancedContainer, 'qwen', {
      name: t('settings.providerTabs.qwen.hiddenCommands.name'),
      desc: t('settings.providerTabs.qwen.hiddenCommands.desc'),
      placeholder: t('settings.providerTabs.qwen.hiddenCommands.placeholder'),
    });

    renderEnvironmentSettingsSection({
      container: advancedContainer,
      plugin: context.plugin,
      scope: 'provider:qwen',
      heading: t('settings.providerTabs.qwen.environment.heading'),
      name: t('settings.providerTabs.qwen.environment.name'),
      desc: t('settings.providerTabs.qwen.environment.desc'),
      placeholder: 'DASHSCOPE_API_KEY=...\nOPENAI_API_KEY=...',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'qwen'),
    });
  },
};
