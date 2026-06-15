import { sumMimocodeCostRows } from '@/providers/mimocode/history/MimocodeUsageMetadataStore';

describe('MimocodeUsageMetadataStore', () => {
  it('sums positive MiMoCode metadata cost rows as USD spend', () => {
    expect(sumMimocodeCostRows([
      { cost: 0 },
      { cost: 1.25 },
      { cost: '0.75' },
      { cost: null },
    ])).toEqual({
      amount: 2,
      currency: 'USD',
    });
  });

  it('returns null when MiMoCode has no positive metadata cost', () => {
    expect(sumMimocodeCostRows([
      { cost: 0 },
      { cost: null },
      { cost: -1 },
    ])).toBeNull();
  });
});
