import { RelevantNotesService } from '@/core/context/RelevantNotesService';
import type { RelevantNote } from '@/core/context/types';
import type { VaultIndexedDocument } from '@/core/context/VaultTextIndex';

function document(
  path: string,
  overrides: Partial<VaultIndexedDocument> = {},
): VaultIndexedDocument {
  const title = path.split('/').pop()?.replace(/\.md$/u, '') ?? path;

  return {
    path,
    title,
    text: '',
    terms: new Set(),
    tags: new Set(),
    links: new Set(),
    mtime: 0,
    ...overrides,
  };
}

function createService(documents: VaultIndexedDocument[]): RelevantNotesService {
  return new RelevantNotesService({
    getByPath: (path: string) => documents.find(doc => doc.path === path) ?? null,
    getAllDocuments: () => documents,
  });
}

function paths(notes: RelevantNote[]): string[] {
  return notes.map(note => note.path);
}

describe('RelevantNotesService', () => {
  it('ranks outlinks with shared tags, folder, and text first', () => {
    const service = createService([
      document('projects/A.md', {
        terms: new Set(['alpha', 'shared', 'roadmap']),
        tags: new Set(['project', 'priority']),
        links: new Set(['projects/B.md']),
      }),
      document('projects/B.md', {
        terms: new Set(['shared', 'roadmap', 'beta']),
        tags: new Set(['project']),
      }),
      document('archive/C.md', {
        terms: new Set(['shared']),
        tags: new Set(['archive']),
      }),
    ]);

    const result = service.findRelevantNotes('projects/A.md', { maxResults: 3 });

    expect(paths(result)).toEqual(['projects/B.md', 'archive/C.md']);
    expect(result[0]).toMatchObject({
      path: 'projects/B.md',
      title: 'B',
      score: 19,
    });
    expect(result[0].reasons).toEqual(['outlink', 'tag', 'folder', 'text']);
  });

  it('scores backlinks to the current note', () => {
    const service = createService([
      document('current/A.md'),
      document('linked/B.md', {
        links: new Set(['current/A.md']),
      }),
    ]);

    const result = service.findRelevantNotes('current/A.md', { maxResults: 5 });

    expect(result).toEqual([
      {
        path: 'linked/B.md',
        title: 'B',
        score: 10,
        reasons: ['backlink'],
      },
    ]);
  });

  it('limits results after deterministic sorting', () => {
    const service = createService([
      document('notes/A.md', {
        tags: new Set(['shared']),
      }),
      document('notes/C.md', {
        tags: new Set(['shared']),
      }),
      document('notes/B.md', {
        tags: new Set(['shared']),
      }),
    ]);

    const result = service.findRelevantNotes('notes/A.md', { maxResults: 1 });

    expect(paths(result)).toEqual(['notes/B.md']);
  });
});
