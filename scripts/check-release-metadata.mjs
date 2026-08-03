#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { validateReleaseMetadata } = require('./releaseMetadata.js');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootArgument = process.argv.indexOf('--root');
const rootDir = rootArgument === -1
  ? resolve(scriptDir, '..')
  : resolve(process.argv[rootArgument + 1]);

const { errors, version } = validateReleaseMetadata(rootDir);
if (errors.length > 0) {
  console.error(`Release metadata validation failed for ${version}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Release metadata is valid for ${version}.`);
}
