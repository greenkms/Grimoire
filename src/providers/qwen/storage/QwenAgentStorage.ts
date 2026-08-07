import * as path from 'node:path';

import { dump as dumpYaml } from 'js-yaml';

import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import { parseFrontmatter } from '../../../utils/frontmatter';
import type { QwenAgentDefinition } from '../types/agent';

export const QWEN_AGENTS_PATH = '.qwen/agents';
const PERSISTENCE_PREFIX = 'qwen-agent';
const QWEN_AGENT_NAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const RESERVED_AGENT_NAMES = new Set(['self', 'system', 'user', 'model', 'tool', 'config', 'default', 'main']);

type Adapter = Pick<VaultFileAdapter,
  'delete' | 'ensureFolder' | 'exists' | 'listFilesRecursive' | 'read' | 'write'>;

export function createQwenAgentPersistenceKey(filePath: string): string {
  return `${PERSISTENCE_PREFIX}:${encodeURIComponent(normalizePath(filePath))}`;
}

export function parseQwenAgentPersistenceKey(key?: string): string | null {
  if (!key) return null;
  const [prefix, encodedPath] = key.split(':');
  if (prefix !== PERSISTENCE_PREFIX || !encodedPath) return null;
  const filePath = normalizePath(decodeURIComponent(encodedPath));
  return isAgentPath(filePath) ? filePath : null;
}

export class QwenAgentStorage {
  constructor(private readonly adapter: Adapter) {}

  async loadAll(): Promise<QwenAgentDefinition[]> {
    try {
      const files = await this.adapter.listFilesRecursive(QWEN_AGENTS_PATH);
      const agents: QwenAgentDefinition[] = [];
      for (const filePath of files) {
        if (!isAgentPath(filePath)) continue;
        try {
          const agent = parseQwenAgentMarkdown(await this.adapter.read(filePath), filePath);
          if (agent) agents.push(agent);
        } catch {
          // A malformed user file must not hide other agents.
        }
      }
      return agents;
    } catch {
      return [];
    }
  }

  async load(agent: QwenAgentDefinition): Promise<QwenAgentDefinition | null> {
    const filePath = this.currentPath(agent);
    try {
      if (!(await this.adapter.exists(filePath))) return null;
      return parseQwenAgentMarkdown(await this.adapter.read(filePath), filePath);
    } catch {
      return null;
    }
  }

  async save(agent: QwenAgentDefinition, previous?: QwenAgentDefinition | null): Promise<void> {
    validateQwenAgentDefinition(agent);
    const targetPath = this.targetPath(agent, previous);
    const previousPath = previous ? this.currentPath(previous) : null;
    // Case-only renames resolve to the previous file itself on case-insensitive
    // file systems; treat that as an in-place rewrite rather than a conflict.
    const targetExists = (!previousPath || previousPath !== targetPath)
      ? await this.adapter.exists(targetPath)
      : false;
    const renamesSameFile = !!previousPath
      && previousPath !== targetPath
      && previousPath.toLowerCase() === targetPath.toLowerCase()
      && targetExists;
    if (targetExists && !renamesSameFile) {
      throw new Error(`An agent already exists at ${targetPath}.`);
    }
    await this.adapter.ensureFolder(path.posix.dirname(targetPath));
    await this.adapter.write(targetPath, serializeQwenAgentMarkdown(agent));
    if (previousPath && previousPath !== targetPath && !renamesSameFile) {
      await this.adapter.delete(previousPath);
    }
  }

  async delete(agent: QwenAgentDefinition): Promise<void> {
    await this.adapter.delete(this.currentPath(agent));
  }

  private currentPath(agent: QwenAgentDefinition): string {
    return parseQwenAgentPersistenceKey(agent.persistenceKey) ?? `${QWEN_AGENTS_PATH}/${agent.name}.md`;
  }

  private targetPath(agent: QwenAgentDefinition, previous?: QwenAgentDefinition | null): string {
    return previous && previous.name === agent.name
      ? this.currentPath(previous)
      : `${QWEN_AGENTS_PATH}/${agent.name}.md`;
  }
}

export function parseQwenAgentMarkdown(content: string, filePath: string): QwenAgentDefinition | null {
  if (!isAgentPath(filePath)) return null;
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const fallbackName = relativeName(filePath);
  const name = typeof parsed.frontmatter.name === 'string' && parsed.frontmatter.name.trim()
    ? parsed.frontmatter.name.trim() : fallbackName;
  const description = typeof parsed.frontmatter.description === 'string'
    ? parsed.frontmatter.description.trim() : '';
  const prompt = parsed.body.trim();
  if (!isValidQwenAgentName(name) || !description || prompt.length < 10) return null;
  const { name: _name, description: _description, ...extraFrontmatter } = parsed.frontmatter;
  return {
    name,
    description,
    prompt,
    persistenceKey: createQwenAgentPersistenceKey(filePath),
    ...(Object.keys(extraFrontmatter).length > 0 ? { extraFrontmatter } : {}),
  };
}

export function serializeQwenAgentMarkdown(agent: QwenAgentDefinition): string {
  const frontmatter = { name: agent.name, description: agent.description, ...agent.extraFrontmatter };
  return `---\n${dumpYaml(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd()}\n---\n${agent.prompt}\n`;
}

function relativeName(filePath: string): string {
  return normalizePath(filePath).slice(`${QWEN_AGENTS_PATH}/`.length).replace(/\.md$/i, '');
}

function normalizePath(filePath: string): string { return filePath.replace(/\\/g, '/'); }
function isAgentPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${QWEN_AGENTS_PATH}/`) || !normalized.toLowerCase().endsWith('.md')) return false;
  return !normalized.slice(`${QWEN_AGENTS_PATH}/`.length).includes('/');
}

export function isValidQwenAgentName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === name
    && trimmed.length >= 2
    && trimmed.length <= 50
    && QWEN_AGENT_NAME_PATTERN.test(trimmed)
    && !trimmed.startsWith('-')
    && !trimmed.startsWith('_')
    && !trimmed.endsWith('-')
    && !trimmed.endsWith('_')
    && !RESERVED_AGENT_NAMES.has(trimmed.toLowerCase());
}

function validateQwenAgentDefinition(agent: QwenAgentDefinition): void {
  if (!isValidQwenAgentName(agent.name)) throw new Error('Invalid Qwen agent name.');
  if (!agent.description.trim()) throw new Error('Qwen agent description is required.');
  if (agent.prompt.trim().length < 10) throw new Error('Qwen agent prompt must be at least 10 characters.');
}
