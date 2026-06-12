#!/usr/bin/env node

const path = require('node:path');

const { verifyReleaseBundleLoads } = require('./verifyReleaseLoad.js');

const bundlePath = path.resolve(process.argv[2] ?? 'dist/grimoire/main.js');
verifyReleaseBundleLoads(bundlePath);
