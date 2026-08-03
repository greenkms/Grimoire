import {
  parseOrchestratorPlan,
  stripOrchestratorPlanPayload,
} from '@/features/chat/rendering/orchestratorPlanParser';

describe('parseOrchestratorPlan', () => {
  it('parses a json-tagged fenced parallel worker plan', () => {
    const plan = parseOrchestratorPlan(`
Before

\`\`\`json
{
  "type": "parallel_worker_plan",
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
      type: 'parallel_worker_plan',
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
{"type":"parallel_worker_plan","tasks":[{"id":"a","description":"Task A","prompt":"Do A"},{"id":"b","description":"Task B","prompt":"Do B"}]}
\`\`\`
`);

    expect(plan).toEqual({
      type: 'parallel_worker_plan',
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
{"type":"parallel_worker_plan","tasks":[{"id":"wrong","description":"Wrong","prompt":"Wrong"}]}
\`\`\`

\`\`\`json
{"type":"parallel_worker_plan","tasks":[{"id":"right","description":"Right task","prompt":"Do the right task"},{"id":"also-right","description":"Also right","prompt":"Do the other right task"}]}
\`\`\`
`);

    expect(plan).toEqual({
      type: 'parallel_worker_plan',
      tasks: [
        { id: 'right', description: 'Right task', prompt: 'Do the right task' },
        { id: 'also-right', description: 'Also right', prompt: 'Do the other right task' },
      ],
    });
  });

  it('rejects legacy orchestration payloads and malformed tasks', () => {
    const invalidPayloads = [
      '{"type":"other","tasks":[{"id":"a","description":"A","prompt":"A"}]}',
      '{"type":"orchestrator_plan","tasks":[{"id":"a","description":"A","prompt":"A"},{"id":"b","description":"B","prompt":"B"}]}',
      '{"type":"parallel_worker_plan","tasks":[]}',
      '{"type":"parallel_worker_plan","tasks":[{"id":"a","description":"A","prompt":"A"}]}',
      '{"type":"parallel_worker_plan","tasks":[{"id":"","description":"A","prompt":"A"}]}',
      '{"type":"parallel_worker_plan","tasks":[{"id":"a","description":" ","prompt":"A"}]}',
      '{"type":"parallel_worker_plan","tasks":[{"id":"a","description":"A","prompt":""}]}',
      '{"type":"parallel_worker_plan","tasks":[{"id":"a","description":"A"}]}',
    ];

    for (const payload of invalidPayloads) {
      expect(parseOrchestratorPlan(`\`\`\`json\n${payload}\n\`\`\``)).toBeNull();
    }
  });

  it('rejects duplicate task ids and dependency metadata', () => {
    const invalidPlans = [
      {
        type: 'parallel_worker_plan',
        tasks: [
          { id: 'same', description: 'Task A', prompt: 'Do A' },
          { id: 'same', description: 'Task B', prompt: 'Do B' },
        ],
      },
      {
        type: 'parallel_worker_plan',
        tasks: [
          { id: 'a', description: 'Task A', prompt: 'Do A' },
          { id: 'b', description: 'Task B', prompt: 'Do B', after: 'a' },
        ],
      },
      {
        type: 'parallel_worker_plan',
        tasks: [
          { id: 'a', description: 'Task A', prompt: 'Do A' },
          { id: 'b', description: 'Task B', prompt: 'Do B', dependsOn: ['a'] },
        ],
      },
    ];

    for (const plan of invalidPlans) {
      expect(parseOrchestratorPlan(`\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``)).toBeNull();
    }
  });

  it('rejects plans with more than five tasks', () => {
    const tasks = Array.from({ length: 6 }, (_, index) => ({
      id: String(index + 1),
      description: `Task ${index + 1}`,
      prompt: `Do task ${index + 1}`,
    }));

    expect(parseOrchestratorPlan(`\`\`\`json\n${JSON.stringify({ type: 'parallel_worker_plan', tasks })}\n\`\`\``))
      .toBeNull();
  });

  it('returns null when no fenced parallel worker plan exists', () => {
    expect(parseOrchestratorPlan('{"type":"parallel_worker_plan","tasks":[]}')).toBeNull();
    expect(parseOrchestratorPlan('No plan here.')).toBeNull();
  });

  it('removes only the valid internal plan payload from display markdown', () => {
    const markdown = `Prepared a plan.\n\n\`\`\`json
{"type":"parallel_worker_plan","tasks":[{"id":"a","description":"Task A","prompt":"Do A"},{"id":"b","description":"Task B","prompt":"Do B"}]}
\`\`\`\n\nReview it before launch.`;

    expect(stripOrchestratorPlanPayload(markdown)).toBe(
      'Prepared a plan.\n\n\n\nReview it before launch.',
    );
  });

  it('leaves unrelated JSON fences visible', () => {
    const markdown = '```json\n{"type":"example"}\n```';

    expect(stripOrchestratorPlanPayload(markdown)).toBe(markdown);
  });
});
