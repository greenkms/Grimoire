import { normalizeGrokLaunchReasoningEffort } from '../models';
import type { GrokPermissionMode } from '../modes';

export function buildGrokAgentProcessArgs(
  reasoningEffort?: string | null,
  permissionMode?: GrokPermissionMode,
): string[] {
  const args = ['agent'];
  if (permissionMode === 'always-approve') {
    args.push('--always-approve');
  }

  const normalizedEffort = normalizeGrokLaunchReasoningEffort(reasoningEffort);
  if (normalizedEffort) {
    args.push('--reasoning-effort', normalizedEffort);
  }

  args.push('stdio');
  return args;
}
