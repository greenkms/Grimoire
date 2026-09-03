const DEFAULT_MAX_TITLE_LENGTH = 50;
const ELLIPSIS = '...';
/** Below this length a first sentence carries too little signal to stand alone as a title. */
const MIN_SIGNAL_LENGTH = 12;
/**
 * A word-boundary cut is preferred, but only while it keeps a useful share of the
 * budget. Messages that open with one very long token (a path, a URL) would other-
 * wise collapse to a single word.
 */
const MIN_WORD_CUT_RATIO = 0.3;
const TRAILING_NOISE = /[\s.,;:!?—–-]+$/;

export interface FallbackTitleOptions {
  /** Maximum length of the returned title. Defaults to 50. */
  maxLength?: number;
  /** Titles already in use; a matching title gets a numeric discriminator. */
  existingTitles?: Iterable<string>;
}

/**
 * Builds a conversation title from the first user message without calling a model.
 *
 * Deterministic and side-effect free: context blocks are dropped, the first
 * meaningful sentence is selected without breaking on decimals or versions, the
 * result is cut on a word boundary and disambiguated against existing titles.
 */
export function buildFallbackTitle(
  message: string,
  options: FallbackTitleOptions = {},
): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_TITLE_LENGTH;
  const text = stripLeadingContextBlocks(message);
  if (!text) {
    return '';
  }

  const sentence = selectFirstMeaningfulSentence(text);
  const truncated = truncateOnWordBoundary(sentence, maxLength);

  return disambiguate(truncated, options.existingTitles, maxLength);
}

/**
 * Drops XML-ish context blocks that the host prepends to the first message, so the
 * title comes from what the user actually typed.
 */
function stripLeadingContextBlocks(message: string): string {
  let rest = message.trim();

  for (;;) {
    if (!rest.startsWith('<')) {
      return rest;
    }

    const openEnd = rest.indexOf('>');
    if (openEnd === -1) {
      return rest;
    }

    const openTag = rest.slice(1, openEnd);
    const tagName = openTag.split(/[\s/>]/)[0];
    if (!tagName || !/^[A-Za-z_][\w.-]*$/.test(tagName)) {
      return rest;
    }

    const closingTag = `</${tagName}>`;
    const closingIndex = rest.indexOf(closingTag, openEnd);
    const next = closingIndex === -1
      ? rest.slice(openEnd + 1)
      : rest.slice(closingIndex + closingTag.length);

    const trimmedNext = next.trim();
    if (!trimmedNext) {
      return '';
    }

    rest = trimmedNext;
  }
}

/**
 * Returns the first sentence long enough to describe the request. Sentence ends are
 * detected on line breaks and on terminal punctuation that is not part of a number
 * such as `0.4` or `1.4.5`.
 */
function selectFirstMeaningfulSentence(text: string): string {
  for (const boundary of collectSentenceBoundaries(text)) {
    const candidate = text.slice(0, boundary).replace(TRAILING_NOISE, '');
    if (candidate.length >= MIN_SIGNAL_LENGTH) {
      return candidate;
    }
  }

  return text.replace(TRAILING_NOISE, '');
}

function collectSentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\n') {
      boundaries.push(index);
      continue;
    }

    if (char !== '.' && char !== '!' && char !== '?') {
      continue;
    }

    const previous = text[index - 1];
    const next = text[index + 1];
    const insideNumber = isDigit(previous) && isDigit(next);
    if (insideNumber) {
      continue;
    }

    if (next === undefined || /\s/.test(next)) {
      boundaries.push(index);
    }
  }

  return boundaries;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function truncateOnWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const budget = Math.max(1, maxLength - ELLIPSIS.length);
  const hardCut = text.slice(0, budget).replace(/\s+$/, '');
  const lastSpace = hardCut.lastIndexOf(' ');
  const wordCut = lastSpace > 0
    ? hardCut.slice(0, lastSpace).replace(TRAILING_NOISE, '')
    : '';

  if (wordCut.length >= maxLength * MIN_WORD_CUT_RATIO) {
    return `${wordCut}${ELLIPSIS}`;
  }

  return `${hardCut}${ELLIPSIS}`;
}

function disambiguate(
  title: string,
  existingTitles: Iterable<string> | undefined,
  maxLength: number,
): string {
  if (!title || !existingTitles) {
    return title;
  }

  const taken = new Set<string>();
  for (const existing of existingTitles) {
    if (typeof existing === 'string') {
      taken.add(existing.trim());
    }
  }

  if (!taken.has(title)) {
    return title;
  }

  for (let counter = 2; counter < 1000; counter += 1) {
    const suffix = ` (${counter})`;
    const base = title.length + suffix.length <= maxLength
      ? title
      : title.slice(0, Math.max(1, maxLength - suffix.length)).replace(/\s+$/, '');
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return title;
}
