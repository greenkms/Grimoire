import { setIcon } from 'obsidian';

import type { ApprovalDecisionOption } from '../../../core/runtime/types';
import { t } from '../../../i18n/i18n';
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

let permissionDialogSequence = 0;

export class InlinePermissionRequest {
  private containerEl: HTMLElement;
  private config: InlinePermissionRequestConfig;
  private resolved = false;
  private rootEl!: HTMLElement;
  private readonly titleId = `grimoire-permission-title-${++permissionDialogSequence}`;
  private boundKeyDown: (event: KeyboardEvent) => void;

  constructor(containerEl: HTMLElement, config: InlinePermissionRequestConfig) {
    this.containerEl = containerEl;
    this.config = config;
    this.boundKeyDown = (event) => this.handleKeyDown(event);
  }

  render(): void {
    this.rootEl = this.containerEl.createDiv({ cls: 'grimoire-permission-anchor' });
    this.rootEl.setAttribute('tabindex', '-1');

    const cardEl = this.rootEl.createDiv({ cls: 'grimoire-permission-request' });
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-labelledby', this.titleId);

    this.renderHeader(cardEl);
    this.renderBody(cardEl);
    this.renderActions(cardEl);

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
      text: t('chat.ui.permission.required'),
      attr: { id: this.titleId },
    });
    titleEl.createSpan({
      cls: 'grimoire-permission-subtitle',
      text: this.getSubtitle(),
    });

    const toolEl = headEl.createSpan({ cls: 'grimoire-permission-tool grimoire-ask-approval-tool' });
    const command = this.getCommandText();
    if (command) {
      toolEl.setAttribute('title', command);
      toolEl.setAttribute('aria-label', t('chat.ui.permission.commandPreview', { command }));
    }
    const iconEl = toolEl.createSpan({ cls: 'grimoire-ask-approval-icon' });
    setToolIcon(iconEl, command ? 'bash' : this.config.toolName);
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
        text: t('chat.ui.permission.agent', { agent: this.config.agentID }),
      });
    }

    const command = this.getCommandText();
    if (command) {
      const commandEl = bodyEl.createDiv({ cls: 'grimoire-permission-command' });
      commandEl.createSpan({ cls: 'grimoire-permission-dollar', text: '$' });
      commandEl.createEl('code', { cls: 'grimoire-permission-command-code', text: command });
    }

    const description = this.getDescription();
    if (description) {
      bodyEl.createDiv({
        cls: 'grimoire-permission-description grimoire-ask-approval-desc',
        text: description,
      });
    }
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
      return t('chat.ui.permission.reject');
    }
    return option.label;
  }

  private getToolLabel(): string {
    const command = this.getCommandText();
    if (command) {
      return buildPermissionCommandSummary(command);
    }

    const toolName = this.config.toolName.trim() || t('chat.ui.permission.tool');
    if (/^(?:bash|execute|run)(?:\s|$)/i.test(toolName)) {
      return 'bash';
    }
    return toolName.length > 28 ? `${toolName.slice(0, 27)}…` : toolName;
  }

  private getSubtitle(): string {
    if (this.getCommandText() || this.getToolLabel() === 'bash') {
      return t('chat.ui.permission.runShellCommand');
    }
    return t('chat.ui.permission.useTool', { tool: this.getToolLabel() });
  }

  private getCommandText(): string {
    const command = this.config.input.command ?? this.config.input.cmd;
    return typeof command === 'string' ? command : '';
  }

  private getDescription(): string | null {
    if (!this.getCommandText()) {
      return this.config.description;
    }

    const providerRequest = this.config.description.match(/^(.+?) wants permission to use\b/i);
    if (providerRequest?.[1]) {
      return t('chat.ui.permission.providerRequestedCommand', { provider: providerRequest[1] });
    }

    const command = this.getCommandText().trim();
    const description = this.config.description.trim();
    const normalizedDescription = description
      .replace(/^(?:execute|run(?: command)?):?\s*/i, '')
      .trim();
    if (!description || description === command || normalizedDescription === command) {
      return null;
    }

    return description;
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

export function buildPermissionCommandSummary(command: string): string {
  const tokens = tokenizeCommandPreview(command);
  const executableToken = tokens.shift();
  if (!executableToken) {
    return t('chat.ui.permission.shellCommand');
  }

  const executable = getPathBasename(executableToken) || executableToken;
  const argumentLabels: string[] = [];
  let remainingArgumentCount = 0;

  for (const token of tokens) {
    if (isShellOperator(token)) {
      break;
    }
    if (token.startsWith('-') || isRedirectionToken(token)) {
      continue;
    }

    const label = summarizeCommandArgument(token);
    if (!label || argumentLabels.includes(label)) {
      continue;
    }
    if (argumentLabels.length < 2) {
      argumentLabels.push(label);
    } else {
      remainingArgumentCount += 1;
    }
  }

  if (argumentLabels.length === 0) {
    return truncateCommandSummary(executable, 44);
  }

  const suffix = remainingArgumentCount > 0 ? ` +${remainingArgumentCount}` : '';
  return truncateCommandSummary(
    `${executable} · ${argumentLabels.join(', ')}${suffix}`,
    64,
  );
}

function tokenizeCommandPreview(command: string): string[] {
  return command
    .match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/g)
    ?.map(token => token.replace(/^(?:"|')|(?:"|')$/g, ''))
    ?? [];
}

function summarizeCommandArgument(argument: string): string {
  const normalized = argument.replace(/[;,]+$/, '').replace(/[\\/]+$/, '');
  if (!normalized || normalized === '.') {
    return normalized;
  }

  return truncateCommandSummary(getPathBasename(normalized) || normalized, 22);
}

function getPathBasename(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function isShellOperator(token: string): boolean {
  return token === '&&' || token === '||' || token === '|' || token === ';';
}

function isRedirectionToken(token: string): boolean {
  return /^(?:\d*>|\d*>>|\d*<|\d*>&\d+|&>)/.test(token);
}

function truncateCommandSummary(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
