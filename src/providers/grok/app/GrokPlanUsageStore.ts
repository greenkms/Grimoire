import { type ProviderCostValue, ProviderSpendUsageStore } from '../../../core/providers/ProviderSpendUsageStore';
import { getGrokProviderSettings } from '../settings';

const GROK_USAGE_NOTE = 'Pay per token across vendors · no cap set.';

export class GrokPlanUsageStore extends ProviderSpendUsageStore {
  private readonly sessionTotals = new Map<string, number>();

  constructor() {
    super({
      plan: 'API keys',
      note: GROK_USAGE_NOTE,
      isAvailable: settings => getGrokProviderSettings(settings).enabled,
    });
  }

  recordSessionTotalCost(sessionId: string, cost: ProviderCostValue | null | undefined): boolean {
    const amount = cost?.amount;
    if (!sessionId || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    const currency = normalizeCurrency(cost?.currency);
    const key = `${sessionId}:${currency}`;
    const previous = this.sessionTotals.get(key) ?? 0;
    this.sessionTotals.set(key, amount);
    if (amount <= previous) {
      return false;
    }

    return this.recordCost({
      amount: amount - previous,
      currency,
    });
  }

  reset(): void {
    super.reset();
    this.sessionTotals.clear();
  }
}

export const grokPlanUsageStore = new GrokPlanUsageStore();

function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized || 'USD';
}
