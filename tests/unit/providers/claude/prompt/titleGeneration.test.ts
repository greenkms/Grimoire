import {
  buildTitleGenerationSystemPrompt,
  resolveTitleLanguageName,
  TITLE_GENERATION_SYSTEM_PROMPT,
} from '@/core/prompt/titleGeneration';
import { setLocale } from '@/i18n/i18n';

describe('titleGeneration', () => {
  it('exports a non-empty system prompt string', () => {
    expect(typeof TITLE_GENERATION_SYSTEM_PROMPT).toBe('string');
    expect(TITLE_GENERATION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('includes the max character constraint', () => {
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain('max 50 chars');
  });

  it('instructs to start with a strong verb', () => {
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain('strong verb');
  });

  it('instructs to return only the raw title text', () => {
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain('ONLY the raw title text');
  });

  describe('buildTitleGenerationSystemPrompt', () => {
    afterEach(() => {
      setLocale('en');
    });

    it('resolves a locale to its English language name', () => {
      expect(resolveTitleLanguageName('ru')).toBe('Russian');
      expect(resolveTitleLanguageName('en')).toBe('English');
    });

    it('falls back to English for an unknown locale', () => {
      expect(resolveTitleLanguageName('xx' as never)).toBe('English');
    });

    it('keeps the base rules and appends the current locale language directive', () => {
      setLocale('ru');
      const prompt = buildTitleGenerationSystemPrompt();
      expect(prompt).toContain(TITLE_GENERATION_SYSTEM_PROMPT);
      expect(prompt).toContain('Write the title in Russian');
    });

    it('honours an explicit locale argument', () => {
      expect(buildTitleGenerationSystemPrompt('ja')).toContain('Write the title in Japanese');
    });
  });
});
