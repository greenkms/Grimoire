import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import {
  GeminiAgentStorage,
  parseGeminiAgentMarkdown,
  serializeGeminiAgentMarkdown,
} from '@/providers/gemini/storage/GeminiAgentStorage';

function createAdapter(initialFiles: Record<string, string>): VaultFileAdapter & { files: Record<string, string> } {
  const files = { ...initialFiles };
  return {
    files,
    exists: jest.fn(async (filePath: string) => (
      filePath in files || Object.keys(files).some((candidate) => candidate.startsWith(`${filePath}/`))
    )),
    read: jest.fn(async (filePath: string) => files[filePath]),
    write: jest.fn(async (filePath: string, content: string) => {
      files[filePath] = content;
    }),
    delete: jest.fn(async (filePath: string) => {
      delete files[filePath];
    }),
    ensureFolder: jest.fn(),
    listFiles: jest.fn(async (folder: string) => (
      Object.keys(files).filter((filePath) => filePath.startsWith(`${folder}/`))
    )),
  } as unknown as VaultFileAdapter & { files: Record<string, string> };
}

describe('GeminiAgentStorage', () => {
  const markdown = [
    '---',
    'name: security-auditor',
    'description: Finds vulnerabilities',
    'kind: local',
    'tools:',
    '  - read_file',
    'temperature: 0.2',
    'max_turns: 10',
    'custom: keep',
    '---',
    '',
    'Review code carefully.',
    '',
  ].join('\n');

  it('parses the official Markdown shape and preserves unknown frontmatter', () => {
    const agent = parseGeminiAgentMarkdown(markdown, '.gemini/agents/security-auditor.md');

    expect(agent).toEqual(expect.objectContaining({
      name: 'security-auditor',
      description: 'Finds vulnerabilities',
      kind: 'local',
      tools: ['read_file'],
      temperature: 0.2,
      maxTurns: 10,
      extraFrontmatter: { custom: 'keep' },
      prompt: 'Review code carefully.',
    }));
    expect(serializeGeminiAgentMarkdown(agent!)).toContain('custom: keep');
  });

  it('renames safely, rejects collisions, and deletes by persisted file path', async () => {
    const adapter = createAdapter({
      '.gemini/agents/security-auditor.md': markdown,
      '.gemini/agents/taken.md': markdown.replaceAll('security-auditor', 'taken'),
    });
    const storage = new GeminiAgentStorage(adapter);
    const original = (await storage.loadAll()).find((agent) => agent.name === 'security-auditor')!;

    await expect(storage.save({ ...original, name: 'taken', id: 'taken' }, original))
      .rejects.toThrow('already exists');
    await storage.save({ ...original, name: 'audit-agent', id: 'audit-agent' }, original);
    expect(adapter.files['.gemini/agents/security-auditor.md']).toBeUndefined();
    expect(adapter.files['.gemini/agents/audit-agent.md']).toContain('custom: keep');

    await storage.delete({ ...original, filePath: '.gemini/agents/audit-agent.md' });
    expect(adapter.files['.gemini/agents/audit-agent.md']).toBeUndefined();
  });
});
