import type { ApprovalCallback, ApprovalDecisionOption } from '../../core/runtime/types';
import type { ApprovalDecision } from '../../core/types';
import type {
  AcpRequestPermissionRequest,
  AcpRequestPermissionResponse,
} from './types';

type AcpPermissionOption = AcpRequestPermissionRequest['options'][number];
type AcpPermissionKind = AcpPermissionOption['kind'];

export function mapAcpApprovalDecision(
  decision: ApprovalDecision,
  options: readonly Pick<AcpPermissionOption, 'kind' | 'optionId'>[],
): AcpRequestPermissionResponse {
  if (typeof decision === 'object' && decision.type === 'select-option') {
    return {
      outcome: {
        optionId: decision.value,
        outcome: 'selected',
      },
    };
  }

  if (decision === 'allow') {
    return selectAcpPermissionOption(options, ['allow_once', 'allow_always']);
  }

  if (decision === 'allow-always') {
    return selectAcpPermissionOption(options, ['allow_always', 'allow_once']);
  }

  if (decision === 'deny') {
    return selectAcpPermissionOption(options, ['reject_once', 'reject_always']);
  }

  return { outcome: { outcome: 'cancelled' } };
}

export function buildAcpApprovalDecisionOptions(
  options: readonly Pick<AcpPermissionOption, 'kind' | 'name' | 'optionId'>[],
): ApprovalDecisionOption[] {
  return options.map((option) => ({
    label: option.name,
    presentation: option.kind === 'allow_once'
      ? 'allow'
      : option.kind === 'allow_always'
        ? 'always'
        : 'reject',
    value: option.optionId,
  }));
}

/**
 * Require an explicit UI approval for ACP client-side writeTextFile calls when
 * the session is not in full-access mode.
 */
export async function approveAcpWriteTextFile(params: {
  approvalCallback: ApprovalCallback | null;
  fullAccess: boolean;
  providerLabel: string;
  requestPath: string;
  resolvedPath: string;
}): Promise<void> {
  if (params.fullAccess) {
    return;
  }

  if (!params.approvalCallback) {
    throw new Error(`${params.providerLabel} file write was not approved`);
  }

  const decision = await params.approvalCallback(
    'write',
    {
      path: params.resolvedPath,
      relativePath: params.requestPath,
    },
    `${params.providerLabel} wants to write ${params.requestPath}.`,
    { decisionReason: 'File write permission required' },
  );

  if (decision !== 'allow' && decision !== 'allow-always') {
    throw new Error(`${params.providerLabel} file write was not approved`);
  }
}

function selectAcpPermissionOption(
  options: readonly Pick<AcpPermissionOption, 'kind' | 'optionId'>[],
  preferredKinds: readonly AcpPermissionKind[],
): AcpRequestPermissionResponse {
  for (const kind of preferredKinds) {
    const option = options.find((entry) => entry.kind === kind);
    if (option) {
      return {
        outcome: {
          optionId: option.optionId,
          outcome: 'selected',
        },
      };
    }
  }

  return { outcome: { outcome: 'cancelled' } };
}
