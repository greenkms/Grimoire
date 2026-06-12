import { readFileSync } from 'fs';

import { findImportantDeclarations } from '../../../scripts/reviewCss.js';
import { getReviewSourceEslintArgs } from '../../../scripts/reviewSource.js';

interface PackageJson {
  scripts: Record<string, string>;
}

interface CssImportantFinding {
  declaration: string;
  file: string;
  line: number;
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
}

describe('Obsidian review gate', () => {
  it('runs source, CSS, and dependency review checks before release builds', () => {
    const scripts = readPackageJson().scripts;

    expect(scripts['review:source']).toBe('node scripts/check-review-source.mjs');
    expect(scripts['review:css']).toBe('node scripts/check-review-css.mjs');
    expect(scripts['prebuild:release']).toBe('npm run lint && npm run review:source && npm run review:css && npm run review:deps');
  });

  it('passes Obsidian source-review rules to eslint without shell quoting', () => {
    const args = getReviewSourceEslintArgs();

    expect(args).toEqual(expect.arrayContaining([
      'src/**/*.ts',
      '--max-warnings=0',
      '--rule',
      '@typescript-eslint/no-deprecated:error',
      '@typescript-eslint/no-unsafe-assignment:error',
      '@typescript-eslint/no-unsafe-return:error',
      '@typescript-eslint/no-unsafe-call:error',
      '@typescript-eslint/no-unsafe-member-access:error',
      '@typescript-eslint/no-unsafe-argument:error',
    ]));
    expect(args.some((arg) => arg.includes("'"))).toBe(false);
  });

  it('reports important CSS declarations but ignores comments', () => {
    const findings = findImportantDeclarations([
      {
        file: 'src/style/example.css',
        contents: [
          '.example {',
          '  color: var(--text-normal) !important;',
          '  background: transparent;',
          '}',
          '/* docs: avoid !important in new styles */',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      {
        declaration: 'color: var(--text-normal) !important;',
        file: 'src/style/example.css',
        line: 2,
      },
    ]);
  });
});
