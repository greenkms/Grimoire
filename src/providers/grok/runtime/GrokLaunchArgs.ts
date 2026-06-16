import { normalizeGrokLaunchReasoningEffort } from '../models';

export function buildGrokAgentProcessArgs(
  reasoningEffort?: string | null,
): string[] {
  const normalizedEffort = normalizeGrokLaunchReasoningEffort(reasoningEffort);
  if (!normalizedEffort) {
    return ['agent', 'stdio'];
  }

  return ['agent', '--reasoning-effort', normalizedEffort, 'stdio'];
}