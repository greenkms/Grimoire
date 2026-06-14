import type { ProviderUIOption } from '../../core/providers/types';
import { getCurrentModelFromEnvironment, getModelsFromEnvironment } from './env/claudeModelEnv';
import { formatCustomModelLabel } from './modelLabels';
import {
  getClaudeEffectiveEnvironmentVariables,
  getClaudeProviderSettings,
} from './settings';
import { DEFAULT_CLAUDE_MODELS, filterVisibleModelOptions } from './types/models';

function parseConfiguredCustomModelIds(value: string): string[] {
  const modelIds: string[] = [];
  const seen = new Set<string>();

  for (const line of value.split(/\r?\n/)) {
    const modelId = line.trim();
    if (!modelId || seen.has(modelId)) {
      continue;
    }
    seen.add(modelId);
    modelIds.push(modelId);
  }

  return modelIds;
}

function normalizeCustomModelAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const aliases: Record<string, string> = {};
  for (const [rawModelId, rawAlias] of Object.entries(value)) {
    if (typeof rawAlias !== 'string') {
      continue;
    }

    const modelId = rawModelId.trim();
    const alias = rawAlias.trim();
    if (modelId && alias) {
      aliases[modelId] = alias;
    }
  }

  return aliases;
}

export function getClaudeModelOptions(settings: Record<string, unknown>): ProviderUIOption[] {
  const customModelAliases = normalizeCustomModelAliases(settings.customModelAliases);
  const customModels = getModelsFromEnvironment(
    getClaudeEffectiveEnvironmentVariables(settings),
    customModelAliases,
  );
  if (customModels.length > 0) {
    return customModels;
  }

  const claudeSettings = getClaudeProviderSettings(settings);
  const models = filterVisibleModelOptions(
    [...DEFAULT_CLAUDE_MODELS],
    claudeSettings.enableOpus1M,
    claudeSettings.enableSonnet1M,
  );

  const seenValues = new Set(models.map(model => model.value));
  for (const modelId of parseConfiguredCustomModelIds(claudeSettings.customModels)) {
    if (seenValues.has(modelId)) {
      continue;
    }

    seenValues.add(modelId);
    models.push({
      value: modelId,
      label: customModelAliases[modelId] ?? formatCustomModelLabel(modelId),
      description: 'Custom model',
    });
  }

  const projectSettingsModel = claudeSettings.respectProjectSettings
    ? claudeSettings.projectSettingsSnapshot.model
    : '';
  if (projectSettingsModel && !seenValues.has(projectSettingsModel)) {
    seenValues.add(projectSettingsModel);
    models.push({
      value: projectSettingsModel,
      label: customModelAliases[projectSettingsModel] ?? formatCustomModelLabel(projectSettingsModel),
      description: 'Claude Code settings model',
    });
  }

  return models;
}

export function resolveClaudeModelSelection(
  settings: Record<string, unknown>,
  currentModel: string,
): string | null {
  const modelOptions = getClaudeModelOptions(settings);
  if (currentModel && modelOptions.some(option => option.value === currentModel)) {
    return currentModel;
  }

  const claudeSettings = getClaudeProviderSettings(settings);
  const projectSettingsModel = claudeSettings.respectProjectSettings
    ? claudeSettings.projectSettingsSnapshot.model
    || getCurrentModelFromEnvironment(getClaudeEffectiveEnvironmentVariables(settings))
    || ''
    : '';
  if (projectSettingsModel && modelOptions.some(option => option.value === projectSettingsModel)) {
    return projectSettingsModel;
  }

  const lastModel = claudeSettings.lastModel;
  if (lastModel && modelOptions.some(option => option.value === lastModel)) {
    return lastModel;
  }

  return modelOptions[0]?.value ?? null;
}
