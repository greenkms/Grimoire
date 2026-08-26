import type { AntigravityStreamEvent } from '@/providers/antigravity/runtime/AntigravityStreamJson';
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

  describe('live progress events', () => {
    function collect(): { events: AntigravityStreamEvent[]; onEvent: (event: AntigravityStreamEvent) => void } {
      const events: AntigravityStreamEvent[] = [];
      return { events, onEvent: (event) => events.push(event) };
    }

    it('reports text deltas in arrival order while the run is still open', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'Hello ' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'DONE', step_type: 'agent_response', text_delta: 'world' },
      })}\n`);

      expect(events).toEqual([
        { text: 'Hello ', type: 'text' },
        { text: 'world', type: 'text' },
      ]);
    });

    it('pairs a tool start with its completion through the shared step index', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: {
          state: 'ACTIVE',
          step_index: 3,
          step_type: 'tool',
          tool_info: { name: 'run_command', parameters: { CommandLine: 'echo hi' } },
          tool_name: 'run_command',
        },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: {
          duration_seconds: 0.4038462,
          state: 'DONE',
          step_index: 3,
          step_type: 'tool',
          tool_info: { name: 'run_command', parameters: { CommandLine: 'echo hi' } },
          tool_name: 'run_command',
        },
      })}\n`);

      expect(events).toEqual([
        {
          input: { CommandLine: 'echo hi' },
          stepIndex: 3,
          toolName: 'run_command',
          type: 'tool_start',
        },
        {
          durationSeconds: 0.4038462,
          output: '',
          stepIndex: 3,
          toolName: 'run_command',
          type: 'tool_end',
        },
      ]);
    });

    it('reports what the tool printed from the completion frame', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      // Shape taken verbatim from a live `agy --output-format stream-json` run.
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'f16ace5b-1f6a-44e1-81f5-94cd67fdba49',
          duration_seconds: 0.3985843,
          state: 'DONE',
          step_index: 2,
          step_type: 'tool',
          tool_info: {
            name: 'run_command',
            output: 'grimoire-capture-test\r\n',
            parameters: { CommandLine: 'echo grimoire-capture-test' },
          },
          tool_name: 'run_command',
        },
      })}\n`);

      expect(events).toEqual([
        {
          durationSeconds: 0.3985843,
          output: 'grimoire-capture-test\r\n',
          stepIndex: 2,
          toolName: 'run_command',
          type: 'tool_end',
        },
      ]);
    });

    it('treats a non-string output as no output rather than rendering it', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: {
          state: 'DONE',
          step_index: 1,
          step_type: 'tool',
          tool_info: { name: 'run_command', output: { unexpected: true } },
          tool_name: 'run_command',
        },
      })}\n`);

      expect(events).toEqual([
        {
          durationSeconds: null,
          output: '',
          stepIndex: 1,
          toolName: 'run_command',
          type: 'tool_end',
        },
      ]);
    });

    it('keeps sequential tools apart when agy omits the step index', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      for (const state of ['ACTIVE', 'DONE']) {
        parser.write(`${JSON.stringify({
          event: 'step_update',
          step_update: { state, step_type: 'tool', tool_name: 'view_file' },
        })}\n`);
      }
      for (const state of ['ACTIVE', 'DONE']) {
        parser.write(`${JSON.stringify({
          event: 'step_update',
          step_update: { state, step_type: 'tool', tool_name: 'run_command' },
        })}\n`);
      }

      const indices = events.map((event) => (event.type === 'text' ? null : event.stepIndex));
      expect(indices).toEqual([0, 0, 1, 1]);
    });

    it('ignores lifecycle frames that carry no user-visible progress', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      parser.write(`${JSON.stringify({ event: 'init', init: { cwd: '/vault' } })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'DONE', step_type: 'user_input' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'DONE', step_type: 'checkpoint' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'DONE', step_type: 'agent_response', text_delta: '' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { response: 'done', status: 'SUCCESS' },
      })}\n`);

      expect(events).toEqual([]);
      expect(parser.getResult()?.response).toBe('done');
    });

    it('concatenates the streamed deltas into exactly the final response', () => {
      const { events, onEvent } = collect();
      const parser = createAntigravityStreamJsonParser({ onEvent });
      const deltas = ['Пишу ', 'файл', ' — готово'];
      for (const [index, delta] of deltas.entries()) {
        parser.write(`${JSON.stringify({
          event: 'step_update',
          step_update: {
            state: index === deltas.length - 1 ? 'DONE' : 'ACTIVE',
            step_type: 'agent_response',
            text_delta: delta,
          },
        })}\n`);
      }
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { response: deltas.join(''), status: 'SUCCESS' },
      })}\n`);

      const streamed = events
        .filter((event): event is Extract<AntigravityStreamEvent, { type: 'text' }> => event.type === 'text')
        .map((event) => event.text)
        .join('');
      expect(streamed).toBe(parser.getResult()?.response);
    });

    it('still parses the result when no progress listener is attached', () => {
      const parser = createAntigravityStreamJsonParser();
      parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'ignored' },
      })}\n`);
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { response: 'ignored', status: 'SUCCESS' },
      })}\n`);

      expect(parser.getResult()?.response).toBe('ignored');
    });

    it('survives a listener that throws so one bad frame cannot abort the run', () => {
      const parser = createAntigravityStreamJsonParser({
        onEvent: () => {
          throw new Error('listener exploded');
        },
      });

      expect(() => parser.write(`${JSON.stringify({
        event: 'step_update',
        step_update: { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'boom' },
      })}\n`)).not.toThrow();
      parser.write(`${JSON.stringify({
        event: 'result',
        result: { response: 'boom', status: 'SUCCESS' },
      })}\n`);
      expect(parser.getResult()?.response).toBe('boom');
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
