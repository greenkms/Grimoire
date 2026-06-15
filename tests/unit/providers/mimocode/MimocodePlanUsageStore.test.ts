import { MimocodePlanUsageStore, mimocodePlanUsageStore } from '@/providers/mimocode/app/MimocodePlanUsageStore';

describe('MimocodePlanUsageStore', () => {
  beforeEach(() => {
    mimocodePlanUsageStore.reset();
  });

  it('aggregates ACP usage_update cost into monthly spend usage', () => {
    mimocodePlanUsageStore.recordCost({ amount: 1.25, currency: 'USD' });
    mimocodePlanUsageStore.recordCost({ amount: 0.75, currency: 'USD' });

    expect(mimocodePlanUsageStore.getCachedUsage({
      plugin: {} as any,
      providerId: 'mimocode',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: '$2.00 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });

  it('keeps currencies separate when ACP reports a non-USD cost', () => {
    mimocodePlanUsageStore.recordCost({ amount: 4.2, currency: 'EUR' });

    expect(mimocodePlanUsageStore.getCachedUsage({
      plugin: {} as any,
      providerId: 'mimocode',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: 'EUR 4.20 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });

  it('records only deltas from cumulative MiMoCode session costs', () => {
    const store = new MimocodePlanUsageStore();

    expect(store.recordSessionTotalCost('session-1', { amount: 1.25, currency: 'USD' })).toBe(true);
    expect(store.recordSessionTotalCost('session-1', { amount: 1.5, currency: 'USD' })).toBe(true);
    expect(store.recordSessionTotalCost('session-1', { amount: 1.5, currency: 'USD' })).toBe(false);

    expect(store.getCachedUsage({
      plugin: {} as any,
      providerId: 'mimocode',
      settings: {},
    })).toEqual({
      plan: 'API keys',
      spend: '$1.50 this month',
      note: 'Pay per token across vendors · no cap set.',
    });
  });
});
