import { parseChangelogRelease } from '@/app/changelog/parser';

const sample = `# Changelog

## 1.0.23 - 2026-06-20

### Added

- Added item one.
- Added item two.

### Improved

- Improved item.

### Fixed

- Fixed item.

### Internal

- Maintainer-only detail.

## 1.0.22 - 2026-06-19

### Fixed

- Older fix.
`;

describe('parseChangelogRelease', () => {
  it('parses supported categories for the requested version', () => {
    expect(parseChangelogRelease(sample, '1.0.23')).toEqual({
      version: '1.0.23',
      date: '2026-06-20',
      categories: [
        { title: 'Added', items: ['Added item one.', 'Added item two.'] },
        { title: 'Improved', items: ['Improved item.'] },
        { title: 'Fixed', items: ['Fixed item.'] },
      ],
    });
  });

  it('ignores unsupported categories', () => {
    const release = parseChangelogRelease(sample, '1.0.23');
    expect(release?.categories.map(category => category.title)).toEqual([
      'Added',
      'Improved',
      'Fixed',
    ]);
  });

  it('returns null when the version is absent', () => {
    expect(parseChangelogRelease(sample, '9.9.9')).toBeNull();
  });

  it('returns null when the version has no supported items', () => {
    expect(parseChangelogRelease('## 1.0.24\n\n### Internal\n\n- Hidden.', '1.0.24')).toBeNull();
  });
});
