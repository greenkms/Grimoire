import * as fs from 'node:fs';

import { readAcpSqliteRows } from '../../acp/history/AcpSqliteReader';
import { resolveExistingMimocodeDatabasePath } from '../runtime/MimocodePaths';
import type { MimocodeProviderState } from '../types';

type StoredErrorRow = Record<string, unknown>;

export interface MimocodeSessionError {
  message: string;
  name?: string;
  statusCode?: number;
}

const MAX_ERROR_MESSAGE_LENGTH = 600;
const MAX_RECENT_MESSAGE_ROWS = 8;

export async function loadLatestMimocodeSessionError(
  sessionId: string,
  providerState: MimocodeProviderState | undefined,
  sinceEpochMs: number,
  parentMessageId?: string | null,
): Promise<MimocodeSessionError | null> {
  const databasePath = resolveExistingMimocodeDatabasePath(providerState?.databasePath);
  if (!sessionId || !databasePath || databasePath === ':memory:' || !fs.existsSync(databasePath)) {
    return null;
  }

  const rows = await loadRecentMessageRows(databasePath, sessionId, Math.max(0, sinceEpochMs - 1_000));
  return extractMimocodeSessionError(rows, parentMessageId);
}

export function extractMimocodeSessionError(
  rows: StoredErrorRow[] | null,
  parentMessageId?: string | null,
): MimocodeSessionError | null {
  for (const row of rows ?? []) {
    const data = parseJsonObject(row.data);
    if (!data || data.role !== 'assistant') {
      continue;
    }

    if (parentMessageId && getString(data.parentID) !== parentMessageId) {
      continue;
    }

    const storedError = extractMimocodeSessionErrorFromMessage(data);
    if (storedError) {
      return storedError;
    }
  }

  return null;
}

export function extractMimocodeSessionErrorFromMessage(
  message: StoredErrorRow,
): MimocodeSessionError | null {
  const error = getObject(message.error);
  const errorData = getObject(error?.data);
  const rawMessage = getString(errorData?.message) ?? getString(error?.message);
  if (!rawMessage) {
    return null;
  }

  return {
    message: truncateMessage(rawMessage),
    ...(getString(error?.name) ? { name: getString(error?.name)! } : {}),
    ...(getNumber(errorData?.statusCode) !== null
      ? { statusCode: getNumber(errorData?.statusCode)! }
      : {}),
  };
}

export function formatMimocodeSessionError(error: MimocodeSessionError): string {
  if (error.statusCode === 401 || /invalid api key|invalid[_ -]?key/i.test(error.message)) {
    return 'MiMo authentication failed: Invalid API Key. Run `mimo auth login` in a terminal, then retry.';
  }

  return `MiMo request failed: ${error.message}`;
}

async function loadRecentMessageRows(
  databasePath: string,
  sessionId: string,
  sinceEpochMs: number,
): Promise<StoredErrorRow[] | null> {
  const rows = await readAcpSqliteRows<StoredErrorRow>(databasePath, [{
    params: [sessionId, Math.floor(sinceEpochMs)],
    sql: buildRecentMessagesQuery('?'),
  }]);
  return rows?.[0] ?? null;
}

function buildRecentMessagesQuery(sessionPlaceholder: string): string {
  return [
    'select data',
    'from message',
    `where session_id = ${sessionPlaceholder}`,
    'and time_created >= ?',
    'order by time_created desc, id desc',
    `limit ${MAX_RECENT_MESSAGE_ROWS}`,
  ].join(' ');
}

function truncateMessage(message: string): string {
  const normalized = message.trim();
  return normalized.length <= MAX_ERROR_MESSAGE_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`;
}

function parseJsonObject(value: unknown): StoredErrorRow | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getObject(value: unknown): StoredErrorRow | null {
  return isPlainObject(value) ? value : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPlainObject(value: unknown): value is StoredErrorRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
