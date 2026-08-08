import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import reviewCss from "./reviewCss.js";

const {
  findImportantDeclarations,
  findPartialCssSupportFeatures,
  readReviewCssInputs,
} = reviewCss;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const inputs = readReviewCssInputs(ROOT, relative);
const importantFindings = findImportantDeclarations(inputs);
const partialSupportFindings = findPartialCssSupportFeatures(inputs);
let failed = false;

if (importantFindings.length > 0) {
  failed = true;
  process.stderr.write("Obsidian review CSS check failed: avoid !important.\n");
  for (const finding of importantFindings) {
    process.stderr.write(`- ${finding.file}:${finding.line} ${finding.declaration}\n`);
  }
}

if (partialSupportFindings.length > 0) {
  failed = true;
  process.stderr.write(
    "Obsidian review CSS check failed: avoid CSS features only partially supported by Obsidian's review baseline.\n",
  );
  for (const finding of partialSupportFindings) {
    process.stderr.write(
      `- ${finding.file}:${finding.line} [${finding.featureId}] ${finding.declaration}\n  ${finding.message}\n`,
    );
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  process.stdout.write("Obsidian review CSS check passed.\n");
}
