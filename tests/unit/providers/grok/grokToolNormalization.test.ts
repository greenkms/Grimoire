import {
  createGrokToolStreamAdapter,
  normalizeGrokToolInput,
  normalizeGrokToolName,
} from '../../../../src/providers/grok/normalization/grokToolNormalization';

describe('normalizeGrokToolName', () => {
  it('maps PascalCase Grok Build tool names onto Grimoire tool names', () => {
    expect(normalizeGrokToolName('Shell')).toBe('Bash');
    expect(normalizeGrokToolName('StrReplace')).toBe('Edit');
    expect(normalizeGrokToolName('Grep')).toBe('Grep');
    expect(normalizeGrokToolName('Read')).toBe('Read');
  });
});

describe('normalizeGrokToolInput', () => {
  it('maps read payloads with path aliases onto file_path', () => {
    expect(normalizeGrokToolInput('read', {
      path: 'Geography/Indian Ocean.md',
    })).toEqual({
      file_path: 'Geography/Indian Ocean.md',
    });
    expect(normalizeGrokToolInput('read', {
      filepath: '.grimoire/grok/system.md',
    })).toEqual({
      file_path: '.grimoire/grok/system.md',
    });
  });

  it('maps websearch payloads to the WebSearch renderer shape', () => {
    expect(normalizeGrokToolInput('websearch', {
      action: {
        queries: [
          'obsidian plugin API',
          'obsidian docs',
          'obsidian plugin API',
        ],
      },
    })).toEqual({
      actionType: 'search',
      query: 'obsidian plugin API',
      queries: [
        'obsidian plugin API',
        'obsidian docs',
      ],
    });
  });

  it('maps question payloads to the AskUserQuestion renderer shape', () => {
    expect(normalizeGrokToolInput('question', {
      questions: [{
        header: 'Tests',
        id: 'tests',
        multiple: true,
        options: [
          { description: 'Update the related tests', label: 'Yes' },
          { description: 'Skip test edits', label: 'No' },
        ],
        question: 'Update tests too?',
      }],
    })).toEqual({
      questions: [{
        header: 'Tests',
        id: 'tests',
        multiSelect: true,
        options: [
          { description: 'Update the related tests', label: 'Yes' },
          { description: 'Skip test edits', label: 'No' },
        ],
        question: 'Update tests too?',
      }],
    });
  });

  it('maps todowrite statuses into the TodoWrite renderer shape', () => {
    expect(normalizeGrokToolInput('todowrite', {
      todos: [
        { content: 'Ship feature', status: 'in_progress' },
        { content: 'Drop stale task', status: 'cancelled' },
      ],
    })).toEqual({
      todos: [
        { activeForm: 'Ship feature', content: 'Ship feature', status: 'in_progress' },
        { activeForm: 'Drop stale task', content: 'Drop stale task', status: 'completed' },
      ],
    });
  });
});

describe('createGrokToolStreamAdapter', () => {
  it('keeps the original tool identity when completion updates replace title with a filepath', () => {
    const adapter = createGrokToolStreamAdapter();

    expect(adapter.normalizeToolCall({
      rawInput: {},
      title: 'read',
      toolCallId: 'tool-1',
    }, [{
      id: 'tool-1',
      input: {},
      name: 'read',
      type: 'tool_use',
    }])).toEqual([{
      id: 'tool-1',
      input: {},
      name: 'Read',
      type: 'tool_use',
    }]);

    expect(adapter.normalizeToolCallUpdate({
      kind: 'read',
      rawInput: {
        filePath: '/vault/notes/today.md',
      },
      status: 'completed',
      title: 'notes/today.md',
      toolCallId: 'tool-1',
    }, [{
      content: 'read ok',
      id: 'tool-1',
      isError: false,
      type: 'tool_result',
    }])).toEqual([
      {
        id: 'tool-1',
        input: { file_path: '/vault/notes/today.md' },
        name: 'Read',
        type: 'tool_use',
      },
      {
        content: 'read ok',
        id: 'tool-1',
        isError: false,
        type: 'tool_result',
      },
    ]);
  });

  it('merges ACP read locations into tool input when rawInput has no path', () => {
    const adapter = createGrokToolStreamAdapter();

    expect(adapter.normalizeToolCallUpdate({
      kind: 'read',
      locations: [{ path: 'Geography/Indian Ocean.md' }],
      status: 'completed',
      title: 'read',
      toolCallId: 'tool-locations',
    }, [])).toEqual([
      {
        id: 'tool-locations',
        input: { file_path: 'Geography/Indian Ocean.md' },
        name: 'Read',
        type: 'tool_use',
      },
    ]);
  });

  it('attaches structured answers for question tool results', () => {
    const adapter = createGrokToolStreamAdapter();

    adapter.normalizeToolCall({
      rawInput: {
        questions: [{
          header: 'Deploy',
          id: 'deploy',
          options: [
            { description: 'Ship the change', label: 'Yes' },
            { description: 'Hold the deploy', label: 'No' },
          ],
          question: 'Deploy now?',
        }],
      },
      title: 'question',
      toolCallId: 'tool-2',
    }, [{
      id: 'tool-2',
      input: {},
      name: 'question',
      type: 'tool_use',
    }]);

    expect(adapter.normalizeToolCallUpdate({
      rawOutput: {
        metadata: {
          answers: [['Yes']],
        },
        output: 'User has answered your questions.',
      },
      status: 'completed',
      title: 'Asked 1 question',
      toolCallId: 'tool-2',
    }, [{
      content: 'User has answered your questions.',
      id: 'tool-2',
      isError: false,
      type: 'tool_result',
    }])).toEqual([{
      content: 'User has answered your questions.',
      id: 'tool-2',
      isError: false,
      toolUseResult: {
        answers: {
          deploy: 'Yes',
          'Deploy now?': 'Yes',
        },
      },
      type: 'tool_result',
    }]);
  });

  it('normalizes websearch tool calls to the shared WebSearch renderer contract', () => {
    const adapter = createGrokToolStreamAdapter();

    expect(adapter.normalizeToolCall({
      rawInput: {
        action: {
          pattern: 'tools',
          url: 'https://example.com/docs',
        },
      },
      title: 'websearch',
      toolCallId: 'tool-3',
    }, [{
      id: 'tool-3',
      input: {},
      name: 'websearch',
      type: 'tool_use',
    }])).toEqual([{
      id: 'tool-3',
      input: {
        actionType: 'find_in_page',
        pattern: 'tools',
        url: 'https://example.com/docs',
      },
      name: 'WebSearch',
      type: 'tool_use',
    }]);
  });
});
