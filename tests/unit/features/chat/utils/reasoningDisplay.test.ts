import { localizeReasoningLevel } from '@/features/chat/utils/reasoningDisplay';
import { setLocale } from '@/i18n/i18n';

describe('localizeReasoningLevel', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it.each([
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['med', 'Medium'],
    ['high', 'High'],
    ['xhigh', 'Extra high'],
    ['extra-high', 'Extra high'],
    ['max', 'Maximum'],
    ['maximum', 'Maximum'],
  ])('localizes %s', (value, expected) => {
    expect(localizeReasoningLevel(value)).toBe(expected);
  });

  it('normalizes whitespace and letter case', () => {
    expect(localizeReasoningLevel('  XHIGH  ')).toBe('Extra high');
  });

  it('preserves unknown provider-native levels by default', () => {
    expect(localizeReasoningLevel('ultra')).toBe('ultra');
  });

  it('uses an explicit fallback for unknown levels', () => {
    expect(localizeReasoningLevel('provider-value', 'Provider value')).toBe('Provider value');
  });
});
