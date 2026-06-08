import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { renderProviderDisabledNotice } from '../../../features/settings/ui/ProviderDisabledNotice';
import { t } from '../../../i18n/i18n';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getGeminiProviderSettings, updateGeminiProviderSettings } from '../settings';

const GEMINI_CLI_PATH_PLACEHOLDER = '/usr/local/bin/gemini';

export const geminiSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const geminiSettings = getGeminiProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    if (!geminiSettings.enabled) {
      renderProviderDisabledNotice(container, 'Gemini');
    }

    new Setting(container).setName(t('settings.setup')).setHeading();

    const cliPathSetting = new Setting(container)
      .setName('Gemini CLI path')
      .setDesc('Custom path to the local Gemini CLI. Leave empty to launch `gemini` from PATH.');

    const validationEl = container.createDiv({
      cls: 'grimoire-cli-path-validation grimoire-setting-validation grimoire-setting-validation-error grimoire-hidden',
    });
    const cliPathsByHost = { ...geminiSettings.cliPathsByHost };
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

      updateGeminiProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      return true;
    };

    const currentValue = geminiSettings.cliPathsByHost[hostnameKey] || '';
    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(GEMINI_CLI_PATH_PLACEHOLDER)
        .setValue(currentValue)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('grimoire-settings-cli-path-input');
      cliPathInputEl = text.inputEl;
      updateCliPathValidation(currentValue, text.inputEl);
    });

    const advancedContainer = context.renderAdvancedSection(container, {
      count: 2,
      summary: 'Environment variables and context overrides',
    });

    renderEnvironmentSettingsSection({
      container: advancedContainer,
      plugin: context.plugin,
      scope: 'provider:gemini',
      heading: 'Environment',
      name: 'Environment Variables',
      desc: 'Extra environment variables passed to Gemini CLI, such as GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT.',
      placeholder: 'GEMINI_API_KEY=...\nGOOGLE_CLOUD_PROJECT=...',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'gemini'),
    });
  },
};
