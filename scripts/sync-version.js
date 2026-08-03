#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function syncVersion(rootDir = path.join(__dirname, '..')) {
  const packagePath = path.join(rootDir, 'package.json');
  const manifestPath = path.join(rootDir, 'manifest.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifestJson.version = packageJson.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n');

  return packageJson.version;
}

if (require.main === module) {
  console.log(`Synced version to ${syncVersion()}`);
}

module.exports = { syncVersion };
