import { OrchestratorService } from '@/features/chat/services/OrchestratorService';

function createService() {
  const sent: Array<{ tabId: string; message: string }> = [];
  const service = new OrchestratorService({
    sendToTab: (tabId, message) => {
      sent.push({ tabId, message });
    },
  });

  return { sent, service };
}

describe('OrchestratorService', () => {
  it('maps registered workers back to their orchestrator tab', () => {
    const { service } = createService();

    expect(service.getOrchestratorTabId('worker-1')).toBeNull();

    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');

    expect(service.getOrchestratorTabId('worker-1')).toBe('orchestrator-1');
  });

  it('reports worker success to the orchestrator tab without synthesizing early', () => {
    const { sent, service } = createService();
    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');
    service.registerWorker('orchestrator-1', 'worker-2', 'Draft summary');

    service.reportResult('worker-1', 'Found three relevant notes.');

    expect(sent).toEqual([
      {
        tabId: 'orchestrator-1',
        message: "Worker 'Research vault' finished: Found three relevant notes.",
      },
    ]);
  });

  it('reports worker errors and sends synthesis once every worker is terminal', () => {
    const { sent, service } = createService();
    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');
    service.registerWorker('orchestrator-1', 'worker-2', 'Draft summary');

    service.reportResult('worker-1', 'Found three relevant notes.');
    service.reportResult('worker-2', 'Model failed.', true);

    expect(sent).toEqual([
      {
        tabId: 'orchestrator-1',
        message: "Worker 'Research vault' finished: Found three relevant notes.",
      },
      {
        tabId: 'orchestrator-1',
        message: "Worker 'Draft summary' failed: Model failed.",
      },
      {
        tabId: 'orchestrator-1',
        message: 'All workers have reported. Please synthesize.',
      },
    ]);
    expect(service.getOrchestratorTabId('worker-1')).toBeNull();
    expect(service.getOrchestratorTabId('worker-2')).toBeNull();
  });

  it('counts a closed worker as terminal and notifies the orchestrator', () => {
    const { sent, service } = createService();
    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');
    service.registerWorker('orchestrator-1', 'worker-2', 'Draft summary');

    service.reportResult('worker-1', 'Found three relevant notes.');
    service.handleTabClosed('worker-2');

    expect(sent).toEqual([
      {
        tabId: 'orchestrator-1',
        message: "Worker 'Research vault' finished: Found three relevant notes.",
      },
      {
        tabId: 'orchestrator-1',
        message: "Worker 'Draft summary' was closed before completing.",
      },
      {
        tabId: 'orchestrator-1',
        message: 'All workers have reported. Please synthesize.',
      },
    ]);
    expect(service.getOrchestratorTabId('worker-2')).toBeNull();
  });

  it('ignores unknown workers and duplicate terminal reports', () => {
    const { sent, service } = createService();
    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');

    service.reportResult('ghost-worker', 'late result');
    service.reportResult('worker-1', 'first result');
    const countAfterFirstResult = sent.length;
    service.reportResult('worker-1', 'second result');
    service.handleTabClosed('worker-1');

    expect(sent).toHaveLength(countAfterFirstResult);
  });

  it('drops a fleet when the orchestrator tab closes so late worker reports are no-ops', () => {
    const { sent, service } = createService();
    service.registerWorker('orchestrator-1', 'worker-1', 'Research vault');
    service.registerWorker('orchestrator-1', 'worker-2', 'Draft summary');

    service.handleTabClosed('orchestrator-1');
    service.reportResult('worker-1', 'late result');
    service.handleTabClosed('worker-2');

    expect(sent).toHaveLength(0);
    expect(service.getOrchestratorTabId('worker-1')).toBeNull();
    expect(service.getOrchestratorTabId('worker-2')).toBeNull();
  });
});
