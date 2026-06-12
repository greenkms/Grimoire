const { existsSync, readFileSync, readdirSync } = require('fs');
const { join } = require('path');

function findImportantDeclarations(inputs) {
  const findings = [];

  for (const input of inputs) {
    const contents = stripCssComments(input.contents);
    const lines = contents.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (!line.includes('!important')) {
        continue;
      }

      findings.push({
        file: input.file,
        line: index + 1,
        declaration: line.trim(),
      });
    }
  }

  return findings;
}

function collectReviewCssFiles(rootDir) {
  return [
    ...collectCssFiles(join(rootDir, 'src', 'style')),
    join(rootDir, 'styles.css'),
  ].filter((file) => existsSync(file));
}

function readReviewCssInputs(rootDir, relativePath) {
  return collectReviewCssFiles(rootDir).map((file) => ({
    file: relativePath(rootDir, file),
    contents: readFileSync(file, 'utf8'),
  }));
}

function collectCssFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCssFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(path);
    }
  }
  return files;
}

function stripCssComments(contents) {
  return contents.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, ''));
}

module.exports = {
  collectReviewCssFiles,
  findImportantDeclarations,
  readReviewCssInputs,
};
