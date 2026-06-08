import type { App, TFile } from 'obsidian';

import { VaultTextIndex } from '@/core/context/VaultTextIndex';

function createFile(path: string, mtime: number): TFile {
  const basename = path.split('/').pop()?.replace(/\.md$/u, '') ?? path;

  return {
    path,
    name: `${basename}.md`,
    basename,
    stat: { mtime, ctime: mtime, size: 0 },
  } as TFile;
}

function createApp(options: {
  files: TFile[];
  contents: Record<string, string>;
  caches?: Record<string, any>;
}): App {
  return {
    vault: {
      getMarkdownFiles: jest.fn(() => options.files),
      cachedRead: jest.fn((file: TFile) =>
        Promise.resolve(options.contents[file.path] ?? '')
      ),
    },
    metadataCache: {
      getFileCache: jest.fn((file: TFile) => options.caches?.[file.path] ?? null),
    },
  } as unknown as App;
}

describe('VaultTextIndex', () => {
  it('indexes markdown files and excludes configured tags', async () => {
    const publicFile = createFile('notes/Public.md', 100);
    const privateFile = createFile('notes/Private.md', 200);
    const app = createApp({
      files: [publicFile, privateFile],
      contents: {
        'notes/Public.md': 'Public roadmap note',
        'notes/Private.md': 'Private strategy note',
      },
      caches: {
        'notes/Private.md': {
          tags: [{ tag: '#secret', position: {} }],
        },
      },
    });
    const index = new VaultTextIndex(app);

    await index.refresh({ excludedTags: ['#secret'] });

    expect(index.getAllDocuments()).toHaveLength(1);
    expect(index.getByPath('notes/Public.md')).toMatchObject({
      path: 'notes/Public.md',
      title: 'Public',
      text: 'Public roadmap note',
      mtime: 100,
    });
    expect(index.getByPath('notes/Private.md')).toBeNull();
  });

  it('normalizes frontmatter array, frontmatter string, and inline cache tags', async () => {
    const arrayFile = createFile('notes/Array.md', 100);
    const stringFile = createFile('notes/String.md', 200);
    const app = createApp({
      files: [arrayFile, stringFile],
      contents: {
        'notes/Array.md': 'Array tags',
        'notes/String.md': 'String tags',
      },
      caches: {
        'notes/Array.md': {
          frontmatter: { tags: ['#Project', 'planning'] },
          tags: [{ tag: '#inline', position: {} }],
        },
        'notes/String.md': {
          frontmatter: { tags: '#solo' },
        },
      },
    });
    const index = new VaultTextIndex(app);

    await index.refresh({ excludedTags: [] });

    expect(index.getByPath('notes/Array.md')?.tags).toEqual(
      new Set(['Project', 'planning', 'inline'])
    );
    expect(index.getByPath('notes/String.md')?.tags).toEqual(new Set(['solo']));
  });

  it('captures links from metadata cache', async () => {
    const file = createFile('notes/Links.md', 100);
    const app = createApp({
      files: [file],
      contents: { 'notes/Links.md': 'Links note' },
      caches: {
        'notes/Links.md': {
          links: [
            { link: 'Roadmap', original: '[[Roadmap]]', position: {} },
            { link: 'folder/Spec', original: '[[folder/Spec]]', position: {} },
          ],
        },
      },
    });
    const index = new VaultTextIndex(app);

    await index.refresh({ excludedTags: [] });

    expect(index.getByPath('notes/Links.md')?.links).toEqual(
      new Set(['Roadmap', 'folder/Spec'])
    );
  });

  it('removes a single current document when marking a path dirty', async () => {
    const firstFile = createFile('notes/First.md', 100);
    const secondFile = createFile('notes/Second.md', 200);
    const index = new VaultTextIndex(
      createApp({
        files: [firstFile, secondFile],
        contents: {
          'notes/First.md': 'First note',
          'notes/Second.md': 'Second note',
        },
      })
    );

    await index.refresh({ excludedTags: [] });
    index.markDirty('notes/First.md');

    expect(index.getByPath('notes/First.md')).toBeNull();
    expect(index.getByPath('notes/Second.md')).not.toBeNull();
  });

  it('clears all current documents when marking the full index dirty', async () => {
    const firstFile = createFile('notes/First.md', 100);
    const secondFile = createFile('notes/Second.md', 200);
    const index = new VaultTextIndex(
      createApp({
        files: [firstFile, secondFile],
        contents: {
          'notes/First.md': 'First note',
          'notes/Second.md': 'Second note',
        },
      })
    );

    await index.refresh({ excludedTags: [] });
    index.markDirty();

    expect(index.getAllDocuments()).toEqual([]);
    expect(index.getByPath('notes/First.md')).toBeNull();
    expect(index.getByPath('notes/Second.md')).toBeNull();
  });
});
