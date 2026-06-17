import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lockfilePath = resolve(__dirname, "../package-lock.json");
const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));

const advisories = [
  {
    packageName: "hono",
    vulnerableRange: "<4.12.25",
    advisory: "GHSA-26pp-8wgv-hjvm / GHSA-r5rp-j6wh-rvv4 / GHSA-xf4j-xp2r-rqqx / GHSA-wmmm-f939-6g9c / GHSA-458j-xx4x-4375 / GHSA-xpcf-pg52-r92g / GHSA-qp7p-654g-cw7p / GHSA-hm8q-7f3q-5f36 / GHSA-p77w-8qqv-26rm / GHSA-9vqf-7f2p-gf9v / GHSA-69xw-7hcm-h432 / GHSA-xrhx-7g5j-rcj5 / GHSA-3hrh-pfw6-9m5x / GHSA-f577-qrjj-4474 / GHSA-2gcr-mfcq-wcc3 / GHSA-wwfh-h76j-fc44 / GHSA-j6c9-x7qj-28xf / GHSA-88fw-hqm2-52qc / GHSA-rv63-4mwf-qqc2 / GHSA-wgpf-jwqj-8h8p",
    isVulnerable: (version) => lessThan(version, "4.12.25"),
  },
  {
    packageName: "@hono/node-server",
    vulnerableRange: "<1.19.13",
    advisory: "GHSA-92pp-h63x-v22m",
    isVulnerable: (version) => lessThan(version, "1.19.13"),
  },
  {
    packageName: "fast-uri",
    vulnerableRange: "<=3.1.1",
    advisory: "GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc",
    isVulnerable: (version) => lessThanOrEqual(version, "3.1.1"),
  },
  {
    packageName: "ip-address",
    vulnerableRange: "<=10.1.0",
    advisory: "GHSA-v2v4-37r5-5v8g",
    isVulnerable: (version) => lessThanOrEqual(version, "10.1.0"),
  },
  {
    packageName: "brace-expansion",
    vulnerableRange: ">=5.0.0 <5.0.6",
    advisory: "GHSA-jxxr-4gwj-5jf2",
    isVulnerable: (version) => greaterThanOrEqual(version, "5.0.0") && lessThan(version, "5.0.6"),
  },
  {
    packageName: "ws",
    vulnerableRange: ">=8.0.0 <8.20.1",
    advisory: "GHSA-58qx-3vcg-4xpx",
    isVulnerable: (version) => greaterThanOrEqual(version, "8.0.0") && lessThan(version, "8.20.1"),
  },
  {
    packageName: "@anthropic-ai/sdk",
    vulnerableRange: ">=0.79.0 <0.91.1",
    advisory: "GHSA-p7fg-763f-g4gf",
    isVulnerable: (version) => greaterThanOrEqual(version, "0.79.0") && lessThan(version, "0.91.1"),
  },
  {
    packageName: "qs",
    vulnerableRange: ">=6.11.1 <=6.15.1",
    advisory: "GHSA-q8mj-m7cp-5q26",
    isVulnerable: (version) => greaterThanOrEqual(version, "6.11.1") && lessThanOrEqual(version, "6.15.1"),
  },
];

const packages = Object.entries(lockfile.packages ?? {})
  .filter(([path]) => path !== "")
  .map(([path, data]) => ({
    path,
    packageName: packageNameFromLockfilePath(path),
    version: data.version,
  }))
  .filter((entry) => typeof entry.version === "string");

const failures = [];

for (const advisory of advisories) {
  for (const entry of packages.filter((item) => item.packageName === advisory.packageName)) {
    if (advisory.isVulnerable(entry.version)) {
      failures.push({ ...entry, advisory });
    }
  }
}

if (failures.length > 0) {
  process.stderr.write("Obsidian review dependency check failed:\n");
  for (const failure of failures) {
    process.stderr.write(
      `- ${failure.packageName}@${failure.version} at ${failure.path} matches ${failure.advisory.vulnerableRange} (${failure.advisory.advisory})\n`,
    );
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Obsidian review dependency check passed.\n");
}

function packageNameFromLockfilePath(path) {
  const segments = path.split("/node_modules/");
  const packagePath = segments[segments.length - 1] ?? "";
  const parts = packagePath.split("/");

  if (parts[0]?.startsWith("@")) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

function lessThan(version, target) {
  return compareVersions(version, target) < 0;
}

function lessThanOrEqual(version, target) {
  return compareVersions(version, target) <= 0;
}

function greaterThanOrEqual(version, target) {
  return compareVersions(version, target) >= 0;
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

function versionParts(version) {
  return version
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}
