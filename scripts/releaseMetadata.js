const fs = require('node:fs');
const path = require('node:path');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isReleaseVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function extractChangelogSection(changelog, version) {
  if (!isReleaseVersion(version)) {
    return null;
  }

  const heading = new RegExp(
    `^## ${escapeRegExp(version)}(?:[ \\t]+-[ \\t]+[^\\r\\n]+)?[ \\t]*$`,
    'm',
  );
  const match = heading.exec(changelog);
  if (!match) {
    return null;
  }

  const sectionStart = match.index + match[0].length;
  const nextHeading = /^## /m;
  const nextMatch = nextHeading.exec(changelog.slice(sectionStart));
  const sectionEnd = nextMatch ? sectionStart + nextMatch.index : changelog.length;

  return changelog.slice(sectionStart, sectionEnd).trim();
}

function validateReleaseMetadata(rootDir) {
  const readJson = (filename) => JSON.parse(fs.readFileSync(path.join(rootDir, filename), 'utf8'));
  const packageJson = readJson('package.json');
  const manifest = readJson('manifest.json');
  const lockfile = readJson('package-lock.json');
  const versions = readJson('versions.json');
  const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
  const version = packageJson.version;
  const errors = [];

  if (!isReleaseVersion(version)) {
    errors.push(`package.json version (${version}) must be a numeric semver such as 1.2.3.`);
  }
  if (manifest.version !== version) {
    errors.push(`manifest.json version (${manifest.version}) must match package.json (${version}).`);
  }
  if (lockfile.version !== version) {
    errors.push(`package-lock.json version (${lockfile.version}) must match package.json (${version}).`);
  }
  if (lockfile.packages?.['']?.version !== version) {
    errors.push(`package-lock.json packages[\"\"].version (${lockfile.packages?.['']?.version ?? 'missing'}) must match package.json (${version}).`);
  }
  if (versions[version] !== manifest.minAppVersion) {
    errors.push(`versions.json[${version}] (${versions[version] ?? 'missing'}) must match manifest.json minAppVersion (${manifest.minAppVersion}).`);
  }
  if (isReleaseVersion(version) && extractChangelogSection(changelog, version) === null) {
    errors.push(`CHANGELOG.md must contain an exact ## ${version} section.`);
  }

  return { version, errors };
}

function createReleaseNotes({ changelog, version, previousTag, repositoryUrl }) {
  if (!isReleaseVersion(version)) {
    throw new Error(`Release version must be a numeric semver, received: ${version}.`);
  }
  if (previousTag && !isReleaseVersion(previousTag)) {
    throw new Error(`Previous release tag must be a numeric semver, received: ${previousTag}.`);
  }

  const section = extractChangelogSection(changelog, version);
  if (section === null) {
    throw new Error(`CHANGELOG.md must contain an exact ## ${version} section.`);
  }

  const lines = [`Grimoire ${version}`, '', section];
  if (previousTag) {
    lines.push('', `Changes since [${previousTag}](${repositoryUrl}/compare/${previousTag}...${version}).`);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  createReleaseNotes,
  extractChangelogSection,
  isReleaseVersion,
  validateReleaseMetadata,
};
