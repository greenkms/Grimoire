import { sumGrokCostRows } from '@/providers/grok/history/GrokUsageMetadataStore';

describe('GrokUsageMetadataStore', () => {
  it('sums positive Grok Build metadata cost rows as USD spend', () => {
    expect(sumGrokCostRows([
      { cost: 0 },
      { cost: 1.25 },
      { cost: '0.75' },
      { cost: null },
    ])).toEqual({
      amount: 2,
      currency: 'USD',
    });
  });

  it('returns null when Grok Build has no positive metadata cost', () => {
    expect(sumGrokCostRows([
      { cost: 0 },
      { cost: null },
      { cost: -1 },
    ])).toBeNull();
  });
});
