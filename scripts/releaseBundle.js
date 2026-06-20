const { copyFileSync, existsSync, mkdirSync, rmSync, statSync } = require('fs');
const path = require('path');

const RELEASE_FILES = ['main.js', 'manifest.json', 'styles.css', 'CHANGELOG.md'];
const MAIN_JS_SYNC_STANDARD_LIMIT_BYTES = 5_000_000;

function formatBytes(value) {
  return value.toLocaleString('en-US');
}

function assertMainJsWithinSyncLimit(rootDir) {
  const mainPath = path.join(rootDir, 'main.js');
  const size = statSync(mainPath).size;
  if (size > MAIN_JS_SYNC_STANDARD_LIMIT_BYTES) {
    throw new Error(
      `main.js release asset is ${formatBytes(size)} bytes, exceeding the ` +
      `Obsidian Sync Standard ${formatBytes(MAIN_JS_SYNC_STANDARD_LIMIT_BYTES)} byte limit.`,
    );
  }
}

function createReleaseBundle({
  rootDir = process.cwd(),
  outputDir = path.join(rootDir, 'dist', 'grimoire'),
  files = RELEASE_FILES,
} = {}) {
  const missingFiles = files.filter((file) => !existsSync(path.join(rootDir, file)));

  if (missingFiles.length > 0) {
    throw new Error(`Missing release artifact(s): ${missingFiles.join(', ')}`);
  }
  assertMainJsWithinSyncLimit(rootDir);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  for (const file of files) {
    copyFileSync(path.join(rootDir, file), path.join(outputDir, file));
  }

  return {
    outputDir,
    files: [...files],
  };
}

module.exports = {
  RELEASE_FILES,
  createReleaseBundle,
};
