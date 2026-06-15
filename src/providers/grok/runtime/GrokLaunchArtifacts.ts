import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { GRIMOIRE_STORAGE_PATH } from '../../../core/bootstrap/StoragePaths';
import {
  buildSystemPrompt,
  computeSystemPromptKey,
  type SystemPromptSettings,
} from '../../../core/prompt/mainAgent';
import {
  GROK_FULL_ACCESS_MODE_ID,
  GROK_PLAN_MODE_ID,
  GROK_SAFE_MODE_ID,
} from '../modes';

export interface GrokLaunchArtifacts {
  configContent: string;
  grokHomePath: string;
  launchKey: string;
  managedConfigPath: string;
  systemPromptPath: string;
}

export interface GrokManagedAgentConfig {
  permissionMode?: 'always-approve' | 'ask' | 'plan';
  id: string;
}

const DEFAULT_GROK_MANAGED_AGENT_CONFIGS: readonly GrokManagedAgentConfig[] = [
  { id: GROK_FULL_ACCESS_MODE_ID, permissionMode: 'always-approve' },
  { id: GROK_SAFE_MODE_ID, permissionMode: 'ask' },
  { id: GROK_PLAN_MODE_ID, permissionMode: 'plan' },
];

export interface PrepareGrokLaunchArtifactsParams {
  artifactsSubdir?: string;
  defaultAgentId?: string;
  managedAgents?: readonly GrokManagedAgentConfig[];
  settings?: SystemPromptSettings;
  systemPromptKey?: string;
  systemPromptText?: string;
  userName?: string;
  workspaceRoot: string;
}

export async function prepareGrokLaunchArtifacts(
  params: PrepareGrokLaunchArtifactsParams,
): Promise<GrokLaunchArtifacts> {
  const grokHomePath = path.join(
    params.workspaceRoot,
    GRIMOIRE_STORAGE_PATH,
    params.artifactsSubdir ?? 'grok',
  );
  const systemPromptPath = path.join(grokHomePath, 'system.md');
  const managedConfigPath = path.join(grokHomePath, 'managed_config.toml');
  const systemPrompt = normalizeSystemPrompt(
    params.systemPromptText ?? buildSystemPrompt(requireSettings(params)),
  );
  const promptKey = params.systemPromptKey
    ?? (params.systemPromptText !== undefined
      ? params.systemPromptText
      : computeSystemPromptKey(requireSettings(params)));
  const configContent = buildGrokManagedConfigToml({
    defaultAgentId: params.defaultAgentId,
    managedAgents: params.managedAgents,
    systemPromptPath,
    userName: params.userName ?? params.settings?.userName,
  });

  await fs.mkdir(grokHomePath, { recursive: true });
  await writeIfChanged(systemPromptPath, systemPrompt);
  await writeIfChanged(managedConfigPath, configContent);

  return {
    configContent,
    grokHomePath,
    launchKey: [promptKey, configContent, grokHomePath].join('::'),
    managedConfigPath,
    systemPromptPath,
  };
}

interface BuildGrokManagedConfigTomlParams {
  defaultAgentId?: string;
  managedAgents?: readonly GrokManagedAgentConfig[];
  systemPromptPath: string;
  userName?: string;
}

export function buildGrokManagedConfigToml(
  params: BuildGrokManagedConfigTomlParams,
): string {
  const lines: string[] = [
    '# Grimoire-managed Grok Build configuration',
    '',
    `[instructions]`,
    `path = ${tomlString(params.systemPromptPath)}`,
    '',
  ];

  const trimmedUserName = params.userName?.trim();
  if (trimmedUserName) {
    lines.push(`username = ${tomlString(trimmedUserName)}`, '');
  }

  const managedAgents = params.managedAgents?.length
    ? params.managedAgents
    : DEFAULT_GROK_MANAGED_AGENT_CONFIGS;
  for (const agentConfig of managedAgents) {
    lines.push(`[agent.${agentConfig.id}]`);
    if (agentConfig.permissionMode === 'always-approve') {
      lines.push('permission_mode = "always-approve"');
    } else if (agentConfig.permissionMode === 'plan') {
      lines.push('permission_mode = "plan"');
    } else {
      lines.push('permission_mode = "ask"');
    }
    lines.push('');
  }

  const trimmedDefaultAgentId = params.defaultAgentId?.trim();
  if (trimmedDefaultAgentId) {
    lines.push('[agents]', `default = ${tomlString(trimmedDefaultAgentId)}`, '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function writeIfChanged(filePath: string, content: string): Promise<void> {
  try {
    const existing = await fs.readFile(filePath, 'utf-8');
    if (existing === content) {
      return;
    }
  } catch {
    // Missing file; write below.
  }

  await fs.writeFile(filePath, content, 'utf-8');
}

function normalizeSystemPrompt(systemPrompt: string): string {
  return systemPrompt.endsWith('\n') ? systemPrompt : `${systemPrompt}\n`;
}

function requireSettings(
  params: PrepareGrokLaunchArtifactsParams,
): SystemPromptSettings {
  if (params.settings) {
    return params.settings;
  }

  throw new Error('prepareGrokLaunchArtifacts requires settings when no systemPromptText is provided');
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}