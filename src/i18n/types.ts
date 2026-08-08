import type en from './locales/en.json';

export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'ru' | 'pt';

/**
 * Flatten nested locale objects into dot-separated leaf keys.
 * Derived from `en.json` so the union stays complete without manual maintenance.
 */
type NestedTranslationKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? (Prefix extends '' ? K : `${Prefix}.${K}`)
    : T[K] extends Record<string, unknown>
      ? NestedTranslationKeyOf<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
      : never;
}[keyof T & string];

/**
 * All leaf translation keys present in the English locale catalog.
 */
export type TranslationKey = NestedTranslationKeyOf<typeof en>;
