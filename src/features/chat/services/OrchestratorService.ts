import type { TabId } from '../tabs/types';

export interface OrchestratorServiceDeps {
  sendToTab: (tabId: TabId, message: string) => void;
}

type WorkerStatus = 'running' | 'done' | 'error' | 'closed';

interface WorkerState {
  orchestratorTabId: TabId;
  description: string;
  status: WorkerStatus;
}

const SYNTHESIS_PROMPT = 'All workers have reported. Please synthesize.';

export class OrchestratorService {
  private deps: OrchestratorServiceDeps;
  private fleetWorkers = new Map<TabId, Set<TabId>>();
  private workerStates = new Map<TabId, WorkerState>();

  constructor(deps: OrchestratorServiceDeps) {
    this.deps = deps;
  }

  registerWorker(orchestratorTabId: TabId, workerTabId: TabId, description: string): void {
    const fleet = this.fleetWorkers.get(orchestratorTabId) ?? new Set<TabId>();
    fleet.add(workerTabId);
    this.fleetWorkers.set(orchestratorTabId, fleet);
    this.workerStates.set(workerTabId, {
      orchestratorTabId,
      description,
      status: 'running',
    });
  }

  reportResult(workerTabId: TabId, result: string, isError = false): void {
    const worker = this.workerStates.get(workerTabId);
    if (!worker || this.isTerminal(worker.status)) return;
    if (!this.fleetWorkers.has(worker.orchestratorTabId)) return;

    worker.status = isError ? 'error' : 'done';
    this.deps.sendToTab(
      worker.orchestratorTabId,
      isError
        ? `Worker '${worker.description}' failed: ${result}`
        : `Worker '${worker.description}' finished: ${result}`,
    );
    this.sendSynthesisIfFleetComplete(worker.orchestratorTabId);
  }

  handleTabClosed(tabId: TabId): void {
    const orchestratorFleet = this.fleetWorkers.get(tabId);
    if (orchestratorFleet) {
      this.clearFleet(tabId, orchestratorFleet);
      return;
    }

    const worker = this.workerStates.get(tabId);
    if (!worker || this.isTerminal(worker.status)) return;
    if (!this.fleetWorkers.has(worker.orchestratorTabId)) return;

    worker.status = 'closed';
    this.deps.sendToTab(
      worker.orchestratorTabId,
      `Worker '${worker.description}' was closed before completing.`,
    );
    this.sendSynthesisIfFleetComplete(worker.orchestratorTabId);
  }

  getOrchestratorTabId(workerTabId: TabId): TabId | null {
    return this.workerStates.get(workerTabId)?.orchestratorTabId ?? null;
  }

  private sendSynthesisIfFleetComplete(orchestratorTabId: TabId): void {
    const fleet = this.fleetWorkers.get(orchestratorTabId);
    if (!fleet) return;

    const allWorkersTerminal = [...fleet].every((workerTabId) => {
      const worker = this.workerStates.get(workerTabId);
      return worker ? this.isTerminal(worker.status) : false;
    });

    if (!allWorkersTerminal) return;

    this.deps.sendToTab(orchestratorTabId, SYNTHESIS_PROMPT);
    this.clearFleet(orchestratorTabId, fleet);
  }

  private clearFleet(orchestratorTabId: TabId, fleet: Set<TabId>): void {
    for (const workerTabId of fleet) {
      this.workerStates.delete(workerTabId);
    }
    this.fleetWorkers.delete(orchestratorTabId);
  }

  private isTerminal(status: WorkerStatus): boolean {
    return status === 'done' || status === 'error' || status === 'closed';
  }
}
