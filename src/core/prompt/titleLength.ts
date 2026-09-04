/**
 * Shared length budget for conversation titles.
 *
 * A tab title, a model-generated title and the deterministic fallback title all end up
 * in the same place, so they share one budget: a title's length must not depend on which
 * mechanism happened to produce it.
 */
export const MAX_TITLE_LENGTH = 100;

const ELLIPSIS = '...';
/**
 * A word-boundary cut is preferred, but only while it keeps a useful share of the
 * budget. Text that opens with one very long token (a path, a URL) would otherwise
 * collapse to a single word.
 */
const MIN_WORD_CUT_RATIO = 0.3;

/** A cut must not leave the leading half of a surrogate pair behind. */
export function trimDanglingSurrogate(text: string): string {
  const last = text.charCodeAt(text.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? text.slice(0, -1) : text;
}

/**
 * Cuts `text` to `maxLength`, preferring the last word boundary and marking the cut
 * with an ellipsis. `trimEnd` lets a caller strip its own trailing noise (punctuation,
 * brackets) from the shortened text before the ellipsis is appended.
 */
export function truncateTitleOnWordBoundary(
  text: string,
  maxLength: number = MAX_TITLE_LENGTH,
  trimEnd: (value: string) => string = (value) => value.trimEnd(),
): string {
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= ELLIPSIS.length) {
    return trimDanglingSurrogate(text.slice(0, maxLength));
  }

  const hardCut = trimDanglingSurrogate(text.slice(0, maxLength - ELLIPSIS.length)).trimEnd();
  const lastSpace = hardCut.lastIndexOf(' ');
  const wordCut = lastSpace > 0 ? trimEnd(hardCut.slice(0, lastSpace)) : '';

  if (wordCut.length >= maxLength * MIN_WORD_CUT_RATIO) {
    return `${wordCut}${ELLIPSIS}`;
  }

  return `${hardCut}${ELLIPSIS}`;
}
