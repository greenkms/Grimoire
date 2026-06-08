import { sumOpencodeCostRows } from '@/providers/opencode/history/OpencodeUsageMetadataStore';

describe('OpencodeUsageMetadataStore', () => {
  it('sums positive OpenCode metadata cost rows as USD spend', () => {
    expect(sumOpencodeCostRows([
      { cost: 0 },
      { cost: 1.25 },
      { cost: '0.75' },
      { cost: null },
    ])).toEqual({
      amount: 2,
      currency: 'USD',
    });
  });

  it('returns null when OpenCode has no positive metadata cost', () => {
    expect(sumOpencodeCostRows([
      { cost: 0 },
      { cost: null },
      { cost: -1 },
    ])).toBeNull();
  });
});
