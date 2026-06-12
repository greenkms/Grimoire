import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import reviewCss from "./reviewCss.js";

const { findImportantDeclarations, readReviewCssInputs } = reviewCss;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const inputs = readReviewCssInputs(ROOT, relative);
const findings = findImportantDeclarations(inputs);

if (findings.length === 0) {
  process.stdout.write("Obsidian review CSS check passed.\n");
} else {
  process.stderr.write("Obsidian review CSS check failed: avoid !important.\n");
  for (const finding of findings) {
    process.stderr.write(`- ${finding.file}:${finding.line} ${finding.declaration}\n`);
  }
  process.exitCode = 1;
}
