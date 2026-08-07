import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import {
  GeminiCommandCatalog,
  parseGeminiCommandDocument,
} from '@/providers/gemini/commands/GeminiCommandCatalog';

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
    listFilesRecursive: jest.fn(async (folder: string) => (
      Object.keys(files).filter((filePath) => filePath.startsWith(`${folder}/`))
    )),
    listFiles: jest.fn(async () => []),
    listFolders: jest.fn(async () => []),
    rename: jest.fn(),
    deleteFolderRecursive: jest.fn(),
  } as unknown as VaultFileAdapter & { files: Record<string, string> };
}

describe('GeminiCommandCatalog', () => {
  it('loads nested TOML commands and preserves unknown fields through rename and edit', async () => {
    const adapter = createAdapter({
      '.gemini/commands/review/security.toml': [
        'prompt = "Review $ARGUMENTS"',
        'description = "Security review"',
        'custom = "keep"',
        '',
        '[metadata]',
        'owner = "team"',
        '',
      ].join('\n'),
    });
    const catalog = new GeminiCommandCatalog(adapter);
    const [entry] = (await catalog.listVaultEntries()).filter((candidate) => candidate.kind === 'command');

    expect(entry).toEqual(expect.objectContaining({
      name: 'review:security',
      content: 'Review $ARGUMENTS',
      description: 'Security review',
      isEditable: true,
    }));

    await catalog.saveVaultEntry({
      ...entry,
      name: 'audit:security',
      content: 'Audit $ARGUMENTS',
      description: 'Audit security',
    });

    expect(adapter.files['.gemini/commands/review/security.toml']).toBeUndefined();
    const saved = parseGeminiCommandDocument(adapter.files['.gemini/commands/audit/security.toml']);
    expect(saved).toEqual({
      prompt: 'Audit $ARGUMENTS',
      description: 'Audit security',
      custom: 'keep',
      metadata: { owner: 'team' },
    });
  });

  it('rejects a rename collision and exposes vault commands in the dropdown', async () => {
    const adapter = createAdapter({
      '.gemini/commands/review.toml': 'prompt = "Review"\n',
      '.gemini/commands/taken.toml': 'prompt = "Taken"\n',
    });
    const catalog = new GeminiCommandCatalog(adapter);
    const entries = (await catalog.listVaultEntries()).filter((entry) => entry.kind === 'command');
    const review = entries.find((entry) => entry.name === 'review')!;

    await expect(catalog.saveVaultEntry({ ...review, name: 'taken' }))
      .rejects.toThrow('already exists');
    await expect(catalog.listDropdownEntries({ includeBuiltIns: false }))
      .resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'review', scope: 'vault' }),
        expect.objectContaining({ name: 'taken', scope: 'vault' }),
      ]));
  });
});
