/**
 * NDJSON helpers for `agy --input-format stream-json --output-format
 * stream-json`. agy rejects `--print` combined with `--input-format
 * stream-json`, so the prompt travels over stdin as a single user event line
 * and stdout is parsed line-by-line instead of accumulated behind a tail cap
 * (#69): a `result` frame longer than any fixed cap would lose its head and
 * stop parsing.
 */

export interface AntigravityResultFrame {
  error: string | null;
  response: string;
  status: string;
}

/**
 * User-visible progress decoded from a `step_update` frame while the run is
 * still open. agy streams the answer as `text_delta` pieces whose
 * concatenation equals `result.response` exactly, and brackets every tool call
 * with an `ACTIVE`/`DONE` pair sharing one `step_index`, so the same index
 * identifies the start and the completion of one call.
 */
export type AntigravityStreamEvent =
  | { text: string; type: 'text' }
  | { input: Record<string, unknown>; stepIndex: number; toolName: string; type: 'tool_start' }
  | { durationSeconds: number | null; stepIndex: number; toolName: string; type: 'tool_end' };

export interface AntigravityStreamJsonParserOptions {
  /**
   * Receives progress as it is parsed. Never called after `getResult()` has a
   * frame to hand back, because agy emits `result` last.
   */
  onEvent?: (event: AntigravityStreamEvent) => void;
}

export interface AntigravityStreamJsonParser {
  /** Feeds decoded stdout text; complete NDJSON lines are parsed immediately. */
  write(text: string): void;
  /** Flushes a trailing line that never received its newline. */
  end(): void;
  /** The last `{"event":"result"}` frame observed, if any. */
  getResult(): AntigravityResultFrame | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createAntigravityStreamJsonParser(
  options: AntigravityStreamJsonParserOptions = {},
): AntigravityStreamJsonParser {
  let pendingLine = '';
  let result: AntigravityResultFrame | null = null;
  // agy always numbers its steps, but a frame without `step_index` must still
  // not merge two consecutive tool calls into one card. Print-mode tool calls
  // run one at a time, so advancing the fallback on `DONE` keeps the pair
  // together and separates the next call.
  let fallbackToolIndex = 0;

  const emit = (event: AntigravityStreamEvent): void => {
    if (!options.onEvent) {
      return;
    }
    try {
      options.onEvent(event);
    } catch {
      // Progress rendering must never abort parsing: the result frame that
      // carries the actual answer is still ahead on this stream.
    }
  };

  const consumeStepUpdate = (step: Record<string, unknown>): void => {
    const textDelta = step.text_delta;
    if (typeof textDelta === 'string' && textDelta) {
      emit({ text: textDelta, type: 'text' });
    }
    if (step.step_type !== 'tool') {
      return;
    }
    const state = step.state;
    if (state !== 'ACTIVE' && state !== 'DONE') {
      return;
    }
    const stepIndex = typeof step.step_index === 'number' ? step.step_index : fallbackToolIndex;
    if (typeof step.step_index !== 'number' && state === 'DONE') {
      fallbackToolIndex += 1;
    }
    const toolName = typeof step.tool_name === 'string' && step.tool_name ? step.tool_name : 'tool';
    if (state === 'ACTIVE') {
      const parameters = asRecord(asRecord(step.tool_info)?.parameters);
      emit({ input: parameters ?? {}, stepIndex, toolName, type: 'tool_start' });
      return;
    }
    emit({
      durationSeconds: typeof step.duration_seconds === 'number' ? step.duration_seconds : null,
      stepIndex,
      toolName,
      type: 'tool_end',
    });
  };

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const record = JSON.parse(trimmed) as Record<string, unknown>;
      if (record.event === 'step_update') {
        const step = asRecord(record.step_update);
        if (step) {
          consumeStepUpdate(step);
        }
        return;
      }
      if (record.event !== 'result') {
        return;
      }
      const fields = asRecord(record.result);
      if (!fields) {
        return;
      }
      result = {
        error: typeof fields.error === 'string' ? fields.error : null,
        response: typeof fields.response === 'string' ? fields.response : '',
        status: typeof fields.status === 'string' ? fields.status : '',
      };
    } catch {
      // Ignore malformed lines; agy owns the wire and partial writes happen.
    }
  };

  return {
    write: (text) => {
      pendingLine += text;
      let newlineIndex = pendingLine.indexOf('\n');
      while (newlineIndex >= 0) {
        consumeLine(pendingLine.slice(0, newlineIndex));
        pendingLine = pendingLine.slice(newlineIndex + 1);
        newlineIndex = pendingLine.indexOf('\n');
      }
    },
    end: () => {
      if (pendingLine) {
        consumeLine(pendingLine);
        pendingLine = '';
      }
    },
    getResult: () => result,
  };
}

export function formatAntigravityUserEvent(prompt: string): string {
  const event = { event: 'user', message: { role: 'user', content: prompt } };
  return `${JSON.stringify(event)}\n`;
}
