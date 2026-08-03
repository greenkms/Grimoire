#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createReleaseNotes } = require('./releaseMetadata.js');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const tag = argument('--tag');
const output = argument('--output');
if (!tag || !output) {
  throw new Error('Usage: generate-release-notes.mjs --tag <version> --output <path> [--previous-tag <version>]');
}

writeFileSync(output, createReleaseNotes({
  changelog: readFileSync('CHANGELOG.md', 'utf8'),
  version: tag,
  previousTag: argument('--previous-tag'),
  repositoryUrl: `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`,
}));
