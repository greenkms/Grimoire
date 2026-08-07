import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import {
  createQwenAgentPersistenceKey,
  parseQwenAgentMarkdown,
  QwenAgentStorage,
  serializeQwenAgentMarkdown,
} from '@/providers/qwen/storage/QwenAgentStorage';

function adapter(files: Record<string, string>): VaultFileAdapter {
  return {
    exists: jest.fn(async (path: string) => path in files || Object.keys(files).some((file) => file.startsWith(`${path}/`))),
    read: jest.fn(async (path: string) => files[path]), write: jest.fn(), delete: jest.fn(), ensureFolder: jest.fn(),
    listFilesRecursive: jest.fn(async (folder: string) => Object.keys(files).filter((file) => file.startsWith(`${folder}/`))),
  } as unknown as VaultFileAdapter;
}

describe('QwenAgentStorage', () => {
  const markdown = '---\ndescription: Reviews changes\nmodel: qwen-max\ncustom: keep\n---\nReview carefully.\n';

  it('parses top-level agents and preserves unknown frontmatter through an edit', async () => {
    const parsed = parseQwenAgentMarkdown(markdown, '.qwen/agents/security.md');
    expect(parsed).toEqual(expect.objectContaining({
      name: 'security', description: 'Reviews changes', prompt: 'Review carefully.',
      extraFrontmatter: { model: 'qwen-max', custom: 'keep' },
    }));
    expect(serializeQwenAgentMarkdown(parsed!)).toContain('custom: keep');
  });

  it('ignores nested files and definitions rejected by the installed Qwen contract', async () => {
    expect(parseQwenAgentMarkdown(markdown, '.qwen/agents/review/security.md')).toBeNull();
    expect(parseQwenAgentMarkdown(markdown.replace('description:', 'name: self\ndescription:'), '.qwen/agents/self.md')).toBeNull();
    const mock = adapter({
      '.qwen/agents/direct.md': markdown,
      '.qwen/agents/nested/ignored.md': markdown,
    });
    await expect(new QwenAgentStorage(mock).loadAll()).resolves.toHaveLength(1);
  });

  it('renames without deleting an occupied target and deletes by persistence path', async () => {
    const mock = adapter({ '.qwen/agents/review.md': markdown, '.qwen/agents/taken.md': markdown });
    const storage = new QwenAgentStorage(mock);
    const previous = (await storage.loadAll())[0];
    await expect(storage.save({ ...previous, name: 'taken' }, previous)).rejects.toThrow('already exists');
    await storage.save({ ...previous, name: 'renamed' }, previous);
    expect(mock.write).toHaveBeenCalledWith('.qwen/agents/renamed.md', expect.any(String));
    expect(mock.delete).toHaveBeenCalledWith('.qwen/agents/review.md');
    await storage.delete({ ...previous, persistenceKey: createQwenAgentPersistenceKey('.qwen/agents/review.md') });
    expect(mock.delete).toHaveBeenCalledWith('.qwen/agents/review.md');
  });

  it('treats a case-only rename as an in-place rewrite on case-insensitive file systems', async () => {
    const mock = adapter({ '.qwen/agents/review.md': markdown });
    const exactExists = mock.exists as jest.Mock;
    (mock as { exists: jest.Mock }).exists = jest.fn(
      async (p: string) => exactExists(p.toLowerCase()),
    );
    const storage = new QwenAgentStorage(mock);
    const previous = (await storage.loadAll())[0];
    await expect(storage.save({ ...previous, name: 'Review' }, previous)).resolves.toBeUndefined();
    expect(mock.write).toHaveBeenCalledWith('.qwen/agents/Review.md', expect.any(String));
    expect(mock.delete).not.toHaveBeenCalled();
  });
});
