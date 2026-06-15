import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

import type { ProviderCostValue } from '../../../core/providers/ProviderSpendUsageStore';
import { loadNodeSqliteModule, type NodeSqliteModule } from '../../acp/history/sqliteModule';
import { resolveExistingGrokDatabasePath } from '../runtime/GrokPaths';
import type { GrokProviderState } from '../types';

type StoredCostRow = Record<string, unknown>;

export async function loadGrokSessionCost(
  sessionId: string,
  providerState?: GrokProviderState,
): Promise<ProviderCostValue | null> {
  const databasePath = resolveExistingGrokDatabasePath(providerState?.databasePath);
  if (!sessionId || !databasePath || databasePath === ':memory:' || !fs.existsSync(databasePath)) {
    return null;
  }

  const messageCost = sumGrokCostRows(await loadGrokCostRows(databasePath, sessionId, 'message'));
  if (messageCost) {
    return messageCost;
  }

  return sumGrokCostRows(await loadGrokCostRows(databasePath, sessionId, 'step'));
}

export function sumGrokCostRows(rows: StoredCostRow[] | null): ProviderCostValue | null {
  const amount = (rows ?? [])
    .map(row => readCostAmount(row.cost))
    .filter((cost): cost is number => cost !== null && cost > 0)
    .reduce((total, cost) => total + cost, 0);

  return amount > 0
    ? { amount, currency: 'USD' }
    : null;
}

async function loadGrokCostRows(
  databasePath: string,
  sessionId: string,
  source: 'message' | 'step',
): Promise<StoredCostRow[] | null> {
  const viaNodeSqlite = await loadCostRowsWithNodeSqlite(databasePath, sessionId, source);
  if (viaNodeSqlite) {
    return viaNodeSqlite;
  }

  return loadCostRowsWithSqliteCli(databasePath, sessionId, source);
}

async function loadCostRowsWithNodeSqlite(
  databasePath: string,
  sessionId: string,
  source: 'message' | 'step',
): Promise<StoredCostRow[] | null> {
  const sqlite = loadNodeSqliteModule<StoredCostRow>();
  if (!sqlite) {
    return null;
  }

  let db: InstanceType<NodeSqliteModule<StoredCostRow>['DatabaseSync']> | null = null;
  try {
    db = new sqlite.DatabaseSync(databasePath, { readonly: true });
    return db.prepare(buildCostQuery(source, '?')).all(sessionId);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

function loadCostRowsWithSqliteCli(
  databasePath: string,
  sessionId: string,
  source: 'message' | 'step',
): StoredCostRow[] | null {
  const result = spawnSync(
    'sqlite3',
    [
      '-json',
      databasePath,
      `${buildCostQuery(source, `'${escapeSqlLiteral(sessionId)}'`)};`,
    ],
    {
      encoding: 'utf8',
    },
  );

  if (result.error || result.status !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((row): row is StoredCostRow => isPlainObject(row))
      : null;
  } catch {
    return null;
  }
}

function buildCostQuery(source: 'message' | 'step', sessionPlaceholder: string): string {
  if (source === 'message') {
    return [
      "select json_extract(data, '$.cost') as cost",
      'from message',
      `where session_id = ${sessionPlaceholder}`,
      "and json_extract(data, '$.role') = 'assistant'",
    ].join(' ');
  }

  return [
    "select json_extract(data, '$.cost') as cost",
    'from part',
    `where session_id = ${sessionPlaceholder}`,
    "and json_extract(data, '$.type') = 'step-finish'",
  ].join(' ');
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

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
