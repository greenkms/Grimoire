import type { ProviderCostValue } from '../../../core/providers/ProviderSpendUsageStore';
import type { GrokProviderState } from '../types';

export async function loadGrokSessionCost(
  _sessionId: string,
  _providerState?: GrokProviderState,
): Promise<ProviderCostValue | null> {
  return null;
}

export function sumGrokCostRows(
  rows: Array<Record<string, unknown>> | null,
): ProviderCostValue | null {
  const amount = (rows ?? [])
    .map((row) => readCostAmount(row.cost))
    .filter((cost): cost is number => cost !== null && cost > 0)
    .reduce((total, cost) => total + cost, 0);

  return amount > 0
    ? { amount, currency: 'USD' }
    : null;
}

function readCostAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}