import { normalizeSearchTerm } from './text';
import type { RelevantNote } from './types';
import type { VaultIndexedDocument, VaultTextIndex } from './VaultTextIndex';

export interface RelevantNotesOptions {
  maxResults: number;
}

type RelevantReason = RelevantNote['reasons'][number];

interface ScoredRelevantNote extends RelevantNote {
  title: string;
}

export class RelevantNotesService {
  constructor(
    private readonly index: Pick<VaultTextIndex, 'getByPath' | 'getAllDocuments'>,
  ) {}

  findRelevantNotes(currentPath: string, options: RelevantNotesOptions): RelevantNote[] {
    const current = this.index.getByPath(currentPath);
    if (!current || options.maxResults <= 0) {
      return [];
    }

    return this.index.getAllDocuments()
      .filter(candidate => candidate.path !== current.path)
      .map(candidate => scoreCandidate(current, candidate))
      .filter((note): note is ScoredRelevantNote => note !== null)
      .sort(compareRelevantNotes)
      .slice(0, options.maxResults)
      .map(({ path, title, score, reasons }) => ({ path, title, score, reasons }));
  }
}

function scoreCandidate(
  current: VaultIndexedDocument,
  candidate: VaultIndexedDocument,
): ScoredRelevantNote | null {
  let score = 0;
  const reasons: RelevantReason[] = [];

  if (hasLinkTo(current, candidate)) {
    score += 10;
    reasons.push('outlink');
  }

  if (hasLinkTo(candidate, current)) {
    score += 10;
    reasons.push('backlink');
  }

  const sharedTagCount = countSharedValues(current.tags, candidate.tags);
  if (sharedTagCount > 0) {
    score += Math.min(12, sharedTagCount * 4);
    reasons.push('tag');
  }

  if (getFolderPath(current.path) === getFolderPath(candidate.path)) {
    score += 3;
    reasons.push('folder');
  }

  const sharedTermCount = countSharedValues(current.terms, candidate.terms);
  if (sharedTermCount > 0) {
    score += Math.min(8, sharedTermCount);
    reasons.push('text');
  }

  if (score <= 0) {
    return null;
  }

  return {
    path: candidate.path,
    title: candidate.title,
    score,
    reasons,
  };
}

function hasLinkTo(source: VaultIndexedDocument, target: VaultIndexedDocument): boolean {
  for (const link of source.links) {
    if (linkTargetsPath(link, target)) {
      return true;
    }
  }

  return false;
}

function linkTargetsPath(link: string, target: VaultIndexedDocument): boolean {
  const normalizedLink = normalizeVaultLink(link);
  const normalizedPath = normalizeVaultLink(target.path);
  const withoutExtension = normalizedPath.replace(/\.md$/u, '');
  const basename = normalizeVaultLink(target.title);

  return normalizedLink === normalizedPath
    || normalizedLink === withoutExtension
    || normalizedLink === basename;
}

function normalizeVaultLink(link: string): string {
  const [withoutHeading] = link.split('#', 1);
  const [withoutAlias] = withoutHeading.split('|', 1);
  return withoutAlias.trim().replace(/^\/+/u, '').replace(/\\/gu, '/');
}

function countSharedValues(left: Set<string>, right: Set<string>): number {
  let count = 0;
  const normalizedRight = new Set(Array.from(right, value => normalizeSearchTerm(value)));

  for (const value of left) {
    if (normalizedRight.has(normalizeSearchTerm(value))) {
      count += 1;
    }
  }

  return count;
}

function getFolderPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function compareRelevantNotes(left: ScoredRelevantNote, right: ScoredRelevantNote): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.path.localeCompare(right.path);
}
