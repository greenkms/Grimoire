import { GrokPlanUsageStore, grokPlanUsageStore } from '@/providers/grok/app/GrokPlanUsageStore';

describe('GrokPlanUsageStore', () => {
  beforeEach(() => {
    grokPlanUsageStore.reset();
  });

  it('aggregates ACP usage_update cost into monthly spend usage', () => {
    grokPlanUsageStore.recordCost({ amount: 1.25, currency: 'USD' });
    grokPlanUsageStore.recordCost({ amount: 0.75, currency: 'USD' });

    expect(grokPlanUsageStore.getCachedUsage({
      plugin: {} as any,
      providerId: 'grok',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: '$2.00 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });

  it('keeps currencies separate when ACP reports a non-USD cost', () => {
    grokPlanUsageStore.recordCost({ amount: 4.2, currency: 'EUR' });

    expect(grokPlanUsageStore.getCachedUsage({
      plugin: {} as any,
      providerId: 'grok',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: 'EUR 4.20 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });

  it('merges SuperGrok credit windows with API spend usage', () => {
    grokPlanUsageStore.setCreditsUsageForTests({
      plan: 'SuperGrok',
      windows: [{
        label: 'Credits',
        pct: 6,
        pctKnown: true,
        reset: 'Jul 1',
      }],
      note: 'Free credits · resets Jul 1',
    });
    grokPlanUsageStore.recordCost({ amount: 1.25, currency: 'USD' });

    expect(grokPlanUsageStore.getCachedUsage({
      plugin: {} as any,
      providerId: 'grok',
      settings: {},
    })).toEqual({
      plan: 'SuperGrok',
      windows: [{
        label: 'Credits',
        pct: 6,
        pctKnown: true,
        reset: 'Jul 1',
      }],
      spend: '$1.25 this month',
      note: 'Free credits · resets Jul 1 · Pay per token across vendors · no cap set.',
    });
  });

  it('records only deltas from cumulative Grok Build session costs', () => {
    const store = new GrokPlanUsageStore();

    expect(store.recordSessionTotalCost('session-1', { amount: 1.25, currency: 'USD' })).toBe(true);
    expect(store.recordSessionTotalCost('session-1', { amount: 1.5, currency: 'USD' })).toBe(true);
    expect(store.recordSessionTotalCost('session-1', { amount: 1.5, currency: 'USD' })).toBe(false);

    expect(store.getCachedUsage({
      plugin: {} as any,
      providerId: 'grok',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: '$1.50 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });
});
