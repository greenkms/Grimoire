import {
  createAntigravityStreamJsonParser,
  formatAntigravityUserEvent,
} from '@/providers/antigravity/runtime/AntigravityStreamJson';

describe('AntigravityStreamJson', () => {
  describe('createAntigravityStreamJsonParser', () => {
    it('extracts the response from a result frame', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(`${JSON.stringify({ event: 'init', cwd: '/vault' })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { step_type: 'agent_response', state: 'DONE' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Final answer', error: null },
      })}\n`);

      expect(parser.getResult()).toEqual({
        error: null,
        response: 'Final answer',
        status: 'SUCCESS',
      });
    });

    it('keeps the last result frame when several are observed', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'stale' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { status: 'ERROR', response: '', error: 'timeout waiting for response' },
      })}\n`);

      expect(parser.getResult()).toEqual({
        error: 'timeout waiting for response',
        response: '',
        status: 'ERROR',
      });
    });

    it('ignores malformed and non-result lines', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write('not json\n');
      parser.write('\n');
      parser.write(`${JSON.stringify({ event: 'step_update' })}\n`);

      expect(parser.getResult()).toBeNull();
    });

    it('holds a line split across writes until its newline arrives', () => {
      const parser = createAntigravityStreamJsonParser();
      const frame = JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'split frame' },
      });
      parser.write(frame.slice(0, 10));
      expect(parser.getResult()).toBeNull();
      parser.write(`${frame.slice(10)}\n`);

      expect(parser.getResult()?.response).toBe('split frame');
    });

    it('flushes a trailing line without a newline on end', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'no trailing newline' },
      }));

      expect(parser.getResult()).toBeNull();
      parser.end();
      expect(parser.getResult()?.response).toBe('no trailing newline');
    });

    it('parses a result frame longer than any accumulator cap', () => {
      const parser = createAntigravityStreamJsonParser();
      const longResponse = 'x'.repeat(200_000);
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: longResponse },
      })}\n`);

      expect(parser.getResult()?.response).toBe(longResponse);
    });

    it('tolerates a result frame with missing optional fields', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(`${JSON.stringify({ event: 'result', result: {} })}\n`);

      expect(parser.getResult()).toEqual({ error: null, response: '', status: '' });
    });

    it('ignores result frames whose payload is not an object', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(`${JSON.stringify({ event: 'result', result: 'done' })}\n`);

      expect(parser.getResult()).toBeNull();
    });
  });

  describe('formatAntigravityUserEvent', () => {
    it('renders one NDJSON user line with the prompt content', () => {
      const line = formatAntigravityUserEvent('Fix the note\nwith care');

      expect(line.endsWith('\n')).toBe(true);
      expect(line.split('\n')).toHaveLength(2);
      expect(JSON.parse(line)).toEqual({
        event: 'user',
        message: { role: 'user', content: 'Fix the note\nwith care' },
      });
    });

    it('escapes multibyte and control characters safely for a single line', () => {
      const line = formatAntigravityUserEvent('你好 "quoted" \\ end');

      expect(line.trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(line).message.content).toBe('你好 "quoted" \\ end');
    });
  });
});
