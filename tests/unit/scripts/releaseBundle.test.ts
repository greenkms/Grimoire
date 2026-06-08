import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { createReleaseBundle } from '../../../scripts/releaseBundle.js';

describe('release bundle helpers', () => {
  it('copies installable Obsidian plugin files into a clean release folder', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'grimoire-release-'));
    const outputDir = join(rootDir, 'dist', 'grimoire');

    try {
      writeFileSync(join(rootDir, 'main.js'), 'main bundle');
      writeFileSync(join(rootDir, 'manifest.json'), '{"id":"grimoire"}');
      writeFileSync(join(rootDir, 'styles.css'), 'plugin styles');
      writeFileSync(join(rootDir, 'README.md'), 'not part of the release bundle');

      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, 'stale.txt'), 'stale release artifact');

      const result = createReleaseBundle({ rootDir, outputDir });

      expect(result).toEqual({
        outputDir,
        files: ['main.js', 'manifest.json', 'styles.css'],
      });
      expect(readdirSync(outputDir).sort()).toEqual([
        'main.js',
        'manifest.json',
        'styles.css',
      ]);
      expect(readFileSync(join(outputDir, 'main.js'), 'utf8')).toBe('main bundle');
      expect(readFileSync(join(outputDir, 'manifest.json'), 'utf8')).toBe('{"id":"grimoire"}');
      expect(readFileSync(join(outputDir, 'styles.css'), 'utf8')).toBe('plugin styles');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
