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

export interface AntigravityStreamJsonParser {
  /** Feeds decoded stdout text; complete NDJSON lines are parsed immediately. */
  write(text: string): void;
  /** Flushes a trailing line that never received its newline. */
  end(): void;
  /** The last `{"event":"result"}` frame observed, if any. */
  getResult(): AntigravityResultFrame | null;
}

export function createAntigravityStreamJsonParser(): AntigravityStreamJsonParser {
  let pendingLine = '';
  let result: AntigravityResultFrame | null = null;

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const record = JSON.parse(trimmed) as Record<string, unknown>;
      if (record.event !== 'result') {
        return;
      }
      const frame = record.result;
      if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
        return;
      }
      const fields = frame as Record<string, unknown>;
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
