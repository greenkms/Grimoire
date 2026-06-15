import { Notice, setIcon } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

import type { ProjectWorkspace } from '../../../core/context/types';
import type { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  ProviderCapabilities,
  ProviderChatUIConfig,
  ProviderId,
  ProviderModeSelectorConfig,
  ProviderPermissionModeToggleConfig,
  ProviderPlanUsage,
  ProviderPlanUsageWindow,
  ProviderReasoningOption,
  ProviderServiceTierToggleConfig,
  ProviderUIOption,
} from '../../../core/providers/types';
import type {
  ManagedMcpServer,
  UsageInfo,
} from '../../../core/types';
import { t } from '../../../i18n/i18n';
import { appendCheckIcon, appendMcpIcon, createProviderIconSvg } from '../../../shared/icons';
import { filterValidPaths, findConflictingPath, isDuplicatePath, isValidDirectoryPath, validateDirectoryPath } from '../../../utils/externalContext';
import { expandHomePath, normalizePathForFilesystem } from '../../../utils/path';

interface ElectronOpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface ElectronRemoteApi {
  dialog: {
    showOpenDialog(options: { properties: string[]; title: string }): Promise<ElectronOpenDialogResult>;
  };
}

function runToolbarAction(action: () => Promise<void>, failureMessage: string): void {
  void action().catch(() => {
    new Notice(failureMessage);
  });
}

function formatModelFallbackLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return 'Unknown';
  }
  if (/^gpt-/i.test(trimmed)) {
    return trimmed.replace(/^gpt-/i, 'GPT-').replace(/-([a-z])/gi, (_, letter: string) => ` ${letter.toUpperCase()}`);
  }
  return trimmed
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatModelButtonLabel(label: string): string {
  const trimmed = label.trim();
  const slashIndex = trimmed.lastIndexOf('/');
  if (slashIndex <= 0 || slashIndex >= trimmed.length - 1) {
    return trimmed;
  }

  return trimmed.slice(slashIndex + 1).trim() || trimmed;
}

const PLAN_USAGE_WARN_THRESHOLD = 80;
const FIVE_HOUR_WINDOW_PATTERN = /5\s*-?\s*h/i;
const WEEKLY_WINDOW_PATTERN = /week/i;

function clampUsagePct(pct: number): number {
  if (!Number.isFinite(pct)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function isQuotaUsage(usage: ProviderPlanUsage | null | undefined): usage is ProviderPlanUsage & { windows: ProviderPlanUsageWindow[] } {
  return Array.isArray(usage?.windows);
}

function isSpendUsage(usage: ProviderPlanUsage | null | undefined): usage is ProviderPlanUsage & { spend: string } {
  return typeof usage?.spend === 'string' && usage.spend.trim().length > 0;
}

function normalizeUsageWindow(window: ProviderPlanUsageWindow): ProviderPlanUsageWindow {
  return {
    label: window.label,
    pct: clampUsagePct(window.pct),
    ...(window.pctKnown === false ? { pctKnown: false } : {}),
    reset: window.reset,
  };
}

function findFiveHourWindow(usage: ProviderPlanUsage | null | undefined): ProviderPlanUsageWindow | null {
  if (!isQuotaUsage(usage)) {
    return null;
  }
  const window = usage.windows.find(item => FIVE_HOUR_WINDOW_PATTERN.test(item.label));
  if (!window) {
    return null;
  }
  const normalized = normalizeUsageWindow(window);
  return isUsagePctKnown(normalized) ? normalized : null;
}

function findPrimaryQuotaWindow(usage: ProviderPlanUsage | null | undefined): ProviderPlanUsageWindow | null {
  const fiveHourWindow = findFiveHourWindow(usage);
  if (fiveHourWindow) {
    return fiveHourWindow;
  }

  if (!isQuotaUsage(usage)) {
    return null;
  }

  for (const window of usage.windows) {
    const normalized = normalizeUsageWindow(window);
    if (isUsagePctKnown(normalized)) {
      return normalized;
    }
  }

  return null;
}

function formatQuotaBadgeLabel(label: string): string {
  if (FIVE_HOUR_WINDOW_PATTERN.test(label)) {
    return '5H';
  }
  if (WEEKLY_WINDOW_PATTERN.test(label)) {
    return 'WK';
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return 'Usage';
  }

  return trimmed.length <= 4 ? trimmed.toUpperCase() : trimmed;
}

function formatQuotaLimitDescription(window: ProviderPlanUsageWindow): string {
  if (FIVE_HOUR_WINDOW_PATTERN.test(window.label)) {
    return '5-hour limit';
  }

  return `${window.label} limit`;
}

function findWeeklyWindow(usage: ProviderPlanUsage): ProviderPlanUsageWindow | null {
  if (!isQuotaUsage(usage)) {
    return null;
  }
  const window = usage.windows.find(item => WEEKLY_WINDOW_PATTERN.test(item.label));
  if (!window) {
    return null;
  }
  const normalized = normalizeUsageWindow(window);
  return isUsagePctKnown(normalized) ? normalized : null;
}

function stripThisMonth(spend: string): string {
  return spend.replace(/\s+this\s+month\s*$/i, '').trim() || spend.trim();
}

function isUsagePctKnown(window: ProviderPlanUsageWindow): boolean {
  return window.pctKnown !== false;
}

function formatUsagePct(window: ProviderPlanUsageWindow): string {
  return isUsagePctKnown(window) ? `${window.pct}%` : '—';
}

function isUsageWindowHot(window: ProviderPlanUsageWindow): boolean {
  return isUsagePctKnown(window) && window.pct >= PLAN_USAGE_WARN_THRESHOLD;
}

function formatQuotaAriaLabel(plan: string, window: ProviderPlanUsageWindow): string {
  const limitDescription = formatQuotaLimitDescription(window);
  return isUsagePctKnown(window)
    ? `${plan} ${limitDescription}: ${window.pct}% used, resets ${window.reset}`
    : `${plan} ${limitDescription}: resets ${window.reset}`;
}

function areUsageIndicatorsEnabled(settings: Partial<ToolbarSettings> | null | undefined): boolean {
  return settings?.usageIndicatorsEnabled !== false;
}

export interface ToolbarSettings {
  model: string;
  thinkingBudget: string;
  effortLevel: string;
  serviceTier: string;
  permissionMode: string;
  usageIndicatorsEnabled?: boolean;
  [key: string]: unknown;
}

export interface ToolbarCallbacks {
  onModelChange: (model: string) => Promise<void>;
  onModeChange: (mode: string) => Promise<void>;
  onThinkingBudgetChange: (budget: string) => Promise<void>;
  onEffortLevelChange: (effort: string) => Promise<void>;
  onServiceTierChange: (serviceTier: string) => Promise<void>;
  onPermissionModeChange: (mode: string) => Promise<void>;
  onOrchestratorModeChange?: () => Promise<void>;
  getSettings: () => ToolbarSettings;
  getEnvironmentVariables?: () => string;
  getUIConfig: () => ProviderChatUIConfig;
  getCapabilities: () => ProviderCapabilities;
  refreshModelOptions?: () => Promise<void>;
  getProviderId?: () => ProviderId;
  getProviderUsage?: (providerId: ProviderId) => ProviderPlanUsage | null;
  refreshProviderUsage?: (providerId: ProviderId) => Promise<ProviderPlanUsage | null>;
  onProviderUsageRefresh?: (providerId: ProviderId) => void;
  resolveProviderForModel?: (model: string) => ProviderId;
  getOrchestratorMode?: () => boolean;
  getProjectWorkspaces?: () => ProjectWorkspace[];
  getActiveProjectWorkspaceId?: () => string;
  onProjectWorkspaceChange?: (workspaceId: string) => Promise<void>;
}

export class ModelSelector {
  private container: HTMLElement;
  private buttonEl: HTMLElement | null = null;
  private dropdownEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private pendingModel: string | null = null;
  private modelCatalogRefreshPromise: Promise<void> | null = null;
  private modelCatalogRefreshFailed = false;
  private isRefreshingModelCatalog = false;
  private providerUsageRefreshPromises = new Map<ProviderId, Promise<ProviderPlanUsage | null>>();
  private modelGroupOpenState = new Map<string, boolean>();
  private searchQuery = '';
  private callbacks: ToolbarCallbacks;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-model-selector' });
    this.render();
  }

  destroy(): void {
    this.removeOutsideListeners();
  }

  private removeOutsideListeners(): void {
    if (this.outsideClickHandler) {
      this.container.ownerDocument.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.escapeHandler) {
      this.container.ownerDocument.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
  }

  private getAvailableModels() {
    const settings = this.callbacks.getSettings();
    const uiConfig = this.callbacks.getUIConfig();
    return uiConfig.getModelOptions({
      ...settings,
      environmentVariables: this.callbacks.getEnvironmentVariables?.(),
    });
  }

  private getCurrentModel(): string {
    return this.pendingModel ?? this.callbacks.getSettings().model;
  }

  private render() {
    this.container.empty();

    this.buttonEl = this.container.createDiv({ cls: 'grimoire-model-btn' });
    this.buttonEl.setAttribute('role', 'button');
    this.buttonEl.setAttribute('aria-haspopup', 'listbox');
    this.buttonEl.setAttribute('aria-expanded', 'false');
    this.buttonEl.addEventListener('click', (event) => {
      event.stopPropagation();
      this.setOpen(!this.container.classList.contains('open'));
    });
    this.updateDisplay();

    this.dropdownEl = this.container.createDiv({ cls: 'grimoire-model-dropdown' });
    this.dropdownEl.setAttribute('role', 'listbox');
    this.renderOptions();
  }

  private setOpen(open: boolean): void {
    this.container.classList.toggle('open', open);
    this.buttonEl?.setAttribute('aria-expanded', String(open));
    if (open) {
      this.removeOutsideListeners();
      this.outsideClickHandler = (e: MouseEvent) => {
        if (!this.container.contains(e.target as Node)) {
          this.setOpen(false);
        }
      };
      this.escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.setOpen(false);
        }
      };
      this.container.ownerDocument.addEventListener('click', this.outsideClickHandler);
      this.container.ownerDocument.addEventListener('keydown', this.escapeHandler);
      this.searchInputEl?.focus();
      this.refreshProviderUsageInBackground();
      this.refreshModelOptionsInBackground();
    } else {
      this.removeOutsideListeners();
    }
  }

  private refreshModelOptionsInBackground(): void {
    if (!this.callbacks.refreshModelOptions || this.modelCatalogRefreshPromise) {
      return;
    }

    this.isRefreshingModelCatalog = true;
    this.modelCatalogRefreshFailed = false;
    this.renderOptions();
    this.searchInputEl?.focus();

    const refreshPromise = this.callbacks.refreshModelOptions();
    this.modelCatalogRefreshPromise = refreshPromise;
    void refreshPromise
      .catch(() => {
        this.modelCatalogRefreshFailed = true;
      })
      .finally(() => {
        if (this.modelCatalogRefreshPromise !== refreshPromise) {
          return;
        }
        this.modelCatalogRefreshPromise = null;
        this.isRefreshingModelCatalog = false;
        this.updateDisplay();
        this.renderOptions();
        if (this.container.hasClass('open')) {
          this.searchInputEl?.focus();
        }
      });
  }

  updateDisplay() {
    if (!this.buttonEl) return;
    const currentModel = this.getCurrentModel();
    const models = this.getAvailableModels();
    const modelInfo = models.find(m => m.value === currentModel);

    this.buttonEl.empty();

    const icon = modelInfo?.providerIcon ?? this.callbacks.getUIConfig().getProviderIcon?.();
    if (icon) {
      this.buttonEl.appendChild(createProviderIconSvg(icon, {
        className: 'grimoire-model-button-provider-icon',
        height: 13,
        ownerDocument: this.buttonEl.ownerDocument,
        width: 13,
      }));
    }

    const labelEl = this.buttonEl.createSpan({ cls: 'grimoire-model-label' });
    labelEl.setText(modelInfo ? formatModelButtonLabel(modelInfo.label) : formatModelFallbackLabel(currentModel));
    const chevronEl = this.buttonEl.createSpan({ cls: 'grimoire-model-chevron' });
    setIcon(chevronEl, 'chevron-up');
  }

  renderOptions() {
    if (!this.dropdownEl) return;
    this.dropdownEl.empty();

    const currentModel = this.getCurrentModel();

    if (this.pendingModel) {
      this.dropdownEl.addClass('grimoire-model-dropdown--loading');
      const loadingEl = this.dropdownEl.createDiv({ cls: 'grimoire-model-loading' });
      loadingEl.setText('Switching model\u2026');
      return;
    }

    this.dropdownEl.removeClass('grimoire-model-dropdown--loading');
    const models = this.getAvailableModels();
    this.renderSearchInput();
    this.renderCatalogRefreshStatus();
    this.renderCatalogRefreshError();

    if (models.length === 0) {
      const emptyEl = this.dropdownEl.createDiv({ cls: 'grimoire-model-empty' });
      emptyEl.setText('No models available');
      return;
    }

    const filteredModels = this.filterModels(models);
    if (filteredModels.length === 0) {
      const emptyEl = this.dropdownEl.createDiv({ cls: 'grimoire-model-empty' });
      emptyEl.setText(`No models match "${this.searchQuery}"`);
      return;
    }

    const hasGroups = filteredModels.some(model => Boolean(model.group));

    if (!hasGroups) {
      for (const [index, model] of filteredModels.entries()) {
        this.renderOption(this.dropdownEl, model, index, currentModel);
      }
      return;
    }

    const groups: Array<{ name: string; models: ProviderUIOption[] }> = [];
    const groupsByName = new Map<string, ProviderUIOption[]>();
    for (const model of filteredModels) {
      const group = model.group || 'Models';
      let groupModels = groupsByName.get(group);
      if (!groupModels) {
        groupModels = [];
        groupsByName.set(group, groupModels);
        groups.push({ name: group, models: groupModels });
      }
      groupModels.push(model);
    }
    groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    let optionIndex = 0;
    for (const group of groups) {
      const normalizedGroupName = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const groupKey = normalizedGroupName || group.name;
      const isOpen = this.modelGroupOpenState.get(groupKey) ?? true;
      const groupEl = this.dropdownEl.createDiv({
        cls: `grimoire-model-group-section${isOpen ? ' is-open' : ''}`,
      });
      if (normalizedGroupName) {
        groupEl.addClass(`grimoire-model-group-section--${normalizedGroupName}`);
      }
      const headerEl = groupEl.createEl('button', {
        cls: 'grimoire-model-group',
        attr: {
          type: 'button',
          'aria-expanded': String(isOpen),
        },
      });

      const firstIcon = group.models[0]?.providerIcon ?? this.callbacks.getUIConfig().getProviderIcon?.();
      if (firstIcon) {
        headerEl.appendChild(createProviderIconSvg(firstIcon, {
          className: 'grimoire-model-group-provider-icon',
          height: 7,
          ownerDocument: headerEl.ownerDocument,
          width: 7,
        }));
      } else {
        headerEl.createSpan({ cls: 'grimoire-model-group-provider-icon' });
      }
      headerEl.createSpan({ cls: 'grimoire-model-group-label', text: group.name });
      headerEl.createSpan({ cls: 'grimoire-model-group-count', text: String(group.models.length) });
      headerEl.createSpan({ cls: 'grimoire-model-group-chevron' });

      const groupBodyEl = groupEl.createDiv({ cls: 'grimoire-model-group-options' });
      const providerId = this.resolveGroupProviderId(group.models);
      if (providerId) {
        this.renderPlanUsageReadout(groupBodyEl, this.callbacks.getProviderUsage?.(providerId) ?? null);
      }
      headerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !groupEl.hasClass('is-open');
        groupEl.toggleClass('is-open', open);
        this.modelGroupOpenState.set(groupKey, open);
        headerEl.setAttribute('aria-expanded', String(open));
      });

      for (const model of group.models) {
        this.renderOption(groupBodyEl, model, optionIndex, currentModel);
        optionIndex += 1;
      }
    }
  }

  refreshProviderUsageInBackground(): void {
    if (!this.callbacks.refreshProviderUsage) {
      return;
    }

    const providerIds = new Set<ProviderId>();
    for (const model of this.getAvailableModels()) {
      const providerId = this.resolveProviderIdForModel(model);
      if (providerId) {
        providerIds.add(providerId);
      }
    }

    for (const providerId of providerIds) {
      this.refreshProviderUsageForProvider(providerId);
    }
  }

  private refreshProviderUsageForProvider(providerId: ProviderId): void {
    if (!this.callbacks.refreshProviderUsage || this.providerUsageRefreshPromises.has(providerId)) {
      return;
    }

    const refreshPromise = this.callbacks.refreshProviderUsage(providerId);
    this.providerUsageRefreshPromises.set(providerId, refreshPromise);
    void refreshPromise
      .catch(() => null)
      .finally(() => {
        if (this.providerUsageRefreshPromises.get(providerId) !== refreshPromise) {
          return;
        }
        this.providerUsageRefreshPromises.delete(providerId);
        this.callbacks.onProviderUsageRefresh?.(providerId);
        if (this.container.hasClass('open')) {
          this.renderOptions();
          this.searchInputEl?.focus();
        }
      });
  }

  private resolveGroupProviderId(models: ProviderUIOption[]): ProviderId | null {
    const providerIds = new Set<ProviderId>();
    for (const model of models) {
      const providerId = this.resolveProviderIdForModel(model);
      if (providerId) {
        providerIds.add(providerId);
      }
    }
    return providerIds.size === 1 ? [...providerIds][0] : null;
  }

  private resolveProviderIdForModel(model: ProviderUIOption): ProviderId | null {
    if (model.providerId) {
      return model.providerId;
    }
    return this.callbacks.resolveProviderForModel?.(model.value) ?? null;
  }

  private renderPlanUsageReadout(parentEl: HTMLElement, usage: ProviderPlanUsage | null): void {
    if (!usage || !areUsageIndicatorsEnabled(this.callbacks.getSettings())) {
      return;
    }

    if (isQuotaUsage(usage) && usage.windows.some(window => isUsagePctKnown(normalizeUsageWindow(window)))) {
      this.renderQuotaPlanUsageReadout(parentEl, usage);
    }
    if (isSpendUsage(usage)) {
      this.renderSpendPlanUsageReadout(parentEl, usage);
    }
  }

  private renderSpendPlanUsageReadout(parentEl: HTMLElement, usage: ProviderPlanUsage & { spend: string }): void {
    const readoutEl = parentEl.createDiv({
      cls: 'grimoire-plan-usage-readout grimoire-plan-usage-readout--spend',
    });
    const headerEl = readoutEl.createDiv({ cls: 'grimoire-plan-usage-readout-header' });
    headerEl.createSpan({ cls: 'grimoire-plan-usage-readout-plan', text: usage.plan });
    headerEl.createSpan({ cls: 'grimoire-plan-usage-readout-spend', text: usage.spend });
    if (usage.note) {
      readoutEl.createDiv({ cls: 'grimoire-plan-usage-readout-note', text: usage.note });
    }
  }

  private renderQuotaPlanUsageReadout(parentEl: HTMLElement, usage: ProviderPlanUsage & { windows: ProviderPlanUsageWindow[] }): void {
    if (usage.windows.length === 0) {
      return;
    }

    const windows = usage.windows
      .map(normalizeUsageWindow)
      .filter(isUsagePctKnown);
    if (windows.length === 0) {
      return;
    }
    const hasWarning = windows.some(isUsageWindowHot);
    const readoutEl = parentEl.createDiv({
      cls: `grimoire-plan-usage-readout${hasWarning ? ' is-warning' : ''}`,
    });
    const headerEl = readoutEl.createDiv({ cls: 'grimoire-plan-usage-readout-header' });
    headerEl.createSpan({ cls: 'grimoire-plan-usage-readout-plan', text: usage.plan });
    headerEl.createSpan({ cls: 'grimoire-plan-usage-readout-caption', text: 'plan usage' });

    for (const window of windows) {
      const rowEl = readoutEl.createDiv({ cls: 'grimoire-plan-usage-readout-row' });
      rowEl.createSpan({
        cls: 'grimoire-plan-usage-readout-label',
        text: window.label.toUpperCase(),
      });
      const trackEl = rowEl.createSpan({ cls: 'grimoire-plan-usage-readout-track' });
      const fillEl = trackEl.createSpan({ cls: 'grimoire-plan-usage-readout-fill' });
      fillEl.style.width = `${window.pct}%`;
      const valueEl = rowEl.createSpan({
        cls: 'grimoire-plan-usage-readout-value',
        text: formatUsagePct(window),
      });
      rowEl.createSpan({ cls: 'grimoire-plan-usage-readout-reset', text: window.reset });
      const isHot = isUsageWindowHot(window);
      fillEl.toggleClass('is-hot', isHot);
      valueEl.toggleClass('is-hot', isHot);
    }
  }

  private renderSearchInput(): void {
    if (!this.dropdownEl) return;

    const searchEl = this.dropdownEl.createDiv({ cls: 'grimoire-model-search' });
    const iconEl = searchEl.createSpan({ cls: 'grimoire-model-search-icon' });
    setIcon(iconEl, 'search');
    this.searchInputEl = searchEl.createEl('input', {
      cls: 'grimoire-model-search-input',
      attr: {
        'aria-label': 'Search models',
        placeholder: 'Search models...',
        type: 'search',
      },
    });
    this.searchInputEl.value = this.searchQuery;
    this.searchInputEl.addEventListener('input', () => {
      this.searchQuery = this.searchInputEl?.value ?? '';
      this.renderOptions();
      this.searchInputEl?.focus();
    });
  }

  private renderCatalogRefreshStatus(): void {
    if (!this.dropdownEl || !this.isRefreshingModelCatalog) {
      return;
    }

    const loadingEl = this.dropdownEl.createDiv({
      cls: 'grimoire-model-catalog-loading grimoire-model-loading',
    });
    loadingEl.setText('Loading models\u2026');
  }

  private renderCatalogRefreshError(): void {
    if (!this.dropdownEl || !this.modelCatalogRefreshFailed) {
      return;
    }

    const errorEl = this.dropdownEl.createDiv({
      cls: 'grimoire-model-catalog-error grimoire-model-loading',
    });
    errorEl.setText('Couldn\u2019t load models');
  }

  private filterModels(models: ProviderUIOption[]): ProviderUIOption[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return models;
    }

    return models.filter((model) => {
      const haystack = [
        model.label,
        model.description,
        model.group,
        model.value,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  private renderOption(
    parentEl: HTMLElement,
    model: ProviderUIOption,
    index: number,
    currentModel: string,
  ): void {
    const option = parentEl.createDiv({ cls: 'grimoire-model-option' });
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(model.value === currentModel));
    option.setAttribute('aria-posinset', String(index + 1));
    if (model.value === currentModel) {
      option.addClass('selected');
    }

    const icon = model.providerIcon ?? this.callbacks.getUIConfig().getProviderIcon?.();
    if (icon) {
      option.appendChild(createProviderIconSvg(icon, {
        className: 'grimoire-model-provider-icon',
        height: 12,
        ownerDocument: option.ownerDocument,
        width: 12,
      }));
    }

    const copyEl = option.createSpan({ cls: 'grimoire-model-option-copy' });
    copyEl.createSpan({ cls: 'grimoire-model-option-label', text: model.label });
    if (model.description) {
      copyEl.createSpan({ cls: 'grimoire-model-option-detail', text: model.description });
      option.setAttribute('title', `${model.label}\n${model.description}`);
    } else {
      option.setAttribute('title', model.label);
    }

    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const previousPendingModel = this.pendingModel;
      this.pendingModel = model.value;
      this.updateDisplay();
      this.setOpen(false);
      void (async () => {
        try {
          await this.callbacks.onModelChange(model.value);
          this.pendingModel = null;
        } catch {
          this.pendingModel = previousPendingModel;
          new Notice('Failed to change model');
        }
        this.updateDisplay();
        this.renderOptions();
      })();
    });
  }
}

export class PlanUsageBadge {
  private container: HTMLElement;
  private labelEl: HTMLElement | null = null;
  private meterEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;
  private valueEl: HTMLElement | null = null;
  private tipEl: HTMLElement | null = null;
  private refreshPromise: Promise<ProviderPlanUsage | null> | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-plan-usage-badge grimoire-hidden' });
    this.container.setAttribute('role', 'button');
    this.container.setAttribute('tabindex', '0');
    this.render();
    this.updateDisplay();
  }

  private render(): void {
    this.container.empty();
    this.labelEl = this.container.createSpan({ cls: 'grimoire-plan-usage-badge-label' });
    this.meterEl = this.container.createSpan({ cls: 'grimoire-plan-usage-badge-meter' });
    this.fillEl = this.meterEl.createSpan({ cls: 'grimoire-plan-usage-badge-fill' });
    this.valueEl = this.container.createSpan({ cls: 'grimoire-plan-usage-badge-value' });
    this.tipEl = this.container.createDiv({ cls: 'grimoire-plan-usage-badge-tip' });
  }

  refreshInBackground(): void {
    const providerId = this.callbacks.getProviderId?.();
    if (!providerId || !this.callbacks.refreshProviderUsage || this.refreshPromise) {
      return;
    }

    const refreshPromise = this.callbacks.refreshProviderUsage(providerId);
    this.refreshPromise = refreshPromise;
    void refreshPromise
      .catch(() => null)
      .finally(() => {
        if (this.refreshPromise !== refreshPromise) {
          return;
        }
        this.refreshPromise = null;
        this.updateDisplay();
      });
  }

  updateDisplay(): void {
    const providerId = this.callbacks.getProviderId?.();
    const usage = providerId ? this.callbacks.getProviderUsage?.(providerId) ?? null : null;

    this.container.removeClass('is-hot');
    this.container.removeClass('grimoire-plan-usage-badge--spend');
    this.meterEl?.removeClass('grimoire-hidden');

    if (!usage || !areUsageIndicatorsEnabled(this.callbacks.getSettings())) {
      this.container.addClass('grimoire-hidden');
      return;
    }

    const primaryWindow = findPrimaryQuotaWindow(usage);
    if (primaryWindow) {
      this.renderQuotaUsage(usage, primaryWindow);
      return;
    }

    if (isSpendUsage(usage)) {
      this.renderSpendUsage(usage);
      return;
    }

    this.container.addClass('grimoire-hidden');
  }

  private renderQuotaUsage(usage: ProviderPlanUsage, window: ProviderPlanUsageWindow): void {
    this.container.removeClass('grimoire-hidden');
    this.container.toggleClass('is-hot', isUsageWindowHot(window));
    this.labelEl?.setText(formatQuotaBadgeLabel(window.label));
    if (this.fillEl) {
      this.fillEl.style.width = `${window.pct}%`;
    }
    this.valueEl?.setText(formatUsagePct(window));

    const weeklyWindow = findWeeklyWindow(usage);
    const secondaryParts = [
      ...(isUsagePctKnown(window) ? [`${window.pct}% used`] : []),
      `resets ${window.reset}`,
    ];
    if (weeklyWindow) {
      secondaryParts.push(isUsagePctKnown(weeklyWindow) ? `weekly ${weeklyWindow.pct}%` : 'weekly usage unavailable');
    }

    const limitDescription = formatQuotaLimitDescription(window);
    this.container.setAttribute('aria-label', formatQuotaAriaLabel(usage.plan, window));
    this.renderTip(
      `${usage.plan} · ${limitDescription}`,
      secondaryParts.join(' · '),
    );
  }

  private renderSpendUsage(usage: ProviderPlanUsage & { spend: string }): void {
    this.container.removeClass('grimoire-hidden');
    this.container.addClass('grimoire-plan-usage-badge--spend');
    this.labelEl?.setText('API');
    if (this.fillEl) {
      this.fillEl.setCssProps({ width: '0%' });
    }
    this.meterEl?.addClass('grimoire-hidden');
    this.valueEl?.setText(stripThisMonth(usage.spend));
    this.container.setAttribute('aria-label', `${usage.plan}: ${usage.spend}`);
    this.renderTip(`${usage.plan} · ${usage.spend}`, usage.note ?? '');
  }

  private renderTip(primary: string, secondary: string): void {
    if (!this.tipEl) {
      return;
    }
    this.tipEl.empty();
    this.tipEl.createDiv({
      cls: 'grimoire-plan-usage-badge-tip-primary',
      text: primary,
    });
    if (secondary) {
      this.tipEl.createDiv({
        cls: 'grimoire-plan-usage-badge-tip-secondary',
        text: secondary,
      });
    }
  }
}

export class ModeSelector {
  private container: HTMLElement;
  private labelEl: HTMLElement | null = null;
  private toggleEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-mode-selector' });
    this.render();
  }

  private getSelectorConfig(): ProviderModeSelectorConfig | null {
    return this.callbacks.getUIConfig().getModeSelector?.(this.callbacks.getSettings()) ?? null;
  }

  private render() {
    this.container.empty();

    this.labelEl = this.container.createSpan({ cls: 'grimoire-mode-label' });
    this.toggleEl = this.container.createDiv({ cls: 'grimoire-toggle-switch' });

    this.labelEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), 'Failed to change mode');
    });
    this.toggleEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), 'Failed to change mode');
    });

    this.updateDisplay();
  }

  /** Resolves the active/inactive option pair for a two-option toggle. */
  private resolveOptionPair(
    selectorConfig: ProviderModeSelectorConfig,
  ): { active: ProviderUIOption; inactive: ProviderUIOption } {
    const [first, second] = selectorConfig.options;
    const active = selectorConfig.activeValue
      ? selectorConfig.options.find((option) => option.value === selectorConfig.activeValue) ?? second
      : second;
    const inactive = active.value === first.value ? second : first;
    return { active, inactive };
  }

  updateDisplay() {
    if (!this.toggleEl || !this.labelEl) {
      return;
    }

    const selectorConfig = this.getSelectorConfig();
    if (!selectorConfig || selectorConfig.options.length !== 2) {
      this.container.addClass('grimoire-hidden');
      return;
    }

    this.container.removeClass('grimoire-hidden');
    const { active, inactive } = this.resolveOptionPair(selectorConfig);
    const currentOption = selectorConfig.options.find((option) => option.value === selectorConfig.value)
      ?? selectorConfig.options[0];
    const isActive = currentOption.value === active.value;

    this.labelEl.setText(currentOption.label || selectorConfig.label);
    this.labelEl.toggleClass('active', isActive);
    if (isActive) {
      this.toggleEl.addClass('active');
    } else {
      this.toggleEl.removeClass('active');
    }

    const titleParts = [`${inactive.label} <-> ${active.label}`];
    if (currentOption.description) {
      titleParts.push(currentOption.description);
    }
    this.container.setAttribute('title', titleParts.join('\n'));
  }

  renderOptions() {
    this.updateDisplay();
  }

  private async toggle() {
    const selectorConfig = this.getSelectorConfig();
    if (!selectorConfig || selectorConfig.options.length !== 2) {
      return;
    }

    const { active, inactive } = this.resolveOptionPair(selectorConfig);
    const nextValue = selectorConfig.value === active.value ? inactive.value : active.value;
    await this.callbacks.onModeChange(nextValue);
    this.updateDisplay();
  }
}

export class ThinkingBudgetSelector {
  private container: HTMLElement;
  private effortEl: HTMLElement | null = null;
  private effortGearsEl: HTMLElement | null = null;
  private budgetEl: HTMLElement | null = null;
  private budgetGearsEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-thinking-selector' });
    this.render();
  }

  private render() {
    this.container.empty();

    // Effort selector (for adaptive thinking models)
    this.effortEl = this.container.createDiv({ cls: 'grimoire-thinking-effort' });
    const effortLabel = this.effortEl.createSpan({ cls: 'grimoire-thinking-label-text' });
    effortLabel.setText('Effort:');
    this.effortGearsEl = this.effortEl.createDiv({ cls: 'grimoire-thinking-gears' });

    // Legacy budget selector (for custom models)
    this.budgetEl = this.container.createDiv({ cls: 'grimoire-thinking-budget' });
    const budgetLabel = this.budgetEl.createSpan({ cls: 'grimoire-thinking-label-text' });
    budgetLabel.setText('Thinking:');
    this.budgetGearsEl = this.budgetEl.createDiv({ cls: 'grimoire-thinking-gears' });

    this.updateDisplay();
  }

  private renderEffortGears() {
    if (!this.effortGearsEl) return;
    this.effortGearsEl.empty();

    const currentEffort = this.callbacks.getSettings().effortLevel;
    const uiConfig = this.callbacks.getUIConfig();
    const settings = this.callbacks.getSettings();
    const model = settings.model;
    const options = uiConfig.getReasoningOptions(model, settings);
    const currentInfo = options.find(e => e.value === currentEffort);

    const currentEl = this.effortGearsEl.createDiv({ cls: 'grimoire-thinking-current' });
    currentEl.setText(currentInfo?.label || options[0]?.label || 'High');
    this.bindThinkingCurrent(this.effortGearsEl, currentEl);

    const optionsEl = this.effortGearsEl.createDiv({ cls: 'grimoire-thinking-options' });
    optionsEl.setAttribute('role', 'listbox');

    for (const effort of [...options].reverse()) {
      const gearEl = optionsEl.createDiv({ cls: 'grimoire-thinking-gear' });
      gearEl.setText(effort.label);
      gearEl.setAttribute('role', 'option');
      gearEl.setAttribute('aria-selected', String(effort.value === currentEffort));

      if (effort.value === currentEffort) {
        gearEl.addClass('selected');
      }

      gearEl.addEventListener('click', (e) => {
        e.stopPropagation();
        runToolbarAction(async () => {
          await this.callbacks.onEffortLevelChange(effort.value);
          this.effortGearsEl?.removeClass('open');
          this.updateDisplay();
        }, 'Failed to change effort level');
      });
    }
  }

  private renderBudgetGears() {
    if (!this.budgetGearsEl) return;
    this.budgetGearsEl.empty();

    const currentBudget = this.callbacks.getSettings().thinkingBudget;
    const uiConfig = this.callbacks.getUIConfig();
    const settings = this.callbacks.getSettings();
    const model = settings.model;
    const options: ProviderReasoningOption[] = uiConfig.getReasoningOptions(model, settings);
    const currentBudgetInfo = options.find(b => b.value === currentBudget);

    const currentEl = this.budgetGearsEl.createDiv({ cls: 'grimoire-thinking-current' });
    currentEl.setText(currentBudgetInfo?.label || options[0]?.label || 'Off');
    this.bindThinkingCurrent(this.budgetGearsEl, currentEl);

    const optionsEl = this.budgetGearsEl.createDiv({ cls: 'grimoire-thinking-options' });
    optionsEl.setAttribute('role', 'listbox');

    for (const budget of [...options].reverse()) {
      const gearEl = optionsEl.createDiv({ cls: 'grimoire-thinking-gear' });
      gearEl.setText(budget.label);
      gearEl.setAttribute('role', 'option');
      gearEl.setAttribute('aria-selected', String(budget.value === currentBudget));
      const tokens = budget.tokens ?? 0;
      gearEl.setAttribute('title', tokens > 0 ? `${tokens.toLocaleString()} tokens` : 'Disabled');

      if (budget.value === currentBudget) {
        gearEl.addClass('selected');
      }

      gearEl.addEventListener('click', (e) => {
        e.stopPropagation();
        runToolbarAction(async () => {
          await this.callbacks.onThinkingBudgetChange(budget.value);
          this.budgetGearsEl?.removeClass('open');
          this.updateDisplay();
        }, 'Failed to change thinking budget');
      });
    }
  }

  private bindThinkingCurrent(gearsEl: HTMLElement, currentEl: HTMLElement): void {
    currentEl.setAttribute('role', 'button');
    currentEl.setAttribute('aria-haspopup', 'listbox');
    currentEl.setAttribute('aria-expanded', String(gearsEl.hasClass('open')));
    currentEl.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !gearsEl.hasClass('open');
      gearsEl.toggleClass('open', open);
      currentEl.setAttribute('aria-expanded', String(open));
    });
  }

  updateDisplay() {
    const capabilities = this.callbacks.getCapabilities();
    if (capabilities.reasoningControl === 'none') {
      this.effortEl?.addClass('grimoire-hidden');
      this.budgetEl?.addClass('grimoire-hidden');
      return;
    }

    const settings = this.callbacks.getSettings();
    const model = settings.model;
    const uiConfig = this.callbacks.getUIConfig();
    const options = uiConfig.getReasoningOptions(model, settings);
    const defaultValue = uiConfig.getDefaultReasoningValue(model, settings);
    const shouldHide = options.length === 0
      || (options.length === 1 && options[0]?.value === defaultValue);

    if (shouldHide) {
      this.effortEl?.addClass('grimoire-hidden');
      this.budgetEl?.addClass('grimoire-hidden');
      return;
    }

    const adaptive = uiConfig.isAdaptiveReasoningModel(model, settings);

    if (this.effortEl) {
      this.effortEl.toggleClass('grimoire-hidden', !adaptive);
    }
    if (this.budgetEl) {
      this.budgetEl.toggleClass('grimoire-hidden', adaptive);
    }

    if (adaptive) {
      this.renderEffortGears();
    } else {
      this.renderBudgetGears();
    }
  }
}

export class PermissionToggle {
  private container: HTMLElement;
  private toggleEl: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;
  private visible = true;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-permission-toggle' });
    this.render();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.updateDisplay();
  }

  private render() {
    this.container.empty();

    this.labelEl = this.container.createSpan({ cls: 'grimoire-permission-label' });
    this.toggleEl = this.container.createDiv({ cls: 'grimoire-toggle-switch' });

    this.updateDisplay();

    this.labelEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), 'Failed to change permission mode');
    });
    this.toggleEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), 'Failed to change permission mode');
    });
  }

  private getToggleConfig(): ProviderPermissionModeToggleConfig | null {
    const uiConfig = this.callbacks.getUIConfig();
    return uiConfig.getPermissionModeToggle?.() ?? null;
  }

  updateDisplay() {
    if (!this.toggleEl || !this.labelEl) return;

    const toggleConfig = this.getToggleConfig();
    const capabilities = this.callbacks.getCapabilities();
    if (!this.visible || !toggleConfig) {
      this.container.addClass('grimoire-hidden');
      return;
    }

    this.container.removeClass('grimoire-hidden');
    const mode = this.callbacks.getSettings().permissionMode;
    const planValue = toggleConfig.planValue;
    const planLabel = toggleConfig.planLabel ?? 'PLAN';
    const canShowPlan = Boolean(planValue) && capabilities.supportsPlanMode;

    if (canShowPlan && planValue && mode === planValue) {
      this.toggleEl.addClass('grimoire-hidden');
      this.labelEl.setText(planLabel);
      this.labelEl.addClass('plan-active');
      this.labelEl.setAttribute('role', 'button');
      this.labelEl.setAttribute('aria-pressed', 'true');
    } else {
      this.toggleEl.removeClass('grimoire-hidden');
      this.labelEl.removeClass('plan-active');
      if (mode === toggleConfig.activeValue) {
        this.toggleEl.addClass('active');
        this.labelEl.setText(toggleConfig.activeLabel);
      } else {
        this.toggleEl.removeClass('active');
        this.labelEl.setText(toggleConfig.inactiveLabel);
      }
      this.labelEl.setAttribute('role', 'button');
      this.labelEl.setAttribute('aria-pressed', String(mode !== toggleConfig.activeValue));
    }
  }

  private async toggle() {
    const toggleConfig = this.getToggleConfig();
    if (!toggleConfig) return;

    const current = this.callbacks.getSettings().permissionMode;
    const newMode = current === toggleConfig.activeValue
      ? toggleConfig.inactiveValue
      : toggleConfig.activeValue;
    await this.callbacks.onPermissionModeChange(newMode);
    this.updateDisplay();
  }
}

export class ServiceTierToggle {
  private container: HTMLElement;
  private buttonEl: HTMLElement | null = null;
  private iconEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-service-tier-toggle' });
    this.render();
  }

  private render() {
    this.container.empty();

    this.buttonEl = this.container.createDiv({ cls: 'grimoire-service-tier-button' });
    this.iconEl = this.buttonEl.createSpan({ cls: 'grimoire-service-tier-icon' });
    setIcon(this.iconEl, 'zap');

    this.updateDisplay();

    this.buttonEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), 'Failed to change service tier');
    });
  }

  private getToggleConfig(): ProviderServiceTierToggleConfig | null {
    const uiConfig = this.callbacks.getUIConfig();
    return uiConfig.getServiceTierToggle?.(this.callbacks.getSettings()) ?? null;
  }

  updateDisplay() {
    if (!this.buttonEl || !this.iconEl) return;

    const toggleConfig = this.getToggleConfig();
    if (!toggleConfig) {
      this.container.addClass('grimoire-hidden');
      return;
    }

    this.container.removeClass('grimoire-hidden');
    const current = this.callbacks.getSettings().serviceTier;
    const isActive = current === toggleConfig.activeValue;
    if (isActive) {
      this.buttonEl.addClass('active');
    } else {
      this.buttonEl.removeClass('active');
    }

    this.container.setAttribute('title', 'Toggle on/off fast mode');
  }

  private async toggle() {
    const toggleConfig = this.getToggleConfig();
    if (!toggleConfig) return;

    const current = this.callbacks.getSettings().serviceTier;
    const next = current === toggleConfig.activeValue
      ? toggleConfig.inactiveValue
      : toggleConfig.activeValue;
    await this.callbacks.onServiceTierChange(next);
    this.updateDisplay();
  }
}

export type AddExternalContextResult =
  | { success: true; normalizedPath: string }
  | { success: false; error: string };

export class ExternalContextSelector {
  private container: HTMLElement;
  private iconEl: HTMLElement | null = null;
  private badgeEl: HTMLElement | null = null;
  private dropdownEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;
  /**
   * Current external context paths. May contain:
   * - Persistent paths only (new sessions via clearExternalContexts)
   * - Restored session paths (loaded sessions via setExternalContexts)
   * - Mixed paths during active sessions
   */
  private externalContextPaths: string[] = [];
  /** Paths that persist across all sessions (stored in settings). */
  private persistentPaths: Set<string> = new Set();
  private onChangeCallback: ((paths: string[]) => void) | null = null;
  private onPersistenceChangeCallback: ((paths: string[]) => void) | null = null;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-external-context-selector' });
    this.render();
  }

  setOnChange(callback: (paths: string[]) => void): void {
    this.onChangeCallback = callback;
  }

  setOnPersistenceChange(callback: (paths: string[]) => void): void {
    this.onPersistenceChangeCallback = callback;
  }

  getExternalContexts(): string[] {
    return [...this.externalContextPaths];
  }

  getPersistentPaths(): string[] {
    return [...this.persistentPaths];
  }

  setPersistentPaths(paths: string[]): void {
    // Validate paths - remove non-existent directories
    const validPaths = filterValidPaths(paths);
    const invalidPaths = paths.filter(p => !validPaths.includes(p));

    this.persistentPaths = new Set(validPaths);
    // Merge persistent paths into external context paths
    this.mergePersistentPaths();
    this.updateDisplay();
    this.renderDropdown();

    // If invalid paths were removed, notify user and save updated list
    if (invalidPaths.length > 0) {
      const pathNames = invalidPaths.map(p => this.shortenPath(p)).join(', ');
      new Notice(`Removed ${invalidPaths.length} invalid external context path(s): ${pathNames}`, 5000);
      this.onPersistenceChangeCallback?.([...this.persistentPaths]);
    }
  }

  togglePersistence(path: string): void {
    if (this.persistentPaths.has(path)) {
      this.persistentPaths.delete(path);
    } else {
      // Validate path still exists before persisting
      if (!isValidDirectoryPath(path)) {
        new Notice(`Cannot persist "${this.shortenPath(path)}" - directory no longer exists`, 4000);
        return;
      }
      this.persistentPaths.add(path);
    }
    this.onPersistenceChangeCallback?.([...this.persistentPaths]);
    this.renderDropdown();
  }

  private mergePersistentPaths(): void {
    const pathSet = new Set(this.externalContextPaths);
    for (const path of this.persistentPaths) {
      pathSet.add(path);
    }
    this.externalContextPaths = [...pathSet];
  }

  /**
   * Restore exact external context paths from a saved conversation.
   * Does NOT merge with persistent paths - preserves the session's historical state.
   * Use clearExternalContexts() for new sessions to start with current persistent paths.
   */
  setExternalContexts(paths: string[]): void {
    this.externalContextPaths = [...paths];
    this.updateDisplay();
    this.renderDropdown();
  }

  /**
   * Remove a path from external contexts (and persistent paths if applicable).
   * Exposed for testing the remove button behavior.
   */
  removePath(pathStr: string): void {
    this.externalContextPaths = this.externalContextPaths.filter(p => p !== pathStr);
    // Also remove from persistent paths if it was persistent
    if (this.persistentPaths.has(pathStr)) {
      this.persistentPaths.delete(pathStr);
      this.onPersistenceChangeCallback?.([...this.persistentPaths]);
    }
    this.onChangeCallback?.(this.externalContextPaths);
    this.updateDisplay();
    this.renderDropdown();
  }

  /**
   * Add an external context path programmatically (e.g., from /add-dir command).
   * Validates the path and handles duplicates/conflicts.
   * @param pathInput - Path string (supports ~/ expansion)
   * @returns Result with success status and normalized path, or error message on failure
   */
  addExternalContext(pathInput: string): AddExternalContextResult {
    const trimmed = pathInput?.trim();
    if (!trimmed) {
      return { success: false, error: 'No path provided. Usage: /add-dir /absolute/path' };
    }

    // Strip surrounding quotes if present (e.g., "/path/with spaces")
    let cleanPath = trimmed;
    if ((cleanPath.startsWith('"') && cleanPath.endsWith('"')) ||
        (cleanPath.startsWith("'") && cleanPath.endsWith("'"))) {
      cleanPath = cleanPath.slice(1, -1);
    }

    // Expand home directory and normalize path
    const expandedPath = expandHomePath(cleanPath);
    const normalizedPath = normalizePathForFilesystem(expandedPath);

    if (!path.isAbsolute(normalizedPath)) {
      return { success: false, error: 'Path must be absolute. Usage: /add-dir /absolute/path' };
    }

    // Validate path exists and is a directory with specific error messages
    const validation = validateDirectoryPath(normalizedPath);
    if (!validation.valid) {
      return { success: false, error: `${validation.error}: ${pathInput}` };
    }

    // Check for duplicate (normalized comparison for cross-platform support)
    if (isDuplicatePath(normalizedPath, this.externalContextPaths)) {
      return { success: false, error: 'This folder is already added as an external context.' };
    }

    // Check for nested/overlapping paths
    const conflict = findConflictingPath(normalizedPath, this.externalContextPaths);
    if (conflict) {
      return { success: false, error: this.formatConflictMessage(normalizedPath, conflict) };
    }

    // Add the path
    this.externalContextPaths = [...this.externalContextPaths, normalizedPath];
    this.onChangeCallback?.(this.externalContextPaths);
    this.updateDisplay();
    this.renderDropdown();

    return { success: true, normalizedPath };
  }

  /**
   * Clear session-only external context paths (call on new conversation).
   * Uses persistent paths from settings if provided, otherwise falls back to local cache.
   * Validates paths before using them (silently filters invalid during session init).
   */
  clearExternalContexts(persistentPathsFromSettings?: string[]): void {
    // Use settings value if provided (most up-to-date), otherwise use local cache
    if (persistentPathsFromSettings) {
      // Validate paths - silently filter during session initialization (not user action)
      const validPaths = filterValidPaths(persistentPathsFromSettings);
      this.persistentPaths = new Set(validPaths);
    }
    this.externalContextPaths = [...this.persistentPaths];
    this.updateDisplay();
    this.renderDropdown();
  }

  private render() {
    this.container.empty();

    const iconWrapper = this.container.createDiv({ cls: 'grimoire-external-context-icon-wrapper' });

    this.iconEl = iconWrapper.createDiv({ cls: 'grimoire-external-context-icon' });
    setIcon(this.iconEl, 'folder');

    this.badgeEl = iconWrapper.createDiv({ cls: 'grimoire-external-context-badge' });

    this.updateDisplay();

    // Click to open native folder picker
    iconWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.openFolderPicker();
    });
    this.container.addEventListener('mouseenter', () => {
      this.positionDropdown();
    });
    this.container.addEventListener('focusin', () => {
      this.positionDropdown();
    });

    this.dropdownEl = this.container.createDiv({ cls: 'grimoire-external-context-dropdown' });
    this.renderDropdown();
  }

  private positionDropdown(): void {
    if (!this.dropdownEl) return;

    const selectorRect = this.container.getBoundingClientRect();
    const ownerView = this.container.ownerDocument.defaultView;
    const viewportWidth = ownerView?.innerWidth ?? window.innerWidth;
    const viewportHeight = ownerView?.innerHeight ?? window.innerHeight;
    const composerEl = this.container.closest('.grimoire-composer-shell');
    const composerRect = typeof composerEl?.getBoundingClientRect === 'function'
      ? composerEl.getBoundingClientRect()
      : null;
    const gutter = 10;
    const boundaryLeft = composerRect?.left ?? gutter;
    const boundaryRight = composerRect?.right ?? viewportWidth - gutter;
    const boundaryWidth = Math.max(0, boundaryRight - boundaryLeft);
    const width = Math.min(320, Math.max(220, boundaryWidth - gutter * 2));
    const minLeft = boundaryLeft + gutter;
    const maxLeft = Math.max(minLeft, boundaryRight - width - gutter);
    const preferredLeft = selectorRect.left + selectorRect.width / 2 - width / 2;
    const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft);
    const bottom = Math.max(gutter, viewportHeight - selectorRect.top + 8);
    const maxHeight = Math.min(260, Math.max(96, selectorRect.top - gutter * 2));

    this.dropdownEl.setCssProps({
      '--grimoire-external-context-dropdown-bottom': `${Math.round(bottom)}px`,
      '--grimoire-external-context-dropdown-left': `${Math.round(left)}px`,
      '--grimoire-external-context-dropdown-max-height': `${Math.round(maxHeight)}px`,
      '--grimoire-external-context-dropdown-width': `${Math.round(width)}px`,
    });
  }

  private async openFolderPicker() {
    try {
      // Access Electron's dialog through remote
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Electron remote is exposed only at runtime in Obsidian's renderer.
      const { remote } = require('electron') as { remote?: ElectronRemoteApi };
      if (!remote) {
        throw new Error('Electron remote API is unavailable');
      }
      const result = await remote.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select External Context',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];

        // Check for duplicate (normalized comparison for cross-platform support)
        if (isDuplicatePath(selectedPath, this.externalContextPaths)) {
          new Notice('This folder is already added as an external context.', 3000);
          return;
        }

        // Check for nested/overlapping paths
        const conflict = findConflictingPath(selectedPath, this.externalContextPaths);
        if (conflict) {
          new Notice(this.formatConflictMessage(selectedPath, conflict), 5000);
          return;
        }

        this.externalContextPaths = [...this.externalContextPaths, selectedPath];
        this.onChangeCallback?.(this.externalContextPaths);
        this.updateDisplay();
        this.renderDropdown();
      }
    } catch {
      new Notice('Unable to open folder picker.', 5000);
    }
  }

  /** Formats a conflict error message for display. */
  private formatConflictMessage(newPath: string, conflict: { path: string; type: 'parent' | 'child' }): string {
    const shortNew = this.shortenPath(newPath);
    const shortExisting = this.shortenPath(conflict.path);
    return conflict.type === 'parent'
      ? `Cannot add "${shortNew}" - it's inside existing path "${shortExisting}"`
      : `Cannot add "${shortNew}" - it contains existing path "${shortExisting}"`;
  }

  private renderDropdown() {
    if (!this.dropdownEl) return;

    this.dropdownEl.empty();

    // Header
    const headerEl = this.dropdownEl.createDiv({ cls: 'grimoire-external-context-header' });
    headerEl.setText('External contexts');

    // Path list
    const listEl = this.dropdownEl.createDiv({ cls: 'grimoire-external-context-list' });

    if (this.externalContextPaths.length === 0) {
      const emptyEl = listEl.createDiv({ cls: 'grimoire-external-context-empty' });
      emptyEl.setText('Click folder icon to add');
    } else {
      for (const pathStr of this.externalContextPaths) {
        const itemEl = listEl.createDiv({ cls: 'grimoire-external-context-item' });

        const pathTextEl = itemEl.createSpan({ cls: 'grimoire-external-context-text' });
        // Show shortened path for display
        const displayPath = this.shortenPath(pathStr);
        pathTextEl.setText(displayPath);
        pathTextEl.setAttribute('title', pathStr);

        // Lock toggle button
        const isPersistent = this.persistentPaths.has(pathStr);
        const lockBtn = itemEl.createSpan({ cls: 'grimoire-external-context-lock' });
        if (isPersistent) {
          lockBtn.addClass('locked');
        }
        setIcon(lockBtn, isPersistent ? 'lock' : 'unlock');
        lockBtn.setAttribute('title', isPersistent ? 'Persistent (click to make session-only)' : 'Session-only (click to persist)');
        lockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePersistence(pathStr);
        });

        const removeBtn = itemEl.createSpan({ cls: 'grimoire-external-context-remove' });
        setIcon(removeBtn, 'x');
        removeBtn.setAttribute('title', 'Remove path');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removePath(pathStr);
        });
      }
    }
  }

  /** Shorten path for display (replace home dir with ~) */
  private shortenPath(fullPath: string): string {
    try {
      const homeDir = os.homedir();
      const normalize = (value: string) => value.replace(/\\/g, '/');
      const normalizedFull = normalize(fullPath);
      const normalizedHome = normalize(homeDir);
      const compareFull = process.platform === 'win32'
        ? normalizedFull.toLowerCase()
        : normalizedFull;
      const compareHome = process.platform === 'win32'
        ? normalizedHome.toLowerCase()
        : normalizedHome;
      if (compareFull.startsWith(compareHome)) {
        // Use normalized path length and normalize the result for consistent display
        const remainder = normalizedFull.slice(normalizedHome.length);
        return '~' + remainder;
      }
    } catch {
      // Fall through to return full path
    }
    return fullPath;
  }

  updateDisplay() {
    if (!this.iconEl || !this.badgeEl) return;

    const count = this.externalContextPaths.length;

    if (count > 0) {
      this.iconEl.addClass('active');
      this.iconEl.setAttribute('title', `${count} external context${count > 1 ? 's' : ''} (click to add more)`);

      // Show badge only when more than 1 path
      if (count > 1) {
        this.badgeEl.setText(String(count));
        this.badgeEl.addClass('visible');
      } else {
        this.badgeEl.removeClass('visible');
      }
    } else {
      this.iconEl.removeClass('active');
      this.iconEl.setAttribute('title', 'Add external contexts (click)');
      this.badgeEl.removeClass('visible');
    }
  }
}

export class McpServerSelector {
  private container: HTMLElement;
  private iconEl: HTMLElement | null = null;
  private badgeEl: HTMLElement | null = null;
  private dropdownEl: HTMLElement | null = null;
  private mcpManager: McpServerManager | null = null;
  private enabledServers: Set<string> = new Set();
  private onChangeCallback: ((enabled: Set<string>) => void) | null = null;
  private visible = true;

  constructor(parentEl: HTMLElement) {
    this.container = parentEl.createDiv({ cls: 'grimoire-mcp-selector' });
    this.render();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.container.addClass('grimoire-hidden');
    } else {
      this.updateDisplay();
    }
  }

  setMcpManager(manager: McpServerManager | null): void {
    this.mcpManager = manager;
    if (!manager && this.enabledServers.size > 0) {
      this.enabledServers.clear();
      this.onChangeCallback?.(this.enabledServers);
    }
    this.pruneEnabledServers();
    this.updateDisplay();
    this.renderDropdown();
  }

  setOnChange(callback: (enabled: Set<string>) => void): void {
    this.onChangeCallback = callback;
  }

  getEnabledServers(): Set<string> {
    return new Set(this.enabledServers);
  }

  addMentionedServers(names: Set<string>): void {
    let changed = false;
    for (const name of names) {
      if (!this.enabledServers.has(name)) {
        this.enabledServers.add(name);
        changed = true;
      }
    }
    if (changed) {
      this.updateDisplay();
      this.renderDropdown();
    }
  }

  clearEnabled(): void {
    this.enabledServers.clear();
    this.updateDisplay();
    this.renderDropdown();
  }

  setEnabledServers(names: string[]): void {
    this.enabledServers = new Set(names);
    this.pruneEnabledServers();
    this.updateDisplay();
    this.renderDropdown();
  }

  private pruneEnabledServers(): void {
    if (!this.mcpManager) return;
    const activeNames = new Set(this.mcpManager.getServers().filter((s) => s.enabled).map((s) => s.name));
    let changed = false;
    for (const name of this.enabledServers) {
      if (!activeNames.has(name)) {
        this.enabledServers.delete(name);
        changed = true;
      }
    }
    if (changed) {
      this.onChangeCallback?.(this.enabledServers);
    }
  }

  private render() {
    this.container.empty();

    const iconWrapper = this.container.createDiv({ cls: 'grimoire-mcp-selector-icon-wrapper' });

    this.iconEl = iconWrapper.createDiv({ cls: 'grimoire-mcp-selector-icon' });
    appendMcpIcon(this.iconEl);

    this.badgeEl = iconWrapper.createDiv({ cls: 'grimoire-mcp-selector-badge' });

    this.updateDisplay();

    this.dropdownEl = this.container.createDiv({ cls: 'grimoire-mcp-selector-dropdown' });
    this.renderDropdown();

    // Re-render dropdown content on hover (CSS handles visibility)
    this.container.addEventListener('mouseenter', () => {
      this.renderDropdown();
    });
  }

  private renderDropdown() {
    if (!this.dropdownEl) return;
    this.pruneEnabledServers();
    this.dropdownEl.empty();

    // Header
    const headerEl = this.dropdownEl.createDiv({ cls: 'grimoire-mcp-selector-header' });
    headerEl.setText('Mcp servers');

    // Server list
    const listEl = this.dropdownEl.createDiv({ cls: 'grimoire-mcp-selector-list' });

    const allServers = this.mcpManager?.getServers() || [];
    const servers = allServers.filter(s => s.enabled);

    if (servers.length === 0) {
      const emptyEl = listEl.createDiv({ cls: 'grimoire-mcp-selector-empty' });
      emptyEl.setText(allServers.length === 0 ? 'No MCP servers configured' : 'All MCP servers disabled');
      return;
    }

    for (const server of servers) {
      this.renderServerItem(listEl, server);
    }
  }

  private renderServerItem(listEl: HTMLElement, server: ManagedMcpServer) {
    const itemEl = listEl.createDiv({ cls: 'grimoire-mcp-selector-item' });
    itemEl.dataset.serverName = server.name;

    const isEnabled = this.enabledServers.has(server.name);
    if (isEnabled) {
      itemEl.addClass('enabled');
    }

    // Checkbox
    const checkEl = itemEl.createDiv({ cls: 'grimoire-mcp-selector-check' });
    if (isEnabled) {
      appendCheckIcon(checkEl);
    }

    // Info
    const infoEl = itemEl.createDiv({ cls: 'grimoire-mcp-selector-item-info' });

    const nameEl = infoEl.createSpan({ cls: 'grimoire-mcp-selector-item-name' });
    nameEl.setText(server.name);

    // Badges
    if (server.contextSaving) {
      const csEl = infoEl.createSpan({ cls: 'grimoire-mcp-selector-cs-badge' });
      csEl.setText('@');
      csEl.setAttribute('title', 'Context-saving: can also enable via @' + server.name);
    }

    // Click to toggle (use mousedown for more reliable capture)
    itemEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleServer(server.name, itemEl);
    });
  }

  private toggleServer(name: string, itemEl: HTMLElement) {
    if (this.enabledServers.has(name)) {
      this.enabledServers.delete(name);
    } else {
      this.enabledServers.add(name);
    }

    // Update item visually in-place (immediate feedback)
    const isEnabled = this.enabledServers.has(name);
    const checkEl = itemEl.querySelector<HTMLElement>('.grimoire-mcp-selector-check');

    if (isEnabled) {
      itemEl.addClass('enabled');
      if (checkEl) appendCheckIcon(checkEl);
    } else {
      itemEl.removeClass('enabled');
      if (checkEl) checkEl.empty();
    }

    this.updateDisplay();
    this.onChangeCallback?.(this.enabledServers);
  }

  updateDisplay() {
    this.pruneEnabledServers();
    if (!this.iconEl || !this.badgeEl) return;

    const count = this.enabledServers.size;
    const hasServers = (this.mcpManager?.getServers().length || 0) > 0;

    // Show/hide container based on whether there are servers and visibility
    if (!hasServers || !this.visible) {
      this.container.addClass('grimoire-hidden');
      return;
    }
    this.container.removeClass('grimoire-hidden');

    if (count > 0) {
      this.iconEl.addClass('active');
      this.iconEl.setAttribute('title', `${count} MCP server${count > 1 ? 's' : ''} enabled (click to manage)`);

      // Show badge only when more than 1
      if (count > 1) {
        this.badgeEl.setText(String(count));
        this.badgeEl.addClass('visible');
      } else {
        this.badgeEl.removeClass('visible');
      }
    } else {
      this.iconEl.removeClass('active');
      this.iconEl.setAttribute('title', 'Mcp servers (click to enable)');
      this.badgeEl.removeClass('visible');
    }
  }
}

interface ContextUsageMeterOptions {
  showWhenEmpty?: boolean;
}

export class ContextUsageMeter {
  private container: HTMLElement;
  private percentEl: HTMLElement | null = null;
  private tipEl: HTMLElement | null = null;
  private readonly showWhenEmpty: boolean;

  constructor(parentEl: HTMLElement, options: ContextUsageMeterOptions = {}) {
    this.showWhenEmpty = options.showWhenEmpty === true;
    this.container = parentEl.createDiv({ cls: 'grimoire-context-meter' });
    this.container.setAttribute('role', 'button');
    this.container.setAttribute('tabindex', '0');
    this.render();
    if (this.showWhenEmpty) {
      this.renderEmptyState();
    } else {
      // Initially hidden
      this.container.addClass('grimoire-hidden');
    }
  }

  setVisible(visible: boolean): void {
    this.container.toggleClass('grimoire-hidden', !visible);
  }

  private render() {
    this.container.createDiv({ cls: 'grimoire-context-meter-ring' });
    this.percentEl = this.container.createSpan({ cls: 'grimoire-context-meter-percent' });
    this.tipEl = this.container.createDiv({ cls: 'grimoire-context-meter-tip' });
  }

  update(usage: UsageInfo | null): void {
    if (!usage || usage.contextTokens <= 0) {
      if (this.showWhenEmpty) {
        this.renderEmptyState(usage?.contextWindow);
      } else {
        this.container.addClass('grimoire-hidden');
      }
      return;
    }
    this.container.removeClass('grimoire-hidden');
    this.container.setCssProps({
      '--grimoire-context-meter-pct': `${Math.min(100, Math.max(0, usage.percentage))}`,
    });

    if (this.percentEl) {
      this.percentEl.setText(`${usage.percentage}%`);
    }

    // Toggle warning class for > 80%
    if (usage.percentage > 80) {
      this.container.addClass('warning');
    } else {
      this.container.removeClass('warning');
    }

    // Set tooltip with detailed usage
    let tooltip = `${this.formatTokens(usage.contextTokens)} / ${this.formatTokens(usage.contextWindow)}`;
    if (usage.percentage > 80) {
      tooltip += ' (Approaching limit, run `/compact` to continue)';
    }
    this.container.setAttribute('data-tooltip', tooltip);
    this.container.setAttribute('aria-label', `Context window ${usage.percentage}% used`);

    if (this.tipEl) {
      const tokensLeft = Math.max(0, usage.contextWindow - usage.contextTokens);
      this.tipEl.empty();
      this.tipEl.createDiv({
        cls: 'grimoire-context-meter-tip-primary',
        text: `${this.formatTokens(usage.contextTokens)} / ${this.formatTokens(usage.contextWindow)} tokens`,
      });
      this.tipEl.createDiv({
        cls: 'grimoire-context-meter-tip-secondary',
        text: `${this.formatTokens(tokensLeft)} left`,
      });
    }
  }

  private renderEmptyState(contextWindow?: number): void {
    this.container.removeClass('grimoire-hidden');
    this.container.removeClass('warning');
    this.container.setCssProps({ '--grimoire-context-meter-pct': '0' });
    this.percentEl?.setText('0%');
    const windowLabel = contextWindow ? this.formatTokens(contextWindow) : 'context';
    this.container.setAttribute('data-tooltip', contextWindow ? `0 / ${windowLabel}` : 'No context used yet');
    this.container.setAttribute('aria-label', 'Context window 0% used');
    if (this.tipEl) {
      this.tipEl.empty();
      this.tipEl.createDiv({
        cls: 'grimoire-context-meter-tip-primary',
        text: contextWindow ? `0 / ${windowLabel} tokens` : 'No context used yet',
      });
      this.tipEl.createDiv({
        cls: 'grimoire-context-meter-tip-secondary',
        text: contextWindow ? `${windowLabel} left` : 'Usage appears as the active tab builds context.',
      });
    }
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k`;
    }
    return String(tokens);
  }
}

export class OrchestratorToggle {
  private container: HTMLElement;
  private buttonEl: HTMLElement | null = null;
  private iconEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-orchestrator-toggle' });
    this.render();
  }

  private render(): void {
    this.container.empty();

    this.buttonEl = this.container.createDiv({ cls: 'grimoire-orchestrator-button' });
    this.iconEl = this.buttonEl.createSpan({ cls: 'grimoire-orchestrator-icon' });
    setIcon(this.iconEl, 'git-fork');

    this.updateDisplay();

    this.buttonEl.addEventListener('click', () => {
      runToolbarAction(() => this.toggle(), t('chat.orchestrator.toggleFailed'));
    });
  }

  updateDisplay(): void {
    if (!this.buttonEl) return;

    this.buttonEl.toggleClass('active', this.callbacks.getOrchestratorMode?.() ?? false);
    this.buttonEl.setAttribute('aria-pressed', String(this.callbacks.getOrchestratorMode?.() ?? false));
    this.container.setAttribute('title', t('chat.orchestrator.toggleTitle'));
    this.buttonEl.setAttribute('aria-label', t('chat.orchestrator.toggleAriaLabel'));
  }

  private async toggle(): Promise<void> {
    await this.callbacks.onOrchestratorModeChange?.();
    this.updateDisplay();
  }
}

export class ProjectWorkspaceSelector {
  private container: HTMLElement;
  private selectEl: HTMLSelectElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'grimoire-project-workspace-selector' });
    this.render();
  }

  private render(): void {
    this.container.empty();
    this.selectEl = this.container.createEl('select', {
      attr: { 'aria-label': t('settings.projectWorkspaces.name') },
    });
    this.selectEl.addEventListener('change', () => {
      const workspaceId = this.selectEl?.value ?? '';
      runToolbarAction(
        () => this.callbacks.onProjectWorkspaceChange?.(workspaceId) ?? Promise.resolve(),
        t('settings.projectWorkspaces.changeFailed'),
      );
    });
    this.updateDisplay();
  }

  updateDisplay(): void {
    const workspaces = this.callbacks.getProjectWorkspaces?.() ?? [];
    this.container.toggleClass('grimoire-hidden', workspaces.length === 0);
    if (!this.selectEl) {
      return;
    }

    this.selectEl.empty();
    this.selectEl.createEl('option', { text: t('settings.projectWorkspaces.none'), value: '' });
    for (const workspace of workspaces) {
      this.selectEl.createEl('option', {
        text: workspace.name || t('settings.projectWorkspaces.untitled'),
        value: workspace.id,
      });
    }

    const activeId = this.callbacks.getActiveProjectWorkspaceId?.() ?? '';
    this.selectEl.value = workspaces.some((workspace) => workspace.id === activeId) ? activeId : '';
    const selectedWorkspace = workspaces.find((workspace) => workspace.id === this.selectEl?.value);
    this.container.setAttribute('title', selectedWorkspace?.name || t('settings.projectWorkspaces.none'));
  }
}

export function createInputToolbar(
  parentEl: HTMLElement,
  callbacks: ToolbarCallbacks
): {
  modelSelector: ModelSelector;
  modeSelector: ModeSelector;
  thinkingBudgetSelector: ThinkingBudgetSelector;
  planUsageBadge: PlanUsageBadge;
  contextUsageMeter: ContextUsageMeter | null;
  externalContextSelector: ExternalContextSelector;
  mcpServerSelector: McpServerSelector;
  permissionToggle: PermissionToggle;
  serviceTierToggle: ServiceTierToggle;
  orchestratorToggle: OrchestratorToggle;
  projectWorkspaceSelector: ProjectWorkspaceSelector;
  relevantNotesContainerEl: HTMLElement;
} {
  const modelRowEl = parentEl.createDiv({ cls: 'grimoire-input-toolbar-row grimoire-input-toolbar-model-row' });
  const actionsRowEl = parentEl.createDiv({ cls: 'grimoire-input-toolbar-row grimoire-input-toolbar-actions-row' });
  const modelContextStackEl = modelRowEl.createDiv({ cls: 'grimoire-model-context-stack' });
  const modelSelector = new ModelSelector(modelContextStackEl, callbacks);
  const planUsageBadge = new PlanUsageBadge(modelContextStackEl, callbacks);
  const relevantNotesContainerEl = modelContextStackEl.createDiv({ cls: 'grimoire-relevant-notes-slot' });
  const thinkingBudgetSelector = new ThinkingBudgetSelector(actionsRowEl, callbacks);
  const serviceTierToggle = new ServiceTierToggle(actionsRowEl, callbacks);
  const contextUsageMeter = new ContextUsageMeter(actionsRowEl);
  const externalContextSelector = new ExternalContextSelector(actionsRowEl, callbacks);
  const mcpServerSelector = new McpServerSelector(actionsRowEl);
  const permissionToggle = new PermissionToggle(actionsRowEl, callbacks);
  const modeSelector = new ModeSelector(actionsRowEl, callbacks);
  const orchestratorToggle = new OrchestratorToggle(actionsRowEl, callbacks);
  const projectWorkspaceSelector = new ProjectWorkspaceSelector(actionsRowEl, callbacks);

  return {
    modelSelector,
    modeSelector,
    thinkingBudgetSelector,
    planUsageBadge,
    serviceTierToggle,
    contextUsageMeter,
    externalContextSelector,
    mcpServerSelector,
    permissionToggle,
    orchestratorToggle,
    projectWorkspaceSelector,
    relevantNotesContainerEl,
  };
}
