#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);
const { createReleaseBundle } = require('./releaseBundle.js');

execFileSync(process.execPath, ['scripts/sync-version.js'], {
  cwd: ROOT,
  stdio: 'inherit',
});

execFileSync(process.execPath, ['scripts/build.mjs', 'production'], {
  cwd: ROOT,
  stdio: 'inherit',
});

const result = createReleaseBundle({ rootDir: ROOT });
execFileSync(process.execPath, ['scripts/verify-release-load.cjs', join(result.outputDir, 'main.js')], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log(`Built release bundle: ${result.outputDir}`);
