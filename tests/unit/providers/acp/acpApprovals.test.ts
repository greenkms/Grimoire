import {
  approveAcpWriteTextFile,
  buildAcpApprovalDecisionOptions,
  mapAcpApprovalDecision,
} from '@/providers/acp/acpApprovals';

describe('acpApprovals', () => {
  const options = [
    { kind: 'allow_once' as const, name: 'Allow once', optionId: 'allow-1' },
    { kind: 'allow_always' as const, name: 'Allow always', optionId: 'allow-all' },
    { kind: 'reject_once' as const, name: 'Reject', optionId: 'reject-1' },
  ];

  it('maps allow / allow-always / deny to ACP permission options', () => {
    expect(mapAcpApprovalDecision('allow', options)).toEqual({
      outcome: { optionId: 'allow-1', outcome: 'selected' },
    });
    expect(mapAcpApprovalDecision('allow-always', options)).toEqual({
      outcome: { optionId: 'allow-all', outcome: 'selected' },
    });
    expect(mapAcpApprovalDecision('deny', options)).toEqual({
      outcome: { optionId: 'reject-1', outcome: 'selected' },
    });
    expect(mapAcpApprovalDecision('cancel', options)).toEqual({
      outcome: { outcome: 'cancelled' },
    });
  });

  it('maps select-option decisions by value', () => {
    expect(mapAcpApprovalDecision({ type: 'select-option', value: 'allow-all' }, options)).toEqual({
      outcome: { optionId: 'allow-all', outcome: 'selected' },
    });
  });

  it('builds decision options for the shared approval UI', () => {
    expect(buildAcpApprovalDecisionOptions(options)).toEqual([
      { label: 'Allow once', presentation: 'allow', value: 'allow-1' },
      { label: 'Allow always', presentation: 'always', value: 'allow-all' },
      { label: 'Reject', presentation: 'reject', value: 'reject-1' },
    ]);
  });

  it('skips write approval in full-access mode', async () => {
    const approvalCallback = jest.fn();
    await expect(approveAcpWriteTextFile({
      approvalCallback,
      fullAccess: true,
      providerLabel: 'OpenCode',
      requestPath: 'a.md',
      resolvedPath: '/vault/a.md',
    })).resolves.toBeUndefined();
    expect(approvalCallback).not.toHaveBeenCalled();
  });

  it('requires an allow decision for non-full-access writes', async () => {
    await expect(approveAcpWriteTextFile({
      approvalCallback: null,
      fullAccess: false,
      providerLabel: 'OpenCode',
      requestPath: 'a.md',
      resolvedPath: '/vault/a.md',
    })).rejects.toThrow('OpenCode file write was not approved');

    const deny = jest.fn().mockResolvedValue('deny');
    await expect(approveAcpWriteTextFile({
      approvalCallback: deny,
      fullAccess: false,
      providerLabel: 'OpenCode',
      requestPath: 'a.md',
      resolvedPath: '/vault/a.md',
    })).rejects.toThrow('OpenCode file write was not approved');
    expect(deny).toHaveBeenCalled();

    const allow = jest.fn().mockResolvedValue('allow');
    await expect(approveAcpWriteTextFile({
      approvalCallback: allow,
      fullAccess: false,
      providerLabel: 'OpenCode',
      requestPath: 'a.md',
      resolvedPath: '/vault/a.md',
    })).resolves.toBeUndefined();
  });
});
