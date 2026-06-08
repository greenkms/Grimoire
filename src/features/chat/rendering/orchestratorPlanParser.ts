export interface OrchestratorTask {
  id: string;
  description: string;
  prompt: string;
}

export interface OrchestratorPlan {
  type: 'orchestrator_plan';
  tasks: OrchestratorTask[];
}

const MIN_ORCHESTRATOR_TASKS = 2;
const MAX_ORCHESTRATOR_TASKS = 5;

export function parseOrchestratorPlan(markdown: string): OrchestratorPlan | null {
  const fencePattern = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(markdown)) !== null) {
    const info = match[1].trim().toLowerCase();
    const language = info.split(/\s+/)[0] ?? '';
    if (language && language !== 'json') continue;

    const body = match[2].trim();
    if (!body) continue;

    try {
      const plan = normalizePlan(JSON.parse(body));
      if (plan) return plan;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizePlan(value: unknown): OrchestratorPlan | null {
  if (!isRecord(value) || value.type !== 'orchestrator_plan' || !Array.isArray(value.tasks)) {
    return null;
  }

  const tasks = value.tasks.map(normalizeTask);
  if (
    tasks.length < MIN_ORCHESTRATOR_TASKS ||
    tasks.length > MAX_ORCHESTRATOR_TASKS ||
    tasks.some(task => task === null)
  ) {
    return null;
  }

  return {
    type: 'orchestrator_plan',
    tasks: tasks as OrchestratorTask[],
  };
}

function normalizeTask(value: unknown): OrchestratorTask | null {
  if (!isRecord(value)) return null;

  const id = nonEmptyString(value.id);
  const description = nonEmptyString(value.description);
  const prompt = nonEmptyString(value.prompt);

  if (!id || !description || !prompt) return null;
  return { id, description, prompt };
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
