#!/usr/bin/env node
/**
 * Combined build script - runs CSS build then esbuild
 * Avoids npm echoing commands
 */

import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);

// Run CSS build silently
execFileSync(process.execPath, ['scripts/build-css.mjs', ...args], { cwd: ROOT, stdio: 'inherit' });

// Run esbuild with args passed through
execFileSync(process.execPath, ['esbuild.config.mjs', ...args], { cwd: ROOT, stdio: 'inherit' });
