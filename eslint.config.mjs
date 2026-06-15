import jestPlugin from 'eslint-plugin-jest';
import obsidianmd from 'eslint-plugin-obsidianmd';
import { DEFAULT_ACRONYMS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js';
import { DEFAULT_BRANDS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig } from 'eslint/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const jestRecommended = jestPlugin.configs['flat/recommended'];
const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

const projectObsidianRuleOverrides = {
  'obsidianmd/ui/sentence-case': [
    'error',
    {
      ignoreWords: ['Grimoire', 'Codex', 'OpenCode', 'MiMoCode', 'Mimocode', 'WSL'],
      brands: [...DEFAULT_BRANDS, 'Grimoire', 'Codex', 'OpenCode', 'MiMoCode', 'Mimocode'],
      acronyms: [...DEFAULT_ACRONYMS, 'TOML', 'WSL'],
      ignoreRegex: ['\\.(?:claude|codex|opencode|mimocode)/'],
      enforceCamelCaseLower: true,
    },
  ],
};

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'main.js'],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['esbuild.config.mjs', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'none', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      ...projectObsidianRuleOverrides,
    },
  },
  {
    files: [
      'src/providers/claude/runtime/ClaudeChatRuntime.ts',
      'src/InlineEditService.ts',
      'src/InstructionRefineService.ts',
      'src/images/**/*.ts',
      'src/prompt/**/*.ts',
      'src/sdk/**/*.ts',
      'src/security/**/*.ts',
      'src/tools/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./ui', './ui/*', '../ui', '../ui/*'],
              message: 'Service and shared modules must not import UI modules.',
            },
            {
              group: ['./GrimoireView', '../GrimoireView'],
              message: 'Service and shared modules must not import the view.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...jestRecommended,
    rules: {
      ...jestRecommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
