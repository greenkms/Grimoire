import { setIcon } from 'obsidian';

import type { ApprovalDecisionOption } from '../../../core/runtime/types';
import { setToolIcon } from './ToolCallRenderer';

export interface InlinePermissionRequestConfig {
  toolName: string;
  input: Record<string, unknown>;
  description: string;
  decisionOptions: ApprovalDecisionOption[];
  decisionReason?: string;
  blockedPath?: string;
  agentID?: string;
  resolve: (value: string | null) => void;
}

type PermissionAction = 'allow' | 'always' | 'reject' | 'other';

export class InlinePermissionRequest {
  private containerEl: HTMLElement;
  private config: InlinePermissionRequestConfig;
  private resolved = false;
  private rootEl!: HTMLElement;
  private boundKeyDown: (event: KeyboardEvent) => void;

  constructor(containerEl: HTMLElement, config: InlinePermissionRequestConfig) {
    this.containerEl = containerEl;
    this.config = config;
    this.boundKeyDown = (event) => this.handleKeyDown(event);
  }

  render(): void {
    this.rootEl = this.containerEl.createDiv({ cls: 'grimoire-permission-anchor' });

    const cardEl = this.rootEl.createDiv({ cls: 'grimoire-permission-request' });
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-label', 'Permission required');

    this.renderHeader(cardEl);
    this.renderBody(cardEl);
    this.renderActions(cardEl);
    this.renderFooter(cardEl);

    const ownerDocument = this.rootEl.ownerDocument ?? window.document;
    ownerDocument.addEventListener('keydown', this.boundKeyDown);

    window.requestAnimationFrame(() => {
      this.rootEl.focus();
    });
  }

  destroy(): void {
    this.handleResolve(null);
  }

  private renderHeader(cardEl: HTMLElement): void {
    const headEl = cardEl.createDiv({ cls: 'grimoire-permission-head' });

    const shieldEl = headEl.createSpan({ cls: 'grimoire-permission-shield' });
    setIcon(shieldEl, 'shield-check');

    const titleEl = headEl.createDiv({ cls: 'grimoire-permission-title-block' });
    titleEl.createEl('strong', {
      cls: 'grimoire-permission-title',
      text: 'Permission required',
    });
    titleEl.createSpan({
      cls: 'grimoire-permission-subtitle',
      text: this.getSubtitle(),
    });

    const toolEl = headEl.createSpan({ cls: 'grimoire-permission-tool grimoire-ask-approval-tool' });
    const iconEl = toolEl.createSpan({ cls: 'grimoire-ask-approval-icon' });
    setToolIcon(iconEl, this.config.toolName);
    toolEl.createSpan({
      cls: 'grimoire-permission-tool-label grimoire-ask-approval-tool-name',
      text: this.getToolLabel(),
    });
  }

  private renderBody(cardEl: HTMLElement): void {
    const bodyEl = cardEl.createDiv({ cls: 'grimoire-permission-body grimoire-ask-approval-info' });

    if (this.config.decisionReason) {
      bodyEl.createDiv({
        cls: 'grimoire-permission-reason grimoire-ask-approval-reason',
        text: this.config.decisionReason,
      });
    }

    if (this.config.blockedPath) {
      bodyEl.createDiv({
        cls: 'grimoire-permission-blocked-path grimoire-ask-approval-blocked-path',
        text: this.config.blockedPath,
      });
    }

    if (this.config.agentID) {
      bodyEl.createDiv({
        cls: 'grimoire-permission-agent grimoire-ask-approval-agent',
        text: `Agent: ${this.config.agentID}`,
      });
    }

    const command = this.getCommandText();
    if (command) {
      const commandEl = bodyEl.createDiv({ cls: 'grimoire-permission-command' });
      commandEl.createSpan({ cls: 'grimoire-permission-dollar', text: '$' });
      commandEl.createEl('code', { cls: 'grimoire-permission-command-code', text: command });
    }

    bodyEl.createDiv({
      cls: 'grimoire-permission-description grimoire-ask-approval-desc',
      text: this.config.description,
    });
  }

  private renderActions(cardEl: HTMLElement): void {
    const actionsEl = cardEl.createDiv({ cls: 'grimoire-permission-actions grimoire-ask-list' });

    for (const option of this.config.decisionOptions) {
      const action = this.getAction(option);
      const buttonEl = actionsEl.createEl('button', {
        cls: [
          'grimoire-permission-button',
          'grimoire-ask-item',
          `grimoire-permission-button--${action}`,
        ].join(' '),
        attr: { type: 'button' },
      });

      if (action === 'allow') {
        setIcon(buttonEl.createSpan({ cls: 'grimoire-permission-button-icon' }), 'check');
      } else if (action === 'reject') {
        setIcon(buttonEl.createSpan({ cls: 'grimoire-permission-button-icon' }), 'x');
      }

      buttonEl.createSpan({
        cls: 'grimoire-permission-button-label',
        text: this.getDisplayLabel(option),
      });
      buttonEl.createSpan({
        cls: 'grimoire-ask-item-label grimoire-permission-compat-label',
        text: option.label,
      });
      if (option.description) {
        buttonEl.createSpan({
          cls: 'grimoire-ask-item-desc grimoire-permission-option-description',
          text: option.description,
        });
      }
      buttonEl.addEventListener('click', () => this.handleResolve(option.value));
    }
  }

  private renderFooter(cardEl: HTMLElement): void {
    const footEl = cardEl.createDiv({ cls: 'grimoire-permission-foot' });
    footEl.createEl('kbd', { text: '\u21B5' });
    footEl.appendText(' allow ');
    footEl.createSpan({ cls: 'grimoire-permission-separator', text: '\u00B7' });
    footEl.appendText(' ');
    footEl.createEl('kbd', { text: 'A' });
    footEl.appendText(' always ');
    footEl.createSpan({ cls: 'grimoire-permission-separator', text: '\u00B7' });
    footEl.appendText(' ');
    footEl.createEl('kbd', { cls: 'grimoire-permission-key-escape', text: 'Esc' });
    footEl.appendText(' reject');
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.resolved) return;

    if (event.key === 'Enter') {
      const option = this.findOption('allow');
      if (option) {
        event.preventDefault();
        event.stopPropagation();
        this.handleResolve(option.value);
      }
      return;
    }

    if (event.key === 'a' || event.key === 'A') {
      const option = this.findOption('always');
      if (option) {
        event.preventDefault();
        event.stopPropagation();
        this.handleResolve(option.value);
      }
      return;
    }

    if (event.key === 'Escape') {
      const option = this.findOption('reject');
      event.preventDefault();
      event.stopPropagation();
      this.handleResolve(option?.value ?? null);
    }
  }

  private findOption(action: PermissionAction): ApprovalDecisionOption | undefined {
    return this.config.decisionOptions.find(option => this.getAction(option) === action);
  }

  private getAction(option: ApprovalDecisionOption): PermissionAction {
    if (option.decision === 'allow') return 'allow';
    if (option.decision === 'allow-always') return 'always';
    if (option.decision === 'deny' || option.decision === 'cancel') return 'reject';

    const normalized = option.label.toLowerCase();
    if (normalized.includes('always')) return 'always';
    if (normalized.includes('allow')) return 'allow';
    if (normalized.includes('deny') || normalized.includes('reject') || normalized.includes('cancel')) {
      return 'reject';
    }
    return 'other';
  }

  private getDisplayLabel(option: ApprovalDecisionOption): string {
    const action = this.getAction(option);
    if (action === 'reject' && /^deny$/i.test(option.label)) {
      return 'Reject';
    }
    return option.label;
  }

  private getToolLabel(): string {
    if (/^bash$/i.test(this.config.toolName)) {
      return 'bash';
    }
    return this.config.toolName;
  }

  private getSubtitle(): string {
    if (/^bash$/i.test(this.config.toolName)) {
      return 'Grimoire wants to run a shell command';
    }
    return `Grimoire wants to use ${this.getToolLabel()}`;
  }

  private getCommandText(): string {
    const command = this.config.input.command ?? this.config.input.cmd;
    return typeof command === 'string' ? command : '';
  }

  private handleResolve(value: string | null): void {
    if (this.resolved) return;
    this.resolved = true;

    const ownerDocument = this.rootEl?.ownerDocument ?? window.document;
    ownerDocument.removeEventListener('keydown', this.boundKeyDown);
    this.rootEl?.remove();
    this.config.resolve(value);
  }
}
