import { parseOrchestratorPlan } from '@/features/chat/rendering/orchestratorPlanParser';

describe('parseOrchestratorPlan', () => {
  it('parses a json-tagged fenced orchestrator plan', () => {
    const plan = parseOrchestratorPlan(`
Before

\`\`\`json
{
  "type": "orchestrator_plan",
  "tasks": [
    {
      "id": "parser",
      "description": "Add parser coverage",
      "prompt": "Implement the parser"
    },
    {
      "id": "renderer",
      "description": "Render the approval UI",
      "prompt": "Implement the inline renderer"
    }
  ]
}
\`\`\`

After
`);

    expect(plan).toEqual({
      type: 'orchestrator_plan',
      tasks: [
        {
          id: 'parser',
          description: 'Add parser coverage',
          prompt: 'Implement the parser',
        },
        {
          id: 'renderer',
          description: 'Render the approval UI',
          prompt: 'Implement the inline renderer',
        },
      ],
    });
  });

  it('parses an untagged fenced JSON block', () => {
    const plan = parseOrchestratorPlan(`
\`\`\`
{"type":"orchestrator_plan","tasks":[{"id":"a","description":"Task A","prompt":"Do A"},{"id":"b","description":"Task B","prompt":"Do B"}]}
\`\`\`
`);

    expect(plan).toEqual({
      type: 'orchestrator_plan',
      tasks: [
        { id: 'a', description: 'Task A', prompt: 'Do A' },
        { id: 'b', description: 'Task B', prompt: 'Do B' },
      ],
    });
  });

  it('returns the first valid plan and ignores invalid fenced blocks', () => {
    const plan = parseOrchestratorPlan(`
\`\`\`json
{not valid json}
\`\`\`

\`\`\`typescript
{"type":"orchestrator_plan","tasks":[{"id":"wrong","description":"Wrong","prompt":"Wrong"}]}
\`\`\`

\`\`\`json
{"type":"orchestrator_plan","tasks":[{"id":"right","description":"Right task","prompt":"Do the right task"},{"id":"also-right","description":"Also right","prompt":"Do the other right task"}]}
\`\`\`
`);

    expect(plan).toEqual({
      type: 'orchestrator_plan',
      tasks: [
        { id: 'right', description: 'Right task', prompt: 'Do the right task' },
        { id: 'also-right', description: 'Also right', prompt: 'Do the other right task' },
      ],
    });
  });

  it('rejects non-orchestrator payloads and malformed tasks', () => {
    const invalidPayloads = [
      '{"type":"other","tasks":[{"id":"a","description":"A","prompt":"A"}]}',
      '{"type":"orchestrator_plan","tasks":[]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"a","description":"A","prompt":"A"}]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"","description":"A","prompt":"A"}]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"a","description":" ","prompt":"A"}]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"a","description":"A","prompt":""}]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"a","description":"A"}]}',
    ];

    for (const payload of invalidPayloads) {
      expect(parseOrchestratorPlan(`\`\`\`json\n${payload}\n\`\`\``)).toBeNull();
    }
  });

  it('rejects plans with more than five tasks', () => {
    const tasks = Array.from({ length: 6 }, (_, index) => ({
      id: String(index + 1),
      description: `Task ${index + 1}`,
      prompt: `Do task ${index + 1}`,
    }));

    expect(parseOrchestratorPlan(`\`\`\`json\n${JSON.stringify({ type: 'orchestrator_plan', tasks })}\n\`\`\``))
      .toBeNull();
  });

  it('returns null when no fenced orchestrator plan exists', () => {
    expect(parseOrchestratorPlan('{"type":"orchestrator_plan","tasks":[]}')).toBeNull();
    expect(parseOrchestratorPlan('No plan here.')).toBeNull();
  });
});
