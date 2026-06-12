import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import reviewSource from "./reviewSource.js";

const { getReviewSourceEslintArgs } = reviewSource;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const eslintBin = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

execFileSync(process.execPath, [eslintBin, ...getReviewSourceEslintArgs()], {
  cwd: ROOT,
  stdio: "inherit",
});
