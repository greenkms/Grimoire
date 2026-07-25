import { spawnSync } from 'node:child_process';

const ALLOWED_ADVISORY_URLS = new Set([
  'https://github.com/advisories/GHSA-frvp-7c67-39w9',
]);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) {
  process.stderr.write(`Runtime dependency audit failed to start: ${result.error.message}\n`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write('Runtime dependency audit returned invalid JSON.\n');
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const vulnerabilityNames = Object.keys(vulnerabilities);

if (vulnerabilityNames.length === 0) {
  process.stdout.write('Runtime dependency audit passed with zero vulnerabilities.\n');
  process.exit(0);
}

const allowedCache = new Map();

function isAllowedVulnerability(name, visiting = new Set()) {
  if (allowedCache.has(name)) {
    return allowedCache.get(name);
  }

  if (visiting.has(name)) {
    return false;
  }

  const vulnerability = vulnerabilities[name];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    allowedCache.set(name, false);
    return false;
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(name);

  const allowed = vulnerability.via.every((source) => {
    if (typeof source === 'string') {
      return isAllowedVulnerability(source, nextVisiting);
    }

    return (
      source
      && typeof source === 'object'
      && typeof source.url === 'string'
      && ALLOWED_ADVISORY_URLS.has(source.url)
    );
  });

  allowedCache.set(name, allowed);
  return allowed;
}

const unexpected = vulnerabilityNames.filter((name) => !isAllowedVulnerability(name));

if (unexpected.length > 0) {
  process.stderr.write('Runtime dependency audit found unexpected vulnerabilities:\n');
  for (const name of unexpected) {
    const vulnerability = vulnerabilities[name];
    process.stderr.write(`- ${name}: ${vulnerability.severity ?? 'unknown severity'}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Runtime dependency audit passed with one documented upstream advisory chain (${vulnerabilityNames.join(', ')}).\n`,
);
