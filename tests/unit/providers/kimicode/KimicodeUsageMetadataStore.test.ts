import { sumKimicodeCostRows } from '@/providers/kimicode/history/KimicodeUsageMetadataStore';

describe('KimicodeUsageMetadataStore', () => {
  it('sums positive Kimi Code metadata cost rows as USD spend', () => {
    expect(sumKimicodeCostRows([
      { cost: 0 },
      { cost: 1.25 },
      { cost: '0.75' },
      { cost: null },
    ])).toEqual({
      amount: 2,
      currency: 'USD',
    });
  });

  it('returns null when Kimi Code has no positive metadata cost', () => {
    expect(sumKimicodeCostRows([
      { cost: 0 },
      { cost: null },
      { cost: -1 },
    ])).toBeNull();
  });
});
