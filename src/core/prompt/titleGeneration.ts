import { SUPPORTED_LOCALES } from '../../i18n/constants';
import { getLocale } from '../../i18n/i18n';
import type { Locale } from '../../i18n/types';

const MAX_TITLE_INPUT_LENGTH = 500;
const MAX_TITLE_LENGTH = 50;

export const TITLE_GENERATION_SYSTEM_PROMPT = `You are a specialist in summarizing user intent.

**Task**: Generate a **concise, descriptive title** (max 50 chars) summarizing the user's task/request.

**Rules**:
1.  **Format**: Sentence case. No periods/quotes.
2.  **Structure**: Start with a **strong verb** (e.g., Create, Fix, Debug, Explain, Analyze).
3.  **Forbidden**: "Conversation with...", "Help me...", "Question about...", "I need...".
4.  **Tech Context**: Detect and include the primary language/framework if code is present (e.g., "Debug Python script", "Refactor React hook").

**Output**: Return ONLY the raw title text.`;

/**
 * Resolve the human-readable (English) name of a locale, e.g. `ru` -> `Russian`.
 * Falls back to English for unknown locales.
 */
export function resolveTitleLanguageName(locale: Locale = getLocale()): string {
  return SUPPORTED_LOCALES.find((entry) => entry.code === locale)?.englishName
    ?? 'English';
}

/**
 * Build the title-generation system prompt for the plugin's current locale.
 * The base instructions stay in English (models follow them more reliably),
 * but an explicit directive forces the generated title into the UI language so
 * a Russian vault does not get English tab titles.
 */
export function buildTitleGenerationSystemPrompt(locale: Locale = getLocale()): string {
  const language = resolveTitleLanguageName(locale);
  return `${TITLE_GENERATION_SYSTEM_PROMPT}

**Language**: Write the title in ${language}. This overrides any language implied by the examples above; only the final title text is translated, the rules are unchanged.`;
}

export function buildTitleGenerationPrompt(userMessage: string): string {
  const truncated = userMessage.length > MAX_TITLE_INPUT_LENGTH
    ? `${userMessage.slice(0, MAX_TITLE_INPUT_LENGTH)}...`
    : userMessage;
  return `User's request:\n"""\n${truncated}\n"""\n\nGenerate a title for this conversation:`;
}

export function parseTitleGenerationResponse(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  let title = trimmed;
  if (
    (title.startsWith('"') && title.endsWith('"'))
    || (title.startsWith("'") && title.endsWith("'"))
  ) {
    title = title.slice(1, -1);
  }

  title = title.replace(/[.!?:;,]+$/, '');

  if (title.length > MAX_TITLE_LENGTH) {
    title = `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`;
  }

  return title || null;
}
