#!/usr/bin/env node

const path = require('node:path');

const { verifyReleaseBundleOpensView } = require('./verifyReleaseLoad.js');

const bundlePath = path.resolve(process.argv[2] ?? 'dist/grimoire/main.js');

verifyReleaseBundleOpensView(bundlePath).catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
