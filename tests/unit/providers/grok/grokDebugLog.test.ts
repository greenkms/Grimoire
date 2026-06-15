import {
  grokAuthPathExists,
  summarizeGrokCliText,
} from '../../../../src/providers/grok/runtime/grokDebugLog';

describe('grokDebugLog helpers', () => {
  it('summarizes CLI stderr/stdout previews', () => {
    expect(summarizeGrokCliText('  line one \n line two  ')).toBe('line one line two');
  });

  it('reports whether a native auth path exists', () => {
    expect(grokAuthPathExists('')).toBe(false);
    expect(grokAuthPathExists(__filename)).toBe(true);
  });
});