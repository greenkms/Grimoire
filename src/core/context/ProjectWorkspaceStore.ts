import type { ContextEngineSettings } from '../types/settings';
import type { ProjectWorkspace } from './types';

type ProjectWorkspaceSettingsLike = Pick<
  ContextEngineSettings,
  'projectWorkspaces' | 'activeProjectWorkspaceId'
>;

type ProjectWorkspaceInput = Partial<ProjectWorkspace>;

function createWorkspaceId(): string {
  return `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(values: unknown, transform?: (value: string) => string): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = trimString(value);
    const next = transform ? transform(trimmed) : trimmed;
    if (!next || seen.has(next)) {
      continue;
    }
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

function isWorkspaceInput(value: unknown): value is ProjectWorkspaceInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ProjectWorkspaceStore {
  private readonly workspaces: ProjectWorkspace[];
  private readonly activeProjectWorkspaceId: string;

  constructor(settings: ProjectWorkspaceSettingsLike) {
    this.workspaces = ProjectWorkspaceStore.normalizeWorkspaceList(settings.projectWorkspaces);
    this.activeProjectWorkspaceId = trimString(settings.activeProjectWorkspaceId);
  }

  getActiveWorkspace(): ProjectWorkspace | null {
    if (!this.activeProjectWorkspaceId) {
      return null;
    }
    return this.getWorkspaceById(this.activeProjectWorkspaceId);
  }

  getWorkspaceById(id: string): ProjectWorkspace | null {
    const trimmedId = id.trim();
    return this.workspaces.find((workspace) => workspace.id === trimmedId) ?? null;
  }

  static normalizeWorkspace(input: ProjectWorkspaceInput): ProjectWorkspace {
    const providerId = trimString(input.providerId);
    const model = trimString(input.model);
    const workspace: ProjectWorkspace = {
      id: trimString(input.id) || createWorkspaceId(),
      name: trimString(input.name),
      systemPrompt: trimString(input.systemPrompt),
      vaultFolders: normalizeStringList(input.vaultFolders),
      vaultFiles: normalizeStringList(input.vaultFiles),
      tags: normalizeStringList(input.tags, (tag) => tag.replace(/^#+/, '').trim()),
      externalContextPaths: normalizeStringList(input.externalContextPaths),
    };

    if (providerId) {
      workspace.providerId = providerId;
    }
    if (model) {
      workspace.model = model;
    }

    return workspace;
  }

  static normalizeWorkspaceList(workspaces: unknown): ProjectWorkspace[] {
    if (!Array.isArray(workspaces)) {
      return [];
    }
    return workspaces
      .filter(isWorkspaceInput)
      .map((workspace) => ProjectWorkspaceStore.normalizeWorkspace(workspace));
  }
}
