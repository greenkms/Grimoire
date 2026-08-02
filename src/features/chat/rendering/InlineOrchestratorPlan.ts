import { setIcon } from 'obsidian';

import type { ProviderId } from '../../../core/providers/types';
import { t } from '../../../i18n/i18n';
import type { OrchestratorPlan } from './orchestratorPlanParser';

export type OrchestratorPlanDecision =
  | { type: 'spawn_workers'; plan: OrchestratorPlan }
  | { type: 'cancel' };

export interface OrchestratorPlanPresentation {
  interactive?: boolean;
  modelLabel?: string;
  providerId?: ProviderId;
}

export class InlineOrchestratorPlan {
  private readonly containerEl: HTMLElement;
  private readonly plan: OrchestratorPlan;
  private readonly presentation: OrchestratorPlanPresentation;
  private readonly resolveCallback: (decision: OrchestratorPlanDecision) => void;
  private readonly selectedTaskIds: Set<string>;
  private readonly taskToggleEls = new Map<string, HTMLButtonElement>();
  private readonly taskNumberEls = new Map<string, HTMLElement>();
  private resolved = false;

  private rootEl!: HTMLElement;
  private spawnButton: HTMLButtonElement | null = null;
  private cancelButton: HTMLButtonElement | null = null;
  private selectedCountEl!: HTMLElement;
  private spawnCountEl: HTMLElement | null = null;

  constructor(
    containerEl: HTMLElement,
    plan: OrchestratorPlan,
    resolve: (decision: OrchestratorPlanDecision) => void,
    presentation: OrchestratorPlanPresentation = {},
  ) {
    this.containerEl = containerEl;
    this.plan = plan;
    this.resolveCallback = resolve;
    this.presentation = presentation;
    this.selectedTaskIds = new Set(plan.tasks.map(task => task.id));
  }

  render(): void {
    this.rootEl = this.containerEl.createDiv({ cls: 'grimoire-orchestrator-plan-inline' });
    if (this.presentation.interactive === false) {
      this.rootEl.addClass('is-readonly');
    }

    this.renderSummary();
    const cardEl = this.rootEl.createDiv({ cls: 'grimoire-orchestrator-plan-card' });
    this.renderHeader(cardEl);
    this.renderTasks(cardEl);
    if (this.presentation.interactive !== false) {
      this.renderApproval(cardEl);
    }
    this.refreshSelection();
  }

  destroy(): void {
    this.rootEl?.remove();
  }

  private renderSummary(): void {
    const summaryHeaderEl = this.rootEl.createDiv({ cls: 'grimoire-orchestrator-plan-summary-header' });
    const badgeEl = summaryHeaderEl.createDiv({ cls: 'grimoire-orchestrator-plan-badge' });
    const badgeIconEl = badgeEl.createSpan({ cls: 'grimoire-orchestrator-plan-badge-icon' });
    setIcon(badgeIconEl, 'git-fork');
    badgeEl.createSpan({ text: t('chat.orchestrator.badge') });

    this.rootEl.createDiv({
      cls: 'grimoire-orchestrator-plan-summary',
      text: t('chat.orchestrator.planSummary', { count: this.plan.tasks.length }),
    });
  }

  private renderHeader(cardEl: HTMLElement): void {
    const headerEl = cardEl.createDiv({ cls: 'grimoire-orchestrator-plan-header' });
    const titleGroupEl = headerEl.createDiv({ cls: 'grimoire-orchestrator-plan-title-group' });
    titleGroupEl.createDiv({
      cls: 'grimoire-orchestrator-plan-eyebrow',
      text: t('chat.orchestrator.planEyebrow'),
    });
    titleGroupEl.createDiv({
      cls: 'grimoire-orchestrator-plan-title',
      text: t('chat.orchestrator.planTitle'),
    });

    const selectionEl = headerEl.createDiv({ cls: 'grimoire-orchestrator-plan-selection' });
    const numbersEl = selectionEl.createDiv({ cls: 'grimoire-orchestrator-plan-numbers' });
    this.plan.tasks.forEach((task, index) => {
      const numberEl = numbersEl.createSpan({
        cls: 'grimoire-orchestrator-plan-number',
        text: String(index + 1),
      });
      this.taskNumberEls.set(task.id, numberEl);
    });
    this.selectedCountEl = selectionEl.createSpan({ cls: 'grimoire-orchestrator-plan-selected-count' });
  }

  private renderTasks(cardEl: HTMLElement): void {
    const listEl = cardEl.createDiv({ cls: 'grimoire-orchestrator-plan-tasks' });
    for (const task of this.plan.tasks) {
      const itemEl = listEl.createDiv({ cls: 'grimoire-orchestrator-plan-task' });
      const toggleEl = itemEl.createEl('button', {
        cls: 'grimoire-orchestrator-plan-task-toggle',
        attr: {
          type: 'button',
          'aria-label': t('chat.orchestrator.toggleTask', { task: task.description }),
        },
      });
      setIcon(toggleEl, 'check');
      this.taskToggleEls.set(task.id, toggleEl);
      if (this.presentation.interactive !== false) {
        toggleEl.addEventListener('click', () => this.toggleTask(task.id));
      } else {
        toggleEl.disabled = true;
      }

      const contentEl = itemEl.createDiv({ cls: 'grimoire-orchestrator-plan-task-content' });
      contentEl.createDiv({
        cls: 'grimoire-orchestrator-plan-task-description',
        text: task.description,
      });
      const metaEl = contentEl.createDiv({ cls: 'grimoire-orchestrator-plan-task-meta' });
      metaEl.createSpan({ cls: 'grimoire-orchestrator-plan-task-id', text: task.id });
      metaEl.createSpan({
        cls: 'grimoire-orchestrator-plan-task-mode',
        text: t('chat.orchestrator.parallel'),
      });

      if (this.presentation.modelLabel) {
        const modelEl = itemEl.createDiv({
          cls: 'grimoire-orchestrator-plan-model',
          attr: this.presentation.providerId
            ? { 'data-provider': this.presentation.providerId }
            : {},
        });
        modelEl.createSpan({ cls: 'grimoire-orchestrator-plan-model-dot' });
        modelEl.createSpan({ cls: 'grimoire-orchestrator-plan-model-label', text: this.presentation.modelLabel });
      }
    }
  }

  private renderApproval(cardEl: HTMLElement): void {
    const approvalEl = cardEl.createDiv({ cls: 'grimoire-orchestrator-plan-approval' });
    approvalEl.createDiv({
      cls: 'grimoire-orchestrator-plan-footnote',
      text: t('chat.orchestrator.workerTabsHint'),
    });

    const actionsEl = approvalEl.createDiv({ cls: 'grimoire-orchestrator-plan-actions' });
    this.cancelButton = actionsEl.createEl('button', {
      cls: 'grimoire-orchestrator-plan-button grimoire-orchestrator-plan-cancel-button',
      text: t('common.cancel'),
      attr: { type: 'button' },
    });
    this.spawnButton = actionsEl.createEl('button', {
      cls: 'grimoire-orchestrator-plan-button grimoire-orchestrator-plan-spawn-button',
      attr: { type: 'button' },
    });
    this.spawnButton.createSpan({ text: t('chat.orchestrator.spawnWorkers') });
    this.spawnCountEl = this.spawnButton.createSpan({ cls: 'grimoire-orchestrator-plan-spawn-count' });

    this.spawnButton.addEventListener('click', () => {
      const tasks = this.plan.tasks.filter(task => this.selectedTaskIds.has(task.id));
      if (tasks.length === 0) return;
      this.handleResolve({
        type: 'spawn_workers',
        plan: { ...this.plan, tasks },
      });
    });
    this.cancelButton.addEventListener('click', () => {
      this.handleResolve({ type: 'cancel' });
    });
  }

  private toggleTask(taskId: string): void {
    if (this.resolved) return;
    if (this.selectedTaskIds.has(taskId)) {
      this.selectedTaskIds.delete(taskId);
    } else {
      this.selectedTaskIds.add(taskId);
    }
    this.refreshSelection();
  }

  private refreshSelection(): void {
    for (const task of this.plan.tasks) {
      const selected = this.selectedTaskIds.has(task.id);
      const toggleEl = this.taskToggleEls.get(task.id);
      toggleEl?.toggleClass('is-selected', selected);
      toggleEl?.setAttribute('aria-pressed', String(selected));
      this.taskNumberEls.get(task.id)?.toggleClass('is-selected', selected);
    }

    const selectedCount = this.selectedTaskIds.size;
    this.selectedCountEl.setText(t('chat.orchestrator.workerCount', {
      count: selectedCount,
      total: this.plan.tasks.length,
    }));
    this.spawnCountEl?.setText(String(selectedCount));
    if (this.spawnButton) {
      this.spawnButton.disabled = selectedCount === 0 || this.resolved;
    }
  }

  private handleResolve(decision: OrchestratorPlanDecision): void {
    if (this.resolved) return;

    this.resolved = true;
    this.rootEl.addClass('is-resolved');
    this.taskToggleEls.forEach(element => {
      element.disabled = true;
    });
    if (this.spawnButton) this.spawnButton.disabled = true;
    if (this.cancelButton) this.cancelButton.disabled = true;
    this.resolveCallback(decision);
  }
}
