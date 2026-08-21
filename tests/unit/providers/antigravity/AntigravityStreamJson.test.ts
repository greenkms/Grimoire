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

    it('parses a replayed agy session with CRLF framing coalesced into few chunks', () => {
      const parser = createAntigravityStreamJsonParser();
      // Frame vocabulary observed from a real agy stream-json session (#69):
      // init, step_update frames, then the final result.
      const frames = [
        { event: 'init', cwd: '/vault', model: 'Gemini 3.7 Flash (Low)' },
        { event: 'step_update', step_update: { step_type: 'user_input', state: 'DONE' } },
        { event: 'step_update', step_update: { step_type: 'checkpoint', state: 'DONE' } },
        { event: 'step_update', step_update: { step_type: 'tool', state: 'ACTIVE' } },
        { event: 'step_update', step_update: { step_type: 'tool', state: 'DONE' } },
        { event: 'step_update', step_update: { step_type: 'agent_response', state: 'ACTIVE', text_delta: '修改' } },
        { event: 'step_update', step_update: { step_type: 'agent_response', state: 'DONE', text_delta: '文件' } },
        {
          event: 'result',
          result: {
            status: 'SUCCESS',
            response: '修改文件',
            error: null,
            duration_seconds: 12.3,
            num_turns: 1,
            usage: { input_tokens: 100, output_tokens: 5, total_tokens: 105 },
          },
        },
      ];
      const blob = `${frames.map((frame) => JSON.stringify(frame)).join('\r\n')}\r\n`;
      parser.write(blob.slice(0, 140));
      parser.write(blob.slice(140));

      expect(parser.getResult()).toEqual({
        error: null,
        response: '修改文件',
        status: 'SUCCESS',
      });
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
