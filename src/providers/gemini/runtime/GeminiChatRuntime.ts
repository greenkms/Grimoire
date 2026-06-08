import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { applyOrchestratorModeInstructions } from '../../../core/prompt/mainAgent';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type {
  ApprovalCallback,
  AskUserQuestionCallback,
  AutoTurnCallback,
  ChatRewindMode,
  ChatRewindResult,
  ChatRuntimeEnsureReadyOptions,
  ChatRuntimeQueryOptions,
  ChatTurnMetadata,
  ChatTurnRequest,
  ExitPlanModeCallback,
  PreparedChatTurn,
  SessionUpdateResult,
  SubagentRuntimeState,
} from '../../../core/runtime/types';
import type {
  ChatMessage,
  Conversation,
  ImageAttachment,
  SlashCommand,
  StreamChunk,
  ToolCallInfo,
} from '../../../core/types';
import type GrimoirePlugin from '../../../main';
import { appendProjectWorkspaceContext, appendVaultSearchContext } from '../../../utils/context';
import { getVaultPath } from '../../../utils/path';
import {
  AcpClientConnection,
  type AcpContentBlock,
  AcpJsonRpcTransport,
  type AcpReadTextFileRequest,
  type AcpRequestPermissionRequest,
  type AcpRequestPermissionResponse,
  type AcpSessionNotification,
  AcpSessionUpdateNormalizer,
  AcpSubprocess,
  type AcpWriteTextFileRequest,
  buildAcpUsageInfo,
  extractAcpSessionModelState,
  extractAcpSessionModeState,
} from '../../acp';
import { geminiPlanUsageStore } from '../app/GeminiPlanUsageStore';
import { GEMINI_PROVIDER_CAPABILITIES } from '../capabilities';
import {
  type GeminiDiscoveredModel,
  type GeminiMode,
  getGeminiProviderSettings,
  updateGeminiProviderSettings,
} from '../settings';
import { buildGeminiRuntimeEnv } from './GeminiRuntimeEnvironment';

interface ActiveTurn {
  queue: StreamChunkQueue;
  sessionId: string;
}

interface GeminiLaunchSpec {
  args: string[];
  command: string;
  cwd: string;
  runtimeEnv: NodeJS.ProcessEnv;
}

class StreamChunkQueue {
  private closed = false;
  private readonly items: StreamChunk[] = [];
  private readonly waiters: Array<(chunk: StreamChunk | null) => void> = [];

  push(chunk: StreamChunk): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(chunk);
      return;
    }
    this.items.push(chunk);
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.(null);
    }
  }

  async next(): Promise<StreamChunk | null> {
    if (this.items.length > 0) {
      return this.items.shift() ?? null;
    }

    if (this.closed) {
      return null;
    }

    return new Promise<StreamChunk | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export class GeminiChatRuntime implements ChatRuntime {
  readonly providerId = 'gemini' as const;

  private activeTurn: ActiveTurn | null = null;
  private approvalCallback: ApprovalCallback | null = null;
  private connection: AcpClientConnection | null = null;
  private contextUsage: Parameters<typeof buildAcpUsageInfo>[0]['contextWindow'] = null;
  private currentLaunchKey: string | null = null;
  private currentTurnMetadata: ChatTurnMetadata = {};
  private loadedSessionId: string | null = null;
  private process: AcpSubprocess | null = null;
  private promptUsage: Parameters<typeof buildAcpUsageInfo>[0]['promptUsage'] = null;
  private readonly readyListeners: Array<(ready: boolean) => void> = [];
  private ready = false;
  private sessionId: string | null = null;
  private sessionInvalidated = false;
  private readonly sessionUpdateNormalizer = new AcpSessionUpdateNormalizer();
  private sessionCwds = new Map<string, string>();
  private transport: AcpJsonRpcTransport | null = null;
  private unregisterTransportClose: (() => void) | null = null;

  constructor(private readonly plugin: GrimoirePlugin) {}

  getCapabilities(): Readonly<ProviderCapabilities> {
    return GEMINI_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    const prompt = buildGeminiPromptText(request);

    return {
      isCompact: false,
      mcpMentions: request.enabledMcpServers ?? new Set(),
      persistedContent: request.text,
      prompt,
      request,
    };
  }

  onReadyStateChange(listener: (ready: boolean) => void): () => void {
    this.readyListeners.push(listener);
    return () => {
      const index = this.readyListeners.indexOf(listener);
      if (index >= 0) {
        this.readyListeners.splice(index, 1);
      }
    };
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(conversation: { providerState?: Record<string, unknown>; sessionId?: string | null } | null): void {
    const nextSessionId = conversation?.sessionId ?? null;
    if (this.sessionId !== nextSessionId) {
      this.sessionInvalidated = false;
    }
    this.sessionId = nextSessionId;
  }

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    const settings = getGeminiProviderSettings(this.plugin.settings);
    if (!settings.enabled) {
      this.setReady(false);
      return false;
    }

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const resolvedCliPath = this.plugin.getResolvedProviderCliPath('gemini') ?? 'gemini';
    const runtimeEnv = buildGeminiRuntimeEnv(this.plugin.settings, resolvedCliPath);
    const nextLaunchKey = JSON.stringify({
      command: resolvedCliPath,
      env: settings.environmentVariables,
    });

    const shouldRestart = !this.process
      || !this.transport
      || !this.connection
      || !this.process.isAlive()
      || this.transport.isClosed
      || options?.force === true
      || this.currentLaunchKey !== nextLaunchKey;

    if (shouldRestart) {
      await this.shutdownProcess();
      await this.startProcess({
        args: ['--acp'],
        command: resolvedCliPath,
        cwd,
        runtimeEnv,
      });
      this.currentLaunchKey = nextLaunchKey;
      this.loadedSessionId = null;
    }

    if (this.sessionId) {
      if (this.loadedSessionId !== this.sessionId) {
        const loaded = await this.loadSession(this.sessionId, cwd);
        if (!loaded) {
          this.sessionInvalidated = true;
          this.clearActiveSession();
        }
      }
      return true;
    }

    if (!this.sessionId && !this.sessionInvalidated) {
      if (options?.allowSessionCreation === false) {
        return true;
      }
      return Boolean(await this.createSession(cwd));
    }

    return true;
  }

  async *query(
    turn: PreparedChatTurn,
    _conversationHistory?: ChatMessage[],
    queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!(await this.ensureReady())) {
      yield { type: 'error', content: 'Failed to start Gemini. Check the CLI path and login state.' };
      yield { type: 'done' };
      return;
    }

    if (!this.connection) {
      yield { type: 'error', content: 'Gemini runtime is not ready.' };
      yield { type: 'done' };
      return;
    }

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    if (!this.sessionId) {
      const sessionId = await this.createSession(cwd);
      if (!sessionId) {
        yield { type: 'error', content: 'Failed to create a Gemini session.' };
        yield { type: 'done' };
        return;
      }
    }

    const sessionId = this.sessionId!;
    this.activeTurn?.queue.close();
    this.activeTurn = {
      queue: new StreamChunkQueue(),
      sessionId,
    };
    this.currentTurnMetadata = {};
    this.contextUsage = null;
    this.promptUsage = null;
    this.sessionUpdateNormalizer.reset();

    const activeTurn = this.activeTurn;
    const promptPromise = this.connection.prompt({
      prompt: buildGeminiPromptBlocks(turn.request, queryOptions),
      sessionId,
    }).then((response) => {
      if (response.userMessageId) {
        this.currentTurnMetadata.userMessageId = response.userMessageId;
      }
      this.promptUsage = response.usage ?? null;
      const usage = buildAcpUsageInfo({
        contextWindow: this.contextUsage,
        model: this.getActiveModel() ?? undefined,
        promptUsage: this.promptUsage,
      });
      if (usage) {
        activeTurn.queue.push({ sessionId, type: 'usage', usage });
      }
      activeTurn.queue.push({ type: 'done' });
      activeTurn.queue.close();
    }).catch((error) => {
      activeTurn.queue.push({
        type: 'error',
        content: this.formatRuntimeError(error),
      });
      activeTurn.queue.push({ type: 'done' });
      activeTurn.queue.close();
    }).finally(() => {
      if (this.activeTurn === activeTurn) {
        this.activeTurn = null;
      }
    });

    try {
      while (true) {
        const chunk = await activeTurn.queue.next();
        if (!chunk) {
          break;
        }
        yield chunk;
      }
      await promptPromise;
    } finally {
      if (this.activeTurn === activeTurn) {
        this.activeTurn = null;
      }
    }
  }

  cancel(): void {
    if (this.connection && this.sessionId) {
      this.connection.cancel({ sessionId: this.sessionId });
    }
  }

  resetSession(): void {
    this.clearActiveSession();
    this.sessionInvalidated = false;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  consumeSessionInvalidation(): boolean {
    const invalidated = this.sessionInvalidated;
    this.sessionInvalidated = false;
    return invalidated;
  }

  isReady(): boolean {
    return this.ready;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return [];
  }

  getAuxiliaryModel(): string | null {
    return this.getActiveModel();
  }

  cleanup(): void {
    this.activeTurn?.queue.close();
    void this.shutdownProcess();
  }

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string,
    _mode?: ChatRewindMode,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  setApprovalDismisser(_dismisser: (() => void) | null): void {}

  setAskUserQuestionCallback(_callback: AskUserQuestionCallback | null): void {}

  setExitPlanModeCallback(_callback: ExitPlanModeCallback | null): void {}

  setPermissionModeSyncCallback(_callback: ((sdkMode: string) => void) | null): void {}

  setSubagentHookProvider(_getState: () => SubagentRuntimeState): void {}

  setAutoTurnCallback(_callback: AutoTurnCallback | null): void {}

  consumeTurnMetadata(): ChatTurnMetadata {
    const metadata = this.currentTurnMetadata;
    this.currentTurnMetadata = {};
    return metadata;
  }

  buildSessionUpdates(params: {
    conversation: Conversation | null;
    sessionInvalidated: boolean;
  }): SessionUpdateResult {
    const updates: Partial<Conversation> = {
      providerState: params.conversation?.providerState,
      sessionId: this.sessionId,
    };

    if (params.sessionInvalidated && !this.sessionId) {
      updates.providerState = undefined;
      updates.sessionId = null;
    }

    return { updates };
  }

  resolveSessionIdForFork(_conversation: Conversation | null): string | null {
    return null;
  }

  async loadSubagentToolCalls(_agentId: string): Promise<ToolCallInfo[]> {
    return [];
  }

  async loadSubagentFinalResult(_agentId: string): Promise<string | null> {
    return null;
  }

  private async startProcess(spec: GeminiLaunchSpec): Promise<void> {
    this.process = new AcpSubprocess({
      args: spec.args,
      command: spec.command,
      cwd: spec.cwd,
      env: spec.runtimeEnv,
    });
    this.process.start();

    this.transport = new AcpJsonRpcTransport({
      input: this.process.stdout,
      onClose: (listener) => this.process?.onClose(listener) ?? (() => {}),
      output: this.process.stdin,
    });
    this.unregisterTransportClose = this.transport.onClose(() => {
      this.setReady(false);
      this.activeTurn?.queue.close();
    });
    this.connection = new AcpClientConnection({
      clientInfo: {
        name: 'grimoire',
        version: this.plugin.manifest?.version ?? '0.0.0',
      },
      delegate: {
        fileSystem: {
          readTextFile: (request) => this.readTextFile(request),
          writeTextFile: (request) => this.writeTextFile(request),
        },
        onSessionNotification: (notification) => this.handleSessionNotification(notification),
        requestPermission: (request) => this.handlePermissionRequest(request),
      },
      transport: this.transport,
    });

    this.transport.start();
    await this.connection.initialize();
    this.setReady(true);
  }

  private async shutdownProcess(): Promise<void> {
    this.setReady(false);
    this.activeTurn?.queue.close();
    this.activeTurn = null;

    this.unregisterTransportClose?.();
    this.unregisterTransportClose = null;

    this.connection?.dispose();
    this.connection = null;

    this.transport?.dispose();
    this.transport = null;

    if (this.process) {
      await this.process.shutdown().catch(() => {});
      this.process = null;
    }
  }

  private async createSession(cwd: string): Promise<string | null> {
    if (!this.connection) {
      return null;
    }

    try {
      const response = await this.connection.newSession({
        cwd,
        mcpServers: [],
      });
      this.loadedSessionId = response.sessionId;
      this.sessionId = response.sessionId;
      this.sessionCwds.set(response.sessionId, cwd);
      this.syncSessionDiscovery({
        configOptions: response.configOptions ?? null,
        models: response.models ?? null,
        modes: response.modes ?? null,
      });
      return response.sessionId;
    } catch {
      return null;
    }
  }

  private async loadSession(sessionId: string, cwd: string): Promise<boolean> {
    if (!this.connection) {
      return false;
    }

    try {
      const response = await this.connection.loadSession({
        cwd,
        mcpServers: [],
        sessionId,
      });
      this.sessionInvalidated = false;
      this.loadedSessionId = response.sessionId;
      this.sessionId = response.sessionId;
      this.sessionCwds.set(response.sessionId, cwd);
      this.syncSessionDiscovery({
        configOptions: response.configOptions ?? null,
        models: response.models ?? null,
        modes: response.modes ?? null,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async handleSessionNotification(notification: AcpSessionNotification): Promise<void> {
    if (notification.sessionId !== this.sessionId) {
      return;
    }

    const normalized = this.sessionUpdateNormalizer.normalize(notification.update);
    if (normalized.type === 'config_options') {
      this.syncSessionDiscovery({
        configOptions: normalized.configOptions,
      });
      return;
    }

    if (!this.activeTurn || this.activeTurn.sessionId !== notification.sessionId) {
      return;
    }

    switch (normalized.type) {
      case 'message_chunk':
        if (normalized.role === 'assistant' && normalized.messageId) {
          this.currentTurnMetadata.assistantMessageId = normalized.messageId;
        }
        if (normalized.role === 'user' && normalized.messageId) {
          this.currentTurnMetadata.userMessageId = normalized.messageId;
        }
        for (const chunk of normalized.streamChunks) {
          this.activeTurn.queue.push(chunk);
        }
        return;
      case 'tool_call':
      case 'tool_call_update':
        for (const chunk of normalized.streamChunks) {
          this.activeTurn.queue.push(chunk);
        }
        return;
      case 'usage': {
        this.contextUsage = normalized.usage;
        geminiPlanUsageStore.recordCost(normalized.usage.cost ?? null);
        const usage = buildAcpUsageInfo({
          contextWindow: normalized.usage,
          model: this.getActiveModel() ?? undefined,
          promptUsage: this.promptUsage,
        });
        if (usage) {
          this.activeTurn.queue.push({
            sessionId: notification.sessionId,
            type: 'usage',
            usage,
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private syncSessionDiscovery(params: {
    configOptions?: Parameters<typeof extractAcpSessionModelState>[0]['configOptions'];
    models?: Parameters<typeof extractAcpSessionModelState>[0]['models'];
    modes?: Parameters<typeof extractAcpSessionModeState>[0]['modes'];
  }): void {
    const modelState = extractAcpSessionModelState(params);
    const modeState = extractAcpSessionModeState(params);
    const currentSettings = getGeminiProviderSettings(this.plugin.settings);
    const updates: Parameters<typeof updateGeminiProviderSettings>[1] = {};

    if (modelState.availableModels.length > 0) {
      const discoveredRawIds = modelState.availableModels
        .map((model) => model.id.trim())
        .filter(Boolean);
      updates.discoveredModels = modelState.availableModels.map((model): GeminiDiscoveredModel => ({
        description: model.description ?? undefined,
        label: model.name || model.id,
        rawId: model.id,
      }));
      if (currentSettings.visibleModels.length === 0) {
        updates.visibleModels = discoveredRawIds;
      }
    }

    if (modeState.availableModes.length > 0) {
      updates.availableModes = modeState.availableModes.map((mode): GeminiMode => ({
        description: mode.description ?? undefined,
        id: mode.id,
        name: mode.name,
      }));
    }

    if (modeState.currentModeId) {
      updates.selectedMode = modeState.currentModeId;
    }

    if (Object.keys(updates).length > 0) {
      updateGeminiProviderSettings(this.plugin.settings, updates);
      void this.plugin.saveSettings?.();
    }
  }

  private async handlePermissionRequest(
    _request: AcpRequestPermissionRequest,
  ): Promise<AcpRequestPermissionResponse> {
    if (!this.approvalCallback) {
      return { outcome: { outcome: 'cancelled' } };
    }

    return { outcome: { outcome: 'cancelled' } };
  }

  private async readTextFile(request: AcpReadTextFileRequest): Promise<{ content: string }> {
    const resolvedPath = this.resolveSessionPath(request.sessionId, request.path);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    if (request.line === undefined && request.limit === undefined) {
      return { content };
    }

    const lines = content.split(/\r?\n/);
    const startIndex = Math.max(0, (request.line ?? 1) - 1);
    const endIndex = request.limit
      ? startIndex + Math.max(0, request.limit)
      : lines.length;

    return {
      content: lines.slice(startIndex, endIndex).join('\n'),
    };
  }

  private async writeTextFile(request: AcpWriteTextFileRequest): Promise<Record<string, never>> {
    const resolvedPath = this.resolveSessionPath(request.sessionId, request.path);
    if (this.plugin.settings.permissionMode !== 'full_access') {
      if (!this.approvalCallback) {
        throw new Error('Gemini file write was not approved');
      }

      const decision = await this.approvalCallback(
        'write',
        {
          path: resolvedPath,
          relativePath: request.path,
        },
        `Gemini wants to write ${request.path}.`,
        { decisionReason: 'File write permission required' },
      );
      if (decision !== 'allow' && decision !== 'allow-always') {
        throw new Error('Gemini file write was not approved');
      }
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, request.content, 'utf-8');
    return {};
  }

  private resolveSessionPath(sessionId: string, rawPath: string): string {
    if (path.isAbsolute(rawPath)) {
      return rawPath;
    }

    const cwd = this.sessionCwds.get(sessionId)
      ?? getVaultPath(this.plugin.app)
      ?? process.cwd();
    return path.resolve(cwd, rawPath);
  }

  private getActiveModel(): string | null {
    const providerSettings = getGeminiProviderSettings(this.plugin.settings);
    const savedProviderModel = this.plugin.settings.savedProviderModel;
    const savedGeminiModel = savedProviderModel
      && typeof savedProviderModel === 'object'
      && !Array.isArray(savedProviderModel)
      ? (savedProviderModel as Record<string, unknown>).gemini
      : null;
    return typeof savedGeminiModel === 'string'
      ? savedGeminiModel
      : providerSettings.visibleModels[0] ?? 'gemini';
  }

  private formatRuntimeError(error: unknown): string {
    const baseMessage = error instanceof Error ? error.message : 'Gemini request failed';
    const stderr = this.process?.getStderrSnapshot();
    return stderr ? `${baseMessage}\n\n${stderr}` : baseMessage;
  }

  private clearActiveSession(): void {
    this.sessionId = null;
    this.loadedSessionId = null;
  }

  private setReady(ready: boolean): void {
    if (this.ready === ready) {
      return;
    }

    this.ready = ready;
    for (const listener of this.readyListeners) {
      listener(ready);
    }
  }
}

function buildGeminiPromptBlocks(
  request: ChatTurnRequest,
  queryOptions?: ChatRuntimeQueryOptions,
): AcpContentBlock[] {
  const prompt = buildGeminiPromptText(request);
  const text = request.orchestratorMode === true || queryOptions?.orchestratorMode === true
    ? applyOrchestratorModeInstructions(prompt)
    : prompt;
  const blocks: AcpContentBlock[] = [{ text, type: 'text' }];
  for (const image of request.images ?? []) {
    blocks.push(toAcpImage(image));
  }
  return blocks;
}

function buildGeminiPromptText(request: ChatTurnRequest): string {
  let prompt = request.text;

  if (request.vaultSearchContext) {
    prompt = appendVaultSearchContext(prompt, request.vaultSearchContext);
  }

  if (request.projectWorkspaceContext) {
    prompt = appendProjectWorkspaceContext(prompt, request.projectWorkspaceContext);
  }

  return prompt;
}

function toAcpImage(image: ImageAttachment): AcpContentBlock {
  return {
    data: image.data,
    mimeType: image.mediaType,
    type: 'image',
  };
}
