const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}]+/gu;

interface TextTokenMatch {
  index: number;
  length: number;
}

export function normalizeSearchTerm(term: string): string {
  return Array.from(term.normalize('NFC').toLowerCase())
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .join('');
}

export function tokenizeSearchText(text: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const token = normalizeSearchTerm(match[0]);
    if (token.length === 0) {
      continue;
    }
    if (!seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
  }

  return tokens;
}

export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function extractBestSnippet(
  text: string,
  terms: string[],
  maxChars: number
): string {
  if (maxChars <= 0) {
    return '';
  }

  const normalizedTerms = terms
    .map((term) => normalizeSearchTerm(term))
    .filter((term) => term.length > 0);
  const firstMatch = findFirstMatchingToken(text, normalizedTerms);

  if (firstMatch === undefined) {
    return trimToSnippet(text.trim(), maxChars, false, text.trim().length > maxChars);
  }

  return buildMatchedSnippet(text, firstMatch, maxChars);
}

function findFirstMatchingToken(
  text: string,
  normalizedTerms: string[]
): TextTokenMatch | undefined {
  const termSet = new Set(normalizedTerms);
  let firstMatch: TextTokenMatch | undefined;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (!termSet.has(normalizeSearchTerm(match[0]))) {
      continue;
    }

    firstMatch =
      firstMatch === undefined || match.index < firstMatch.index
        ? { index: match.index, length: match[0].length }
        : firstMatch;
  }

  return firstMatch;
}

function buildMatchedSnippet(
  text: string,
  match: TextTokenMatch,
  maxChars: number
): string {
  const matchEnd = match.index + match.length;
  const needsPrefix = match.index > 0;
  const needsSuffix = matchEnd < text.length;
  const { prefix, suffix } = chooseSnippetMarkers(
    needsPrefix,
    needsSuffix,
    match.length,
    maxChars
  );
  const contentLimit = maxChars - prefix.length - suffix.length;
  const content = selectMatchedContent(text, match, contentLimit, prefix.length > 0);

  return `${prefix}${content}${suffix}`;
}

function chooseSnippetMarkers(
  needsPrefix: boolean,
  needsSuffix: boolean,
  matchLength: number,
  maxChars: number
): { prefix: string; suffix: string } {
  if (needsPrefix && needsSuffix) {
    if (maxChars >= matchLength + 6) {
      return { prefix: '...', suffix: '...' };
    }

    if (maxChars >= matchLength) {
      return { prefix: '', suffix: '' };
    }

    return maxChars > 3
      ? { prefix: '', suffix: '...' }
      : { prefix: '', suffix: '' };
  }

  if (needsPrefix && maxChars > 3) {
    if (maxChars >= matchLength + 3) {
      return { prefix: '...', suffix: '' };
    }

    return maxChars >= matchLength
      ? { prefix: '', suffix: '' }
      : { prefix: '...', suffix: '' };
  }

  if (needsSuffix && maxChars > 3) {
    if (maxChars >= matchLength + 3) {
      return { prefix: '', suffix: '...' };
    }

    return maxChars >= matchLength
      ? { prefix: '', suffix: '' }
      : { prefix: '', suffix: '...' };
  }

  return { prefix: '', suffix: '' };
}

function selectMatchedContent(
  text: string,
  match: TextTokenMatch,
  maxChars: number,
  includePreviousWord: boolean
): string {
  if (match.length >= maxChars) {
    return text.slice(match.index, match.index + maxChars);
  }

  let start = match.index;
  let end = match.index + match.length;

  if (includePreviousWord) {
    const previousStart = findPreviousWordStart(text, start);
    if (
      previousStart !== undefined &&
      text.slice(previousStart, end).trim().length <= maxChars
    ) {
      start = previousStart;
    }
  }

  let nextEnd = findNextWordEnd(text, end);
  while (
    nextEnd !== undefined &&
    text.slice(start, nextEnd).trim().length <= maxChars
  ) {
    end = nextEnd;
    nextEnd = findNextWordEnd(text, end);
  }

  return text.slice(start, end).trim();
}

function findPreviousWordStart(text: string, start: number): number | undefined {
  return text.slice(0, start).match(/\S+\s*$/u)?.index;
}

function findNextWordEnd(text: string, end: number): number | undefined {
  const nextWord = text.slice(end).match(/^\s*\S+/u);

  return nextWord === null ? undefined : end + nextWord[0].length;
}

function trimToSnippet(
  text: string,
  maxChars: number,
  hasPrefix: boolean,
  hasSuffix: boolean
): string {
  const prefix = hasPrefix && maxChars > 3 ? '...' : '';
  const suffix = hasSuffix && maxChars - prefix.length > 3 ? '...' : '';
  const contentLimit = Math.max(0, maxChars - prefix.length - suffix.length);
  const content = text.length <= contentLimit ? text : text.slice(0, contentLimit);

  return `${prefix}${content}${suffix}`;
}
