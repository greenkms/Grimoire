import {
  escapeXmlAttribute,
  escapeXmlText,
  extractBestSnippet,
  normalizeSearchTerm,
} from './text';
import type {
  ContextSnippet,
  VaultSearchQuery,
  VaultSearchResult,
} from './types';
import type { VaultIndexedDocument, VaultTextIndex } from './VaultTextIndex';

const VAULT_MENTION_PATTERN = /(^|[^\p{L}\p{N}_@])@vault(?![\p{L}\p{N}_-])/u;
const FILE_MENTION_WITH_EXTENSION_PATTERN =
  /(^|\s)@(?=\S)[^\r\n@]*?\.[\p{L}\p{N}]{1,12}(?:[),.!?:;]+)?(?=$|\s)/gu;
const FILE_MENTION_PATTERN = /(^|\s)@[\p{L}\p{N}_/-]+/gu;
const BODY_SCORE_CAP = 8;

interface ScoredSnippet extends ContextSnippet {
  mtime: number;
}

export class VaultSearchService {
  constructor(private readonly index: VaultTextIndex) {}

  extractVaultQuery(input: string): string | null {
    const match = VAULT_MENTION_PATTERN.exec(input);
    if (match === null || match.index === undefined) {
      return null;
    }

    const mentionStart = match.index + match[1].length;
    const mentionEnd = mentionStart + '@vault'.length;
    const sameLineAfterMention = input.slice(mentionEnd).split(/\r?\n/u)[0];
    const queryAfterMention = stripFileMentions(sameLineAfterMention).trim();

    if (queryAfterMention.length > 0) {
      return queryAfterMention;
    }

    const fallback = stripFileMentions(
      `${input.slice(0, mentionStart)} ${input.slice(mentionEnd)}`
    ).trim();

    return fallback.length > 0 ? fallback : '';
  }

  async search(query: VaultSearchQuery): Promise<VaultSearchResult> {
    await this.index.refresh({
      excludedTags: query.excludedTags,
      excludedFolders: query.excludedFolders,
    });

    const normalizedTerms = query.terms
      .map((term) => normalizeSearchTerm(term))
      .filter((term) => term.length > 0);
    const documents = this.index.getAllDocuments();
    const maxMtime = Math.max(...documents.map((document) => document.mtime), 0);
    const minMtime = Math.min(...documents.map((document) => document.mtime), maxMtime);
    const scoredSnippets = documents
      .map((document) =>
        scoreDocument(document, normalizedTerms, query, minMtime, maxMtime)
      )
      .filter((snippet): snippet is ScoredSnippet => snippet !== null)
      .sort(compareSnippets)
      .slice(0, query.maxResults);
    const snippets = scoredSnippets.map(({ mtime: _mtime, ...snippet }, index) => ({
      ...snippet,
      source: {
        ...snippet.source,
        id: `v${index + 1}`,
      },
    }));

    return { query, snippets };
  }

  formatForPrompt(result: VaultSearchResult): string {
    const lines = [
      `<vault_search query="${escapeXmlAttribute(result.query.raw)}">`,
    ];

    for (const snippet of result.snippets) {
      lines.push(
        `  <source id="${escapeXmlAttribute(snippet.source.id)}" path="${escapeXmlAttribute(
          snippet.source.path
        )}" title="${escapeXmlAttribute(snippet.source.title)}" score="${snippet.score.toFixed(
          2
        )}">${escapeXmlText(snippet.text)}</source>`
      );
    }

    lines.push('</vault_search>');

    return lines.join('\n');
  }
}

function scoreDocument(
  document: VaultIndexedDocument,
  normalizedTerms: string[],
  query: VaultSearchQuery,
  minMtime: number,
  maxMtime: number
): ScoredSnippet | null {
  let score = 0;
  const matchedTerms = new Set<string>();
  const titleTerms = new Set(tokenizeField(document.title));
  const pathTerms = new Set(tokenizeField(document.path));
  const bodyTerms = tokenizeField(document.text);

  for (const term of normalizedTerms) {
    if (titleTerms.has(term)) {
      score += 8;
      matchedTerms.add(term);
    }

    if (pathTerms.has(term)) {
      score += 4;
      matchedTerms.add(term);
    }

    if (hasMatchingTag(document.tags, term)) {
      score += 5;
      matchedTerms.add(term);
    }
  }

  const bodyMatches = bodyTerms.filter((term) => normalizedTerms.includes(term));
  if (bodyMatches.length > 0) {
    score += Math.min(BODY_SCORE_CAP, bodyMatches.length);
    for (const term of bodyMatches) {
      matchedTerms.add(term);
    }
  }

  if (score <= 0) {
    return null;
  }

  score += recencyBoost(document.mtime, minMtime, maxMtime);

  return {
    source: {
      id: '',
      path: document.path,
      title: document.title,
      kind: 'vault-note',
    },
    text: extractBestSnippet(document.text, normalizedTerms, query.maxSnippetChars),
    score,
    matchedTerms: Array.from(matchedTerms),
    mtime: document.mtime,
  };
}

function compareSnippets(left: ScoredSnippet, right: ScoredSnippet): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const mtimeDelta = right.mtime - left.mtime;
  if (mtimeDelta !== 0) {
    return mtimeDelta;
  }

  return left.source.path.localeCompare(right.source.path);
}

function recencyBoost(mtime: number, minMtime: number, maxMtime: number): number {
  if (maxMtime <= minMtime) {
    return 1;
  }

  return (mtime - minMtime) / (maxMtime - minMtime);
}

function hasMatchingTag(tags: Set<string>, normalizedTerm: string): boolean {
  for (const tag of tags) {
    if (normalizeSearchTerm(tag) === normalizedTerm) {
      return true;
    }
  }

  return false;
}

function tokenizeField(text: string): string[] {
  const matches = text.matchAll(/[\p{L}\p{N}\p{M}]+/gu);

  return Array.from(matches, (match) => normalizeSearchTerm(match[0])).filter(
    (term) => term.length > 0
  );
}

function stripFileMentions(input: string): string {
  return input
    .replace(FILE_MENTION_WITH_EXTENSION_PATTERN, '$1 ')
    .replace(FILE_MENTION_PATTERN, '$1 ')
    .replace(/\s+/gu, ' ');
}
