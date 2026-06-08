import { t } from '../../../i18n/i18n';
import type { OrchestratorPlan } from './orchestratorPlanParser';

export type OrchestratorPlanDecision =
  | { type: 'spawn_workers'; plan: OrchestratorPlan }
  | { type: 'cancel' };

export class InlineOrchestratorPlan {
  private containerEl: HTMLElement;
  private plan: OrchestratorPlan;
  private resolveCallback: (decision: OrchestratorPlanDecision) => void;
  private resolved = false;

  private rootEl!: HTMLElement;
  private spawnButton!: HTMLButtonElement;
  private cancelButton!: HTMLButtonElement;

  constructor(
    containerEl: HTMLElement,
    plan: OrchestratorPlan,
    resolve: (decision: OrchestratorPlanDecision) => void,
  ) {
    this.containerEl = containerEl;
    this.plan = plan;
    this.resolveCallback = resolve;
  }

  render(): void {
    this.rootEl = this.containerEl.createDiv({ cls: 'grimoire-orchestrator-plan-inline' });

    const headerEl = this.rootEl.createDiv({ cls: 'grimoire-orchestrator-plan-header' });
    headerEl.createDiv({ cls: 'grimoire-orchestrator-plan-title', text: t('chat.orchestrator.planTitle') });
    headerEl.createDiv({
      cls: 'grimoire-orchestrator-plan-count',
      text: t('chat.orchestrator.workerCount', { count: this.plan.tasks.length }),
    });

    const listEl = this.rootEl.createEl('ol', { cls: 'grimoire-orchestrator-plan-tasks' });
    for (const task of this.plan.tasks) {
      const itemEl = listEl.createEl('li', { cls: 'grimoire-orchestrator-plan-task' });
      itemEl.createDiv({ cls: 'grimoire-orchestrator-plan-task-description', text: task.description });
      itemEl.createDiv({ cls: 'grimoire-orchestrator-plan-task-id', text: task.id });
    }

    const approvalEl = this.rootEl.createDiv({ cls: 'grimoire-orchestrator-plan-approval' });
    this.spawnButton = approvalEl.createEl('button', {
      cls: 'grimoire-orchestrator-plan-button grimoire-orchestrator-plan-spawn-button',
      text: t('chat.orchestrator.spawnWorkers'),
      attr: { type: 'button' },
    }) as HTMLButtonElement;
    this.cancelButton = approvalEl.createEl('button', {
      cls: 'grimoire-orchestrator-plan-button grimoire-orchestrator-plan-cancel-button',
      text: t('common.cancel'),
      attr: { type: 'button' },
    }) as HTMLButtonElement;

    this.spawnButton.addEventListener('click', () => {
      this.handleResolve({ type: 'spawn_workers', plan: this.plan });
    });
    this.cancelButton.addEventListener('click', () => {
      this.handleResolve({ type: 'cancel' });
    });
  }

  destroy(): void {
    this.rootEl?.remove();
  }

  private handleResolve(decision: OrchestratorPlanDecision): void {
    if (this.resolved) return;

    this.resolved = true;
    this.rootEl.addClass('is-resolved');
    this.spawnButton.disabled = true;
    this.cancelButton.disabled = true;
    this.resolveCallback(decision);
  }
}
