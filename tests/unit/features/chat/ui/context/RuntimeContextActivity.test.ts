import {
  RuntimeContextActivityState,
  extractRuntimeContextLoadEvent,
} from '@/features/chat/ui/context/RuntimeContextActivity';

describe('RuntimeContextActivity', () => {
  it('extracts Claude Read tool calls as loaded notes', () => {
    const event = extractRuntimeContextLoadEvent({
      providerId: 'claude',
      toolCall: {
        id: 'tool-1',
        name: 'Read',
        input: { file_path: 'Книги/Book/CLAUDE.md' },
        status: 'completed',
      },
    });

    expect(event).toMatchObject({
      id: 'tool-1',
      path: 'Книги/Book/CLAUDE.md',
      providerId: 'claude',
      method: 'read note',
      status: 'loaded',
    });
  });

  it('extracts conservative Codex sed shell reads', () => {
    const event = extractRuntimeContextLoadEvent({
      providerId: 'codex',
      toolCall: {
        id: 'tool-2',
        name: 'Bash',
        input: { command: "sed -n '1,120p' 'Книги/Book/Глава 2.md'" },
        status: 'completed',
      },
    });

    expect(event).toMatchObject({
      id: 'tool-2',
      path: 'Книги/Book/Глава 2.md',
      providerId: 'codex',
      method: 'shell',
      status: 'loaded',
    });
  });

  it('extracts conservative Codex cat shell reads', () => {
    const event = extractRuntimeContextLoadEvent({
      providerId: 'codex',
      toolCall: {
        id: 'tool-3',
        name: 'Bash',
        input: { command: "cat Книги/Book/AGENTS.md" },
        status: 'running',
      },
    });

    expect(event).toMatchObject({
      path: 'Книги/Book/AGENTS.md',
      method: 'shell',
      status: 'loading',
    });
  });

  it('extracts Codex shell reads after a command separator', () => {
    const event = extractRuntimeContextLoadEvent({
      providerId: 'codex',
      toolCall: {
        id: 'tool-4',
        name: 'Bash',
        input: { command: "printf '%s\\n' '---CLAUDE---' && sed -n '1,260p' CLAUDE.md" },
        status: 'completed',
      },
    });

    expect(event).toMatchObject({
      path: 'CLAUDE.md',
      method: 'shell',
      status: 'loaded',
    });
  });

  it('ignores shell commands that do not clearly read markdown files', () => {
    const event = extractRuntimeContextLoadEvent({
      providerId: 'codex',
      toolCall: {
        id: 'tool-5',
        name: 'Bash',
        input: { command: 'npm run test' },
        status: 'completed',
      },
    });

    expect(event).toBeNull();
  });

  it('deduplicates by path and keeps the latest status', () => {
    const state = new RuntimeContextActivityState();

    state.record({
      id: 'a',
      path: 'A.md',
      providerId: 'claude',
      method: 'read note',
      status: 'loading',
    });
    state.record({
      id: 'b',
      path: 'A.md',
      providerId: 'claude',
      method: 'read note',
      status: 'loaded',
    });

    expect(state.getEntries()).toHaveLength(1);
    expect(state.getEntries()[0]).toMatchObject({
      id: 'b',
      path: 'A.md',
      status: 'loaded',
    });
  });
});
