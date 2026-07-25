import {
  isPathInExcludedFolder,
  normalizeExcludedFolder,
  normalizeExcludedFolders,
} from '@/core/context/exclusions';

describe('context exclusions', () => {
  it('normalizes vault-relative folder paths', () => {
    expect(normalizeExcludedFolder(' /Private\\Projects// ')).toBe('Private/Projects');
  });

  it('matches a folder and its descendants without matching similar prefixes', () => {
    const excludedFolders = ['/Private/'];

    expect(isPathInExcludedFolder('Private/Note.md', excludedFolders)).toBe(true);
    expect(isPathInExcludedFolder('Private/Nested/Note.md', excludedFolders)).toBe(true);
    expect(isPathInExcludedFolder('Private Notes/Note.md', excludedFolders)).toBe(false);
    expect(isPathInExcludedFolder('Public/Note.md', excludedFolders)).toBe(false);
  });

  it('ignores empty folder entries', () => {
    expect(isPathInExcludedFolder('Note.md', ['', '/', '  '])).toBe(false);
  });

  it('normalizes, de-duplicates, and removes empty folder entries', () => {
    expect(normalizeExcludedFolders([
      ' /Private/ ',
      'Private',
      '',
      'Archive\\Old',
    ])).toEqual(['Private', 'Archive/Old']);
  });
});
