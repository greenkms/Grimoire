import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const { syncVersion } = require('../../../scripts/sync-version.js') as {
  syncVersion(rootDir: string): string;
};
const {
  createReleaseNotes,
  extractChangelogSection,
  validateReleaseMetadata,
} = require('../../../scripts/releaseMetadata.js') as {
  createReleaseNotes(args: { changelog: string; version: string; previousTag?: string; repositoryUrl?: string }): string;
  extractChangelogSection(changelog: string, version: string): string | null;
  validateReleaseMetadata(rootDir: string): { version: string; errors: string[] };
};

function createFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), 'grimoire-release-metadata-'));
  writeFileSync(join(rootDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  writeFileSync(join(rootDir, 'manifest.json'), JSON.stringify({ version: '1.2.3', minAppVersion: '1.13.0' }));
  writeFileSync(join(rootDir, 'package-lock.json'), JSON.stringify({
    version: '1.2.3',
    packages: { '': { version: '1.2.3' } },
  }));
  writeFileSync(join(rootDir, 'versions.json'), JSON.stringify({ '1.2.3': '1.13.0', '1.2.2': '1.12.7' }));
  writeFileSync(join(rootDir, 'CHANGELOG.md'), '# Changelog\n\n## 1.2.3 - 2026-08-03\n\n- Current release\n\n## 1.2.2 - 2026-08-02\n\n- Previous release\n');
  return rootDir;
}

describe('release metadata scripts', () => {
  it('accepts aligned metadata and an exact changelog section', () => {
    const rootDir = createFixture();
    try {
      expect(validateReleaseMetadata(rootDir)).toEqual({ version: '1.2.3', errors: [] });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('reports missing and mismatched release metadata without changing files', () => {
    const rootDir = createFixture();
    try {
      writeFileSync(join(rootDir, 'manifest.json'), JSON.stringify({ version: '1.2.2', minAppVersion: '1.13.0' }));
      writeFileSync(join(rootDir, 'package-lock.json'), JSON.stringify({ version: '1.2.2', packages: { '': { version: '1.2.2' } } }));
      writeFileSync(join(rootDir, 'versions.json'), JSON.stringify({ '1.2.2': '1.12.7' }));
      writeFileSync(join(rootDir, 'CHANGELOG.md'), '# Changelog\n\n## 1.2.30 - 2026-08-03\n');

      expect(validateReleaseMetadata(rootDir).errors).toEqual(expect.arrayContaining([
        'manifest.json version (1.2.2) must match package.json (1.2.3).',
        'package-lock.json version (1.2.2) must match package.json (1.2.3).',
        'package-lock.json packages[""].version (1.2.2) must match package.json (1.2.3).',
        'versions.json[1.2.3] (missing) must match manifest.json minAppVersion (1.13.0).',
        'CHANGELOG.md must contain an exact ## 1.2.3 section.',
      ]));
      expect(readFileSync(join(rootDir, 'versions.json'), 'utf8')).toBe('{"1.2.2":"1.12.7"}');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('syncs only manifest version and preserves historical versions', () => {
    const rootDir = createFixture();
    try {
      writeFileSync(join(rootDir, 'manifest.json'), JSON.stringify({ version: '0.0.1', minAppVersion: '1.13.0' }));
      const beforeVersions = readFileSync(join(rootDir, 'versions.json'), 'utf8');

      expect(syncVersion(rootDir)).toBe('1.2.3');
      expect(JSON.parse(readFileSync(join(rootDir, 'manifest.json'), 'utf8')).version).toBe('1.2.3');
      expect(readFileSync(join(rootDir, 'versions.json'), 'utf8')).toBe(beforeVersions);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('extracts only the exact changelog release and preserves the compare footer', () => {
    const changelog = '# Changelog\n\n## 1.2.30 - 2026-08-03\n\n- Wrong release\n\n## 1.2.3 - 2026-08-02\n\n- Current release\n\n## 1.2.2 - 2026-08-01\n\n- Previous release\n';
    expect(extractChangelogSection(changelog, '1.2.3')).toBe('- Current release');
    expect(createReleaseNotes({
      changelog,
      version: '1.2.3',
      previousTag: '1.2.2',
      repositoryUrl: 'https://github.example/grimoire',
    })).toBe(
      'Grimoire 1.2.3\n\n- Current release\n\nChanges since [1.2.2](https://github.example/grimoire/compare/1.2.2...1.2.3).\n',
    );
  });

  it('rejects non-numeric tags and does not match a heading across lines', () => {
    expect(extractChangelogSection('## 1.2.3\n- release', 'v1.2.3')).toBeNull();
    expect(extractChangelogSection('## 1.2.3\n- release', '1.2')).toBeNull();
    expect(extractChangelogSection('## 1.2.3\n- release', '1.2.3')).toBe('- release');
    expect(() => createReleaseNotes({
      changelog: '## 1.2.3\n- release',
      version: '1.2.3',
      previousTag: 'v1.2.2',
      repositoryUrl: 'https://github.example/grimoire',
    })).toThrow('Previous release tag must be a numeric semver');
  });

  it('fails the checker in a fixture with unreconciled historical metadata', () => {
    const rootDir = createFixture();
    try {
      writeFileSync(join(rootDir, 'versions.json'), JSON.stringify({ '1.2.3': '1.12.7' }));
      const result = spawnSync(process.execPath, ['scripts/check-release-metadata.mjs', '--root', rootDir], {
        cwd: join(__dirname, '..', '..', '..'),
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Release metadata validation failed for 1.2.3');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
