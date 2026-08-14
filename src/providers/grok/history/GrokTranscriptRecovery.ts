import { promises as fs } from 'node:fs';

import { buildManagedGrokProcessEnv, resolveGrokChatHistoryPath } from '../runtime/GrokPaths';
import type { GrokProviderState } from '../types';

const HISTORY_READ_LIMIT_BYTES = 4 * 1024 * 1024;

export interface GrokTranscriptRecoveryInput {
  readonly nativeSessionRef: string;
  readonly workspacePath: string | null;
  readonly providerState?: GrokProviderState;
  readonly maxBytes: number;
}

export interface GrokTranscriptRecoveryPort {
  /** Reads the answer Grok already stored for the last prompt of a session. */
  recoverFinalAssistantMessage(input: GrokTranscriptRecoveryInput): Promise<string>;
}

interface GrokHistoryRow {
  readonly content?: unknown;
  readonly type?: unknown;
}

/**
 * Grok Build occasionally finishes a turn without delivering its final
 * `agent_message_chunk` over ACP, leaving the chat empty even though the CLI wrote the
 * answer to its own session log. Reading that log back keeps the answer instead of
 * failing a turn the provider actually completed.
 */
export class GrokNativeTranscriptRecovery implements GrokTranscriptRecoveryPort {
  async recoverFinalAssistantMessage(input: GrokTranscriptRecoveryInput): Promise<string> {
    const historyPath = this.resolveHistoryPath(input);
    if (!historyPath) {
      return '';
    }
    const transcript = await readFileTail(historyPath, HISTORY_READ_LIMIT_BYTES);
    if (!transcript.text) {
      return '';
    }
    const answer = extractGrokFinalAssistantMessage(transcript.text, transcript.truncated);
    return Buffer.byteLength(answer, 'utf8') > input.maxBytes ? '' : answer;
  }

  private resolveHistoryPath(input: GrokTranscriptRecoveryInput): string | null {
    const workspacePath = input.workspacePath ?? input.providerState?.workspacePath ?? null;
    try {
      return resolveGrokChatHistoryPath(
        input.nativeSessionRef,
        workspacePath,
        input.providerState?.sessionDirPath ?? null,
        workspacePath ? buildManagedGrokProcessEnv(workspacePath) : process.env,
      );
    } catch {
      return null;
    }
  }
}

/**
 * Returns the last assistant message written after the most recent prompt. Anything
 * recorded before that prompt belongs to an earlier turn and must not be replayed.
 */
export function extractGrokFinalAssistantMessage(
  historyText: string,
  truncated = false,
): string {
  const lines = historyText.split(/\r?\n/);
  if (truncated) {
    lines.shift();
  }

  let answer = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let row: GrokHistoryRow;
    try {
      row = JSON.parse(trimmed) as GrokHistoryRow;
    } catch {
      // Grok appends rows while the turn runs, so the tail can hold a partial line.
      continue;
    }
    if (row.type === 'user') {
      answer = '';
      continue;
    }
    if (row.type === 'assistant' && typeof row.content === 'string' && row.content.trim()) {
      answer = row.content;
    }
  }
  return answer.trim();
}

async function readFileTail(
  filePath: string,
  maxBytes: number,
): Promise<{ readonly text: string; readonly truncated: boolean }> {
  const handle = await fs.open(filePath, 'r').catch(() => null);
  if (!handle) {
    return { text: '', truncated: false };
  }
  try {
    const { size } = await handle.stat();
    const bytes = Math.min(size, maxBytes);
    if (bytes <= 0) {
      return { text: '', truncated: false };
    }
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, size - bytes);
    return {
      text: buffer.subarray(0, bytesRead).toString('utf8'),
      truncated: size > bytes,
    };
  } catch {
    return { text: '', truncated: false };
  } finally {
    await handle.close().catch(() => undefined);
  }
}
