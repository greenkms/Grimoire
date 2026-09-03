import { type ChildProcess, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ProviderRegistry } from '../../../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type {
  ApprovalCallback,
  AskUserQuestionCallback,
  AutoTurnCallback,
  ChatRewindMode,
  ChatRewindResult,
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
  SlashCommand,
  StreamChunk,
  ToolCallInfo,
} from '../../../core/types';
import { t } from '../../../i18n/i18n';
import type GrimoirePlugin from '../../../main';
import { appendBrowserContext } from '../../../utils/browser';
import { appendCanvasContext } from '../../../utils/canvas';
import {
  appendContextFiles,
  appendCurrentNote,
  appendExcludedFoldersContext,
  appendProjectWorkspaceContext,
  appendVaultSearchContext,
  formatCurrentNote,
  XML_CONTEXT_PATTERN,
} from '../../../utils/context';
import { appendEditorContext } from '../../../utils/editor';
import { getVaultPath } from '../../../utils/path';
import { createUtf8ChunkDecoder, type Utf8ChunkDecoder } from '../../../utils/utf8Stream';
import { ANTIGRAVITY_PROVIDER_CAPABILITIES } from '../capabilities';
import { decodeAntigravityModelId } from '../models';
import {
  normalizeAntigravityToolInput,
  normalizeAntigravityToolName,
} from '../normalization/antigravityToolNormalization';
import { getAntigravityProviderSettings } from '../settings';
import {
  type AntigravityCliCapabilities,
  NO_ANTIGRAVITY_CLI_CAPABILITIES,
  probeAntigravityCliCapabilities,
} from './AntigravityCliCapabilities';
import {
  type AntigravityImageAttachmentBundle,
  attachAntigravityImages,
} from './AntigravityImageAttachments';
import { buildAntigravityProcessLaunch } from './AntigravityProcessLaunch';
import { buildAntigravityRuntimeEnv } from './AntigravityRuntimeEnvironment';
import {
  type AntigravityResultFrame,
  type AntigravityStreamEvent,
  type AntigravityStreamJsonParser,
  createAntigravityStreamJsonParser,
  formatAntigravityUserEvent,
} from './AntigravityStreamJson';

const OUTPUT_BUFFER_LIMIT = 64_000;
// agy emits stream-json frames on step transitions, not continuously: a single
// long tool call can legitimately keep the pipes silent for many minutes (a
// healthy ~5-minute `run_command` measured in the wild), so pipe silence only
// implies a hang on this timescale. Log-file growth counts as liveness too,
// and the 30-minute absolute ceiling stays the real backstop.
const PRINT_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const PRINT_LOG_LIVENESS_POLL_MS = 15_000;
// Absolute ceiling for one request, independent of how active the run stays.
const PRINT_ABSOLUTE_TIMEOUT_MS = 30 * 60 * 1000;
// How long `close` may lag `exit` while buffered stdio drains before the
// streams are forced closed; an orphaned grandchild holding the pipes would
// otherwise hold the whole run hostage.
const PRINT_DRAIN_GRACE_MS = 2_000;
// Keep agy's own print timeout just below Grimoire's absolute ceiling so the
// CLI self-terminates with a structured result frame instead of being killed
// from outside (#70).
const ANTIGRAVITY_PRINT_TIMEOUT_FLAG = '29m';

/**
 * Progress handed to the chat while the run is open. The parser contributes
 * answer text and tool steps; the runtime adds `log_activity`, which is the
 * only sign of life a long pipe-silent tool call produces.
 */
type AntigravityProgressEvent =
  | AntigravityStreamEvent
  | { elapsedMs: number; type: 'log_activity' };

/**
 * How much of the final answer the user has already watched arrive. Normally
 * this is all of `streamed`, because the deltas sum to `result.response`; when
 * they diverge it is the part they still agree on, which is what keeps the
 * remainder from repeating text that is already on screen.
 */
function sharedPrefixLength(streamed: string, output: string): number {
  const limit = Math.min(streamed.length, output.length);
  let index = 0;
  while (index < limit && streamed[index] === output[index]) {
    index += 1;
  }

  return index;
}

interface AntigravityPrintSpec {
  addDirPath: string | null;
  cliCapabilities?: AntigravityCliCapabilities;
  command: string;
  cwd: string;
  model: string | null;
  onProgress?: (event: AntigravityProgressEvent) => void;
  permissionMode: string;
  prompt: string;
  runtimeEnv: NodeJS.ProcessEnv;
}

export interface AntigravityPrintArgsSpec {
  addDirPath?: string | null;
  logFilePath?: string;
  model: string | null;
  permissionMode: string;
  printTimeout?: boolean;
  prompt: string;
  streamJson?: boolean;
}

export class AntigravityChatRuntime implements ChatRuntime {
  readonly providerId = 'antigravity' as const;

  private activeProcess: ChildProcess | null = null;
  private currentTurnMetadata: ChatTurnMetadata = {};
  private cancelRequested = false;
  private probeProcess: ChildProcess | null = null;
  private readonly readyListeners: Array<(ready: boolean) => void> = [];
  private ready = false;
  // Bumped by every query() so a turn that is still draining (e.g. transcript
  // recovery) cannot clear process handles a newer turn already claimed.
  private runSequence = 0;
  // Children this side killed through cancel(); their runs are routine user
  // cancels, not failures worth diagnosing.
  private readonly cancelledProcesses = new WeakSet<ChildProcess>();

  constructor(private readonly plugin: GrimoirePlugin) {}

  getCapabilities(): Readonly<ProviderCapabilities> {
    return ANTIGRAVITY_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    const prompt = buildAntigravityPromptText(request);

    return {
      isCompact: false,
      mcpMentions: request.enabledMcpServers ?? new Set(),
      persistedContent: prompt,
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

  syncConversationState(_conversation: { providerState?: Record<string, unknown>; sessionId?: string | null } | null): void {}

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(): Promise<boolean> {
    const settings = getAntigravityProviderSettings(this.plugin.settings);
    this.setReady(settings.enabled);
    return settings.enabled;
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!(await this.ensureReady())) {
      yield { type: 'error', content: t('chat.ui.errors.provider.antigravityDisabled') };
      yield { type: 'done' };
      return;
    }
    this.cancelRequested = false;

    const vaultPath = getVaultPath(this.plugin.app);
    const cwd = vaultPath ?? process.cwd();
    const command = this.plugin.getResolvedProviderCliPath('antigravity') ?? 'agy';
    const runtimeEnv = buildAntigravityRuntimeEnv(this.plugin.settings, command);
    const permissionMode = this.getPermissionMode();
    if (permissionMode !== 'full_access') {
      yield {
        type: 'error',
        content: t('chat.ui.errors.provider.antigravitySafeModeUnavailable'),
      };
      yield { type: 'done' };
      return;
    }
    // Bumped only once this turn can really run, so an early-returning turn
    // never invalidates the guarded cleanup of a turn that is still draining.
    const runToken = ++this.runSequence;

    // Assigned inside the try so a malformed attachment reaches the localized
    // catch clause instead of escaping the generator, while the cleanup below
    // still sees whatever was written before the throw.
    let attachments: AntigravityImageAttachmentBundle | null = null;

    try {
      // agy takes no image flag and its stream-json user event carries
      // `content` as a plain string, so attachments ride along as temp files
      // named in the prompt. Measured 2026-09-03: agy opens an absolute path
      // from the prompt even outside the workspace and without `--add-dir`.
      const droppedAttachments: string[] = [];
      attachments = attachAntigravityImages(
        buildAntigravityPrintPrompt(
          await expandAntigravityVaultSkillInvocation(turn.prompt),
          conversationHistory,
        ),
        turn.request.images,
        (image, error) => {
          droppedAttachments.push(image.name);
          this.plugin.recordDebugLog?.({
            data: {
              error: error instanceof Error ? error.message : String(error),
              mediaType: image.mediaType,
              name: image.name,
              providerId: this.providerId,
            },
            event: 'print.imageAttachmentFailed',
            level: 'warn',
            scope: 'provider.antigravity',
          });
        },
      );
      const prompt = attachments.prompt;
      if (droppedAttachments.length > 0) {
        // Debug logging is off by default, so without this the user watches
        // agy answer about fewer images than they attached and reads it as the
        // agent ignoring them.
        yield {
          content: t('chat.ui.images.notAttached', { names: droppedAttachments.join(', ') }),
          type: 'notice',
        };
      }

      yield { content: 'Starting Antigravity...', type: 'status' };
      const cliCapabilities = await probeAntigravityCliCapabilities(command, runtimeEnv, (child) => {
        this.probeProcess = child;
      });
      this.probeProcess = null;
      if (this.cancelRequested) {
        // The consumer discards chunks once cancelRequested is set, so a bare
        // done ends the turn without launching a print run the user stopped.
        yield { type: 'done' };
        return;
      }
      this.plugin.recordDebugLog?.({
        data: {
          addDir: cliCapabilities.addDir,
          command,
          printTimeout: cliCapabilities.printTimeout,
          providerId: this.providerId,
          streamJson: cliCapabilities.streamJson,
        },
        event: 'print.capabilityProbe',
        level: 'debug',
        scope: 'provider.antigravity',
      });
      // agy reports progress through callbacks while runPrint stays pending,
      // so the turn is driven by a queue the callbacks fill and this generator
      // drains. Yielding straight from a callback is impossible, and waiting
      // for runPrint to resolve is what used to hide the whole run until the
      // process exited.
      const pending: AntigravityProgressEvent[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      const notify = (): void => {
        const resume = wake;
        wake = null;
        resume?.();
      };
      const printRun = this.runPrint({
        addDirPath: cliCapabilities.addDir ? vaultPath : null,
        cliCapabilities,
        command,
        cwd,
        model: this.getSelectedRawModel(queryOptions),
        onProgress: (event) => {
          pending.push(event);
          notify();
        },
        permissionMode,
        prompt,
        runtimeEnv,
      });
      // Handling the rejection here keeps a failure that lands while this
      // generator is parked from surfacing as an unhandled rejection; the
      // original error is re-awaited below so the catch clause still sees it.
      const printSettled = printRun.catch(() => undefined).finally(() => {
        finished = true;
        notify();
      });

      let streamedText = '';
      const openToolIds = new Set<string>();
      for (;;) {
        while (pending.length > 0) {
          const event = pending.shift() as AntigravityProgressEvent;
          if (event.type === 'text') {
            // The whole-answer path trimmed before yielding; streaming must not
            // open the bubble - or the saved message - with agy's leading
            // blank lines just because the answer now arrives in pieces.
            const text = streamedText ? event.text : event.text.replace(/^\s+/, '');
            streamedText += event.text;
            if (text) {
              yield { content: text, type: 'text' };
            }
            continue;
          }
          if (event.type === 'log_activity') {
            yield {
              content: t('chat.ui.status.antigravityWorking', {
                seconds: Math.round(event.elapsedMs / 1_000),
              }),
              type: 'status',
            };
            continue;
          }
          const toolId = `antigravity-${event.stepId}`;
          if (event.type === 'tool_start') {
            openToolIds.add(toolId);
            yield {
              id: toolId,
              input: normalizeAntigravityToolInput(event.toolName, event.input),
              name: normalizeAntigravityToolName(event.toolName),
              type: 'tool_use',
            };
            continue;
          }
          // A completion whose ACTIVE half never arrived still names its tool
          // and carries what it printed, so the card is opened here rather than
          // dropping the call and its output from the transcript entirely.
          if (!openToolIds.delete(toolId)) {
            yield {
              id: toolId,
              input: {},
              name: normalizeAntigravityToolName(event.toolName),
              type: 'tool_use',
            };
          }
          // agy reports what the tool printed on the DONE frame, so the card is
          // closed with the real output. A tool that printed nothing yields an
          // empty string, which renders as "no result" rather than as invented
          // metadata such as the step duration.
          yield { content: event.output, id: toolId, type: 'tool_result' };
        }
        if (finished) {
          break;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      // A run that ends between ACTIVE and DONE - cancelled, timed out, or
      // ERROR mid-tool - leaves its card spinning, and nothing downstream
      // reconciles a tool call left running: it is persisted that way.
      for (const openToolId of openToolIds) {
        yield { content: '', id: openToolId, type: 'tool_result' };
      }
      openToolIds.clear();

      await printSettled;
      // Rethrows whatever runPrint rejected with, preserving non-Error values
      // for the localized fallback in the catch clause.
      const output = await printRun;

      // The deltas already sum to result.response, so only what the final
      // answer adds on top of them is still untold — normally nothing, or the
      // trailing warning agy appends after an ERROR-flagged success. That
      // remainder keeps its leading blank line, which is what separates the
      // warning from the answer it follows.
      // Normally the deltas sum to result.response exactly and the remainder is
      // empty, or is the trailing warning agy appends after an ERROR-flagged
      // success - that remainder keeps its leading blank line, which is what
      // separates the warning from the answer it follows. When the two diverge,
      // only the part past their common prefix is appended: repeating an answer
      // the user already watched stream in reads as a bug, and nothing is lost
      // because the divergent text is exactly what was never shown.
      const shared = sharedPrefixLength(streamedText, output);
      const tail = streamedText
        ? output.slice(shared).trimEnd()
        // Nothing was streamed at all (transcript recovery, legacy --print).
        : output.trim();
      if (tail) {
        yield { content: tail, type: 'text' };
      } else if (!streamedText.trim()) {
        yield {
          type: 'error',
          content: t('chat.ui.errors.provider.antigravityEmptyOutput'),
        };
      }
      yield { type: 'done' };
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error
          ? error.message
          : t('chat.ui.errors.provider.requestFailed', {
            provider: ProviderRegistry.getProviderDisplayNameOrId('antigravity'),
          }),
      };
      yield { type: 'done' };
    } finally {
      // Unlike the agy log, which is kept on failure for diagnosis, the
      // attachment copies hold user data and carry nothing diagnostic, so
      // they go on every exit: success, failure and cancel alike.
      attachments?.cleanup();
      // A newer turn that already spawned must keep its handles; clearing
      // them here would make that turn un-cancellable.
      if (runToken === this.runSequence) {
        this.activeProcess = null;
        this.probeProcess = null;
      }
    }
  }

  cancel(): void {
    this.cancelRequested = true;
    // Track the killed children per process: a close event can arrive long
    // after cancel (drain grace, slow pipes), when the instance flag may
    // already belong to a newer turn.
    if (this.activeProcess) {
      this.cancelledProcesses.add(this.activeProcess);
      this.activeProcess.kill('SIGTERM');
    }
    // Kill the in-flight help probe too so cancel does not wait out its
    // timeout before the generator can observe the flag.
    if (this.probeProcess) {
      this.cancelledProcesses.add(this.probeProcess);
      this.probeProcess.kill('SIGTERM');
    }
  }

  resetSession(): void {}

  getSessionId(): string | null {
    return null;
  }

  consumeSessionInvalidation(): boolean {
    return false;
  }

  isReady(): boolean {
    return this.ready;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return [];
  }

  getAuxiliaryModel(): string | null {
    return this.getSelectedRawModel();
  }

  cleanup(): void {
    this.cancel();
    this.setReady(false);
  }

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string,
    _mode?: ChatRewindMode,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  setApprovalCallback(_callback: ApprovalCallback | null): void {}

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
    return {
      updates: {
        providerState: params.conversation?.providerState,
        sessionId: null,
      },
    };
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

  private runPrint(spec: AntigravityPrintSpec): Promise<string> {
    const cliCapabilities = spec.cliCapabilities ?? NO_ANTIGRAVITY_CLI_CAPABILITIES;
    const streamJson = cliCapabilities.streamJson;
    const printLogFilePath = createAntigravityPrintLogPath();
    const args = buildAntigravityPrintArgs({
      ...spec,
      logFilePath: printLogFilePath,
      printTimeout: cliCapabilities.printTimeout,
      streamJson,
    });
    this.plugin.recordDebugLog?.({
      data: {
        argsSummary: summarizeAntigravityPrintArgs(args),
        command: spec.command,
        commandSource: classifyAgyCommand(spec.command),
        cwdLabel: getCwdLabel(this.plugin, spec.cwd),
        homePresent: Boolean(process.env.HOME),
        mode: spec.permissionMode,
        model: spec.model ?? 'default',
        pathEntryCount: (process.env.PATH ?? '').split(':').filter(Boolean).length,
        pathHasLocalBin: (process.env.PATH ?? '').split(':').includes(`${process.env.HOME ?? ''}/.local/bin`),
        promptLength: spec.prompt.length,
        providerId: this.providerId,
        shellPresent: Boolean(process.env.SHELL),
      },
      event: 'print.spawn',
      level: 'debug',
      scope: 'provider.antigravity',
    });
    return new Promise<string>((resolve, reject) => {
      const launch = buildAntigravityProcessLaunch(spec.command, args, spec.runtimeEnv);
      this.plugin.recordDebugLog?.({
        data: {
          launchMode: launch.launchMode,
          providerId: this.providerId,
        },
        event: 'print.launchMode',
        level: 'debug',
        scope: 'provider.antigravity',
      });
      const proc = spawn(launch.command, launch.args, {
        cwd: spec.cwd,
        env: spec.runtimeEnv,
        shell: launch.shell,
        stdio: [streamJson ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.activeProcess = proc;
      this.plugin.recordDebugLog?.({
        data: {
          launchMode: launch.launchMode,
          pid: proc.pid ?? -1,
          providerId: this.providerId,
          stdinMode: streamJson ? 'pipe' : 'ignore',
          stdioMode: streamJson ? 'pipe-pipe-pipe' : 'ignore-pipe-pipe',
        },
        event: 'print.processStarted',
        level: 'debug',
        scope: 'provider.antigravity',
      });
      if (streamJson && proc.stdin) {
        // The child can exit before draining stdin (agy exits 1 on an empty
        // prompt), and the resulting EPIPE arrives as a stream error that
        // would otherwise crash the renderer (#69).
        proc.stdin.on('error', (error) => {
          this.plugin.recordDebugLog?.({
            data: { providerId: this.providerId },
            error,
            event: 'print.stdinError',
            level: 'warn',
            scope: 'provider.antigravity',
          });
        });
        proc.stdin.write(formatAntigravityUserEvent(spec.prompt));
        proc.stdin.end();
      }

      let stdout = '';
      let stderr = '';
      let settled = false;
      // The accumulators stay empty in stream-json mode (stdout) and are
      // tail-capped (stderr), so byte counts for debug logs come from these
      // counters instead of the retained strings.
      let stdoutBytesSeen = 0;
      let stderrBytesSeen = 0;
      // Each stream needs its own decoder: a multibyte character can straddle two
      // chunks, and decoding chunks independently turns both halves into U+FFFD.
      const stdoutDecoder = createUtf8ChunkDecoder();
      const stderrDecoder = createUtf8ChunkDecoder();
      // In stream-json mode stdout is parsed line-by-line so a `result` frame
      // longer than any fixed buffer cap still parses; the capped accumulator
      // remains only for the legacy free-text `--print` transport.
      const streamParser: AntigravityStreamJsonParser | null = streamJson
        ? createAntigravityStreamJsonParser({
          onEvent: (event) => {
            // Frames that arrive after the run settled belong to a turn the
            // consumer already finished; delivering them would append to a
            // closed message.
            if (settled) {
              return;
            }
            spec.onProgress?.(event);
          },
        })
        : null;
      // `exit` can fire before the final stdout chunks drain from the pipe, so
      // the parser is only considered complete after the decoder hands back
      // any held-back partial character and the trailing newline-less line is
      // flushed.
      let flushedStreamParser = false;
      const flushStreamParser = (): void => {
        if (!streamParser || flushedStreamParser) {
          return;
        }
        flushedStreamParser = true;
        streamParser.write(stdoutDecoder.end());
        streamParser.end();
      };
      let sawClose = false;
      let sawStdout = false;
      let sawStderr = false;
      const startedAt = Date.now();
      let inactivityTimer: number | undefined;
      let absoluteTimer: number | undefined;
      let drainGraceTimer: number | undefined;
      let logLivenessPoll: number | undefined;
      const settle = (callback: () => void): void => {
        if (settled) {
          return;
        }
        // Before `settled` closes the progress channel, not after: the trailing
        // newline-less line is only parsed by this flush, and a tool DONE
        // sitting there would otherwise be dropped and leave its card open.
        flushStreamParser();
        settled = true;
        window.clearTimeout(inactivityTimer);
        window.clearTimeout(absoluteTimer);
        window.clearTimeout(drainGraceTimer);
        window.clearInterval(logLivenessPoll);
        callback();
      };
      const expire = (reason: 'absolute' | 'inactivity'): void => {
        this.plugin.recordDebugLog?.({
          data: {
            killSignal: 'SIGTERM',
            pid: proc.pid ?? -1,
            providerId: this.providerId,
          },
          event: 'print.signalSent',
          level: 'warn',
          scope: 'provider.antigravity',
        });
        proc.kill('SIGTERM');
        window.setTimeout(() => {
          if (proc.exitCode === null && proc.signalCode === null) {
            this.plugin.recordDebugLog?.({
              data: {
                killSignal: 'SIGKILL',
                pid: proc.pid ?? -1,
                providerId: this.providerId,
              },
              event: 'print.forceKill',
              level: 'error',
              scope: 'provider.antigravity',
            });
            proc.kill('SIGKILL');
          }
        }, 2_000);
        this.plugin.recordDebugLog?.({
          data: {
            durationMs: Date.now() - startedAt,
            providerId: this.providerId,
            reason,
            stderrBytes: stderrBytesSeen,
            stderrPreview: summarizeCliText(stderr),
            stdoutBytes: stdoutBytesSeen,
            timeoutMs: reason === 'inactivity'
              ? PRINT_INACTIVITY_TIMEOUT_MS
              : PRINT_ABSOLUTE_TIMEOUT_MS,
          },
          event: 'print.timeout',
          level: 'error',
          scope: 'provider.antigravity',
        });
        // The kill above means the close handler never runs its cleanup;
        // record that the log file is being kept — unless a complete answer
        // was already delivered, in which case the turn succeeded.
        flushStreamParser();
        const streamResult = streamParser?.getResult() ?? null;
        if (streamResult?.response.trim()) {
          // A CLI that hangs right after emitting its result frame still
          // delivered the answer; resolve with it instead of discarding a
          // healthy reply — even when the frame is ERROR-flagged, because
          // agy reports tool-permission bookkeeping failures after the
          // agent has already streamed its complete answer.
          void fs.unlink(printLogFilePath).catch(() => undefined);
          settle(() => resolve(formatAntigravityAnswerWithNotice(streamResult)));
          return;
        }
        this.plugin.recordDebugLog?.({
          data: {
            logFilePath: printLogFilePath,
            providerId: this.providerId,
          },
          event: 'print.logFilePreserved',
          level: 'warn',
          scope: 'provider.antigravity',
        });
        if (streamResult?.status === 'ERROR') {
          settle(() => reject(new Error(formatAntigravityResultError(streamResult))));
          return;
        }
        const message = reason === 'inactivity'
          ? `Antigravity request timed out after ${PRINT_INACTIVITY_TIMEOUT_MS / 60_000} minutes without CLI output or log activity.`
          : `Antigravity request exceeded the ${PRINT_ABSOLUTE_TIMEOUT_MS / 60_000}-minute limit.`;
        settle(() => reject(new Error(message)));
      };
      const armInactivityTimer = (): void => {
        if (settled) {
          return;
        }
        window.clearTimeout(inactivityTimer);
        inactivityTimer = window.setTimeout(() => expire('inactivity'), PRINT_INACTIVITY_TIMEOUT_MS);
      };
      absoluteTimer = window.setTimeout(() => expire('absolute'), PRINT_ABSOLUTE_TIMEOUT_MS);
      armInactivityTimer();
      // agy keeps appending to its own log during a long silent tool call, so
      // the log growing proves the run is alive even when no stream frames
      // arrive on the pipes.
      let lastLogSize = 0;
      logLivenessPoll = window.setInterval(() => {
        if (settled) {
          return;
        }
        void fs.stat(printLogFilePath)
          .then((stats) => {
            if (settled || stats.size <= lastLogSize) {
              return;
            }
            lastLogSize = stats.size;
            this.plugin.recordDebugLog?.({
              data: {
                logBytes: stats.size,
                providerId: this.providerId,
              },
              event: 'print.logLiveness',
              level: 'debug',
              scope: 'provider.antigravity',
            });
            // The same growth that proves the run is alive is also the only
            // thing the chat can show during a pipe-silent tool call, so the
            // heartbeat rides this poll instead of adding a second timer.
            spec.onProgress?.({ elapsedMs: Date.now() - startedAt, type: 'log_activity' });
            armInactivityTimer();
          })
          .catch(() => undefined);
      }, PRINT_LOG_LIVENESS_POLL_MS);

      proc.stdout?.on('data', (chunk: Buffer | string) => {
        armInactivityTimer();
        stdoutBytesSeen += chunk.length;
        if (streamParser) {
          streamParser.write(stdoutDecoder.write(chunk));
        } else {
          stdout = appendLimited(stdout, chunk, stdoutDecoder);
        }
        if (!sawStdout) {
          sawStdout = true;
          this.plugin.recordDebugLog?.({
            data: {
              pid: proc.pid ?? -1,
              providerId: this.providerId,
              stdoutBytes: stdoutBytesSeen,
            },
            event: 'print.stdout',
            level: 'debug',
            scope: 'provider.antigravity',
          });
        }
      });
      proc.stderr?.on('data', (chunk: Buffer | string) => {
        armInactivityTimer();
        stderrBytesSeen += chunk.length;
        stderr = appendLimited(stderr, chunk, stderrDecoder);
        if (!sawStderr) {
          sawStderr = true;
          this.plugin.recordDebugLog?.({
            data: {
              pid: proc.pid ?? -1,
              providerId: this.providerId,
              stderrBytes: stderrBytesSeen,
              stderrPreview: summarizeCliText(stderr),
            },
            event: 'print.stderr',
            level: 'warn',
            scope: 'provider.antigravity',
          });
        }
      });
      proc.on('exit', () => {
        // Killing a cmd.exe wrapper (the default Windows launch shape)
        // orphans the real CLI, which inherits the pipe handles and can keep
        // `close` from ever firing. Force the streams closed shortly after
        // the process itself is gone so the run still settles; buffered
        // output has long since drained by then.
        drainGraceTimer = window.setTimeout(() => {
          if (settled || sawClose) {
            return;
          }
          proc.stdout?.destroy();
          proc.stderr?.destroy();
        }, PRINT_DRAIN_GRACE_MS);
      });
      proc.on('error', (error) => {
        settle(() => {
          this.plugin.recordDebugLog?.({
            data: {
              providerId: this.providerId,
            },
            error,
            event: 'print.spawnError',
            level: 'error',
            scope: 'provider.antigravity',
          });
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
      // `exit` can fire before the final stdout chunks drain from the pipe,
      // and the result frame is agy's last write, so the outcome is only
      // settled on `close`, which Node emits once stdio has flushed too.
      proc.on('close', (code, signal) => {
        sawClose = true;
        window.clearTimeout(drainGraceTimer);
        // A routine user cancel is identified per process: the instance flag
        // may already belong to a newer turn by the time this close lands.
        const cancelledByUser = this.cancelledProcesses.has(proc);
        const status = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
        this.plugin.recordDebugLog?.({
          data: {
            durationMs: Date.now() - startedAt,
            pid: proc.pid ?? -1,
            providerId: this.providerId,
            signal: signal ?? 'none',
            status,
            stderrBytes: stderrBytesSeen,
            stdoutBytes: stdoutBytesSeen,
          },
          event: 'print.close',
          level: 'debug',
          scope: 'provider.antigravity',
        });
        settle(() => {
          void (async () => {
            this.plugin.recordDebugLog?.({
              data: {
                durationMs: Date.now() - startedAt,
                providerId: this.providerId,
                status,
                stderrBytes: stderrBytesSeen,
                stderrPreview: summarizeCliText(stderr),
                stdoutBytes: stdoutBytesSeen,
              },
              event: code === 0 ? 'print.exit' : 'print.failed',
              level: code === 0 ? 'info' : 'error',
              scope: 'provider.antigravity',
            });
            flushStreamParser();
            const streamResult = streamParser?.getResult() ?? null;
            let succeeded = false;
            try {
              const answeredResult = streamResult?.response.trim() ? streamResult : null;
              if (answeredResult) {
                // A complete streamed answer wins over the exit code: agy
                // emits status ERROR for tool-permission bookkeeping defects
                // after the agent has already finished its work, and the
                // text_delta frames sum exactly to result.response. Surface
                // the CLI complaint as a trailing note, not a hard failure.
                if (answeredResult.status === 'ERROR') {
                  this.plugin.recordDebugLog?.({
                    data: {
                      errorPreview: summarizeCliText(answeredResult.error ?? ''),
                      providerId: this.providerId,
                    },
                    event: 'print.resultErrorWithAnswer',
                    level: 'warn',
                    scope: 'provider.antigravity',
                  });
                }
                succeeded = true;
                resolve(formatAntigravityAnswerWithNotice(answeredResult));
                return;
              }
              if (streamResult?.status === 'ERROR') {
                // agy writes a structured result before exiting non-zero;
                // its error string says why, while the exit code alone does not.
                reject(new Error(formatAntigravityResultError(streamResult)));
                return;
              }
              if (code === 0) {
                const directOutput = stdout;
                const transcriptOutput = directOutput
                  ? ''
                  : await recoverAntigravityPrintOutputFromTranscript(printLogFilePath, spec.runtimeEnv);
                if (transcriptOutput) {
                  this.plugin.recordDebugLog?.({
                    data: {
                      providerId: this.providerId,
                      transcriptBytes: transcriptOutput.length,
                    },
                    event: 'print.transcriptRecovered',
                    level: 'info',
                    scope: 'provider.antigravity',
                  });
                }
                succeeded = Boolean(directOutput || transcriptOutput);
                resolve(directOutput || transcriptOutput);
                return;
              }

              reject(new Error(formatAntigravityExitError(code, signal, stderr)));
            } finally {
              // The log file is the only place agy records the real
              // wall-clock cause of an aborted run, so keep it for
              // diagnosis and remove it only once the turn produced an
              // answer. A routine user cancel is not a failure worth
              // diagnosing, so those logs are removed too.
              if (succeeded || cancelledByUser) {
                await fs.unlink(printLogFilePath).catch(() => undefined);
              } else {
                this.plugin.recordDebugLog?.({
                  data: {
                    logFilePath: printLogFilePath,
                    providerId: this.providerId,
                  },
                  event: 'print.logFilePreserved',
                  level: 'warn',
                  scope: 'provider.antigravity',
                });
              }
            }
          })().catch(reject);
        });
      });
    });
  }

  private getSelectedRawModel(queryOptions?: ChatRuntimeQueryOptions): string | null {
    if (typeof queryOptions?.model === 'string') {
      const selectedModel = decodeAntigravityModelId(queryOptions.model);
      if (selectedModel) {
        return selectedModel;
      }
    }
    const savedProviderModel = this.plugin.settings.savedProviderModel;
    const savedAntigravityModel = savedProviderModel
      && typeof savedProviderModel === 'object'
      && !Array.isArray(savedProviderModel)
      ? (savedProviderModel as Record<string, unknown>).antigravity
      : null;
    if (typeof savedAntigravityModel === 'string') {
      return decodeAntigravityModelId(savedAntigravityModel);
    }

    const providerSettings = getAntigravityProviderSettings(this.plugin.settings);
    return providerSettings.visibleModels[0] ?? null;
  }

  private getPermissionMode(): string {
    return typeof this.plugin.settings.permissionMode === 'string'
      ? this.plugin.settings.permissionMode
      : 'normal';
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

/**
 * `agy --print` does not expose Claude-style slash skills.  Preserve the
 * familiar `/skill-name` workflow by expanding a vault skill before the
 * prompt is handed to AGY.  Only an invocation at the beginning of a turn is
 * expanded; ordinary prose containing a slash is left untouched.  Skills are
 * resolved through the registered command catalog so the slash menu and the
 * expansion always refer to the same skill, and appended XML context blocks
 * stay outside the wrapper instead of being labeled as skill input.
 */
export async function expandAntigravityVaultSkillInvocation(prompt: string): Promise<string> {
  const { userText, contextTail } = splitPromptXmlContext(prompt);
  const match = userText.match(/^\/([\p{L}\p{N}_-]+)(?:\s|$)([\s\S]*)$/u);
  if (!match) return prompt;

  const [, skillName, argumentsText] = match;
  const skill = await findAntigravityVaultSkill(skillName);
  if (!skill) return prompt;
  const expanded = [
    `You are executing the vault skill "${skillName}". Follow its instructions.`,
    '',
    skill,
    argumentsText.trim()
      ? `\nUser input for this skill:\n${argumentsText.trim()}`
      : '',
  ].join('\n').trimEnd();
  return contextTail ? `${expanded}${contextTail}` : expanded;
}

function splitPromptXmlContext(prompt: string): { userText: string; contextTail: string } {
  const xmlMatch = prompt.match(XML_CONTEXT_PATTERN);
  if (xmlMatch?.index === undefined) {
    return { userText: prompt, contextTail: '' };
  }
  return {
    userText: prompt.substring(0, xmlMatch.index),
    contextTail: prompt.substring(xmlMatch.index),
  };
}

async function findAntigravityVaultSkill(skillName: string): Promise<string | null> {
  const catalog = ProviderWorkspaceRegistry.getCommandCatalog('antigravity');
  if (!catalog) return null;
  try {
    const entries = await catalog.listVaultEntries();
    const entry = entries.find(
      (candidate) => candidate.name.toLowerCase() === skillName.toLowerCase(),
    );
    return entry?.content?.trim() ? entry.content : null;
  } catch {
    return null;
  }
}

export function buildAntigravityPrintArgs(spec: AntigravityPrintArgsSpec): string[] {
  const args: string[] = [];
  if (spec.addDirPath) {
    args.push('--add-dir', spec.addDirPath);
  }
  if (spec.permissionMode === 'full_access') {
    args.push('--dangerously-skip-permissions');
  } else {
    args.push('--sandbox');
  }
  if (spec.logFilePath) {
    args.push('--log-file', spec.logFilePath);
  }
  if (spec.model) {
    args.push('--model', spec.model);
  }
  if (spec.printTimeout) {
    // Without an explicit value agy defaults its own print timeout to five
    // minutes and kills healthy long turns before Grimoire can see why (#70).
    args.push('--print-timeout', ANTIGRAVITY_PRINT_TIMEOUT_FLAG);
  }
  if (spec.streamJson) {
    // agy rejects `--print` combined with `--input-format stream-json`, so the
    // prompt moves to stdin and never touches argv: on Windows the whole
    // transcript as one argv argument hits CreateProcess's ~32k limit (#69).
    args.push('--input-format', 'stream-json', '--output-format', 'stream-json');
  } else {
    args.push('--print', spec.prompt);
  }
  return args;
}

function buildAntigravityPromptText(request: ChatTurnRequest): string {
  let prompt = request.text;

  if (request.excludedFolders && request.excludedFolders.length > 0) {
    prompt = appendExcludedFoldersContext(prompt, request.excludedFolders);
  }

  if (request.currentNotePath) {
    prompt = appendCurrentNote(prompt, request.currentNotePath);
  }

  if (request.vaultSearchContext) {
    prompt = appendVaultSearchContext(prompt, request.vaultSearchContext);
  }

  if (request.contextFiles && request.contextFiles.length > 0) {
    prompt = appendContextFiles(prompt, request.contextFiles);
  }

  if (request.projectWorkspaceContext) {
    prompt = appendProjectWorkspaceContext(prompt, request.projectWorkspaceContext);
  }

  if (request.editorSelection) {
    prompt = appendEditorContext(prompt, request.editorSelection);
  }

  if (request.browserSelection) {
    prompt = appendBrowserContext(prompt, request.browserSelection);
  }

  if (request.canvasSelection) {
    prompt = appendCanvasContext(prompt, request.canvasSelection);
  }

  return prompt;
}

function buildAntigravityPrintPrompt(
  currentPrompt: string,
  conversationHistory?: ChatMessage[],
): string {
  const history = (conversationHistory ?? [])
    .filter((message) => !message.isRebuiltContext && (message.content.trim() || message.currentNote))
    .slice(-12)
    .map(formatAntigravityHistoryMessage)
    .join('\n\n');

  return history ? `${history}\n\nUser: ${currentPrompt}` : currentPrompt;
}

function formatAntigravityHistoryMessage(message: ChatMessage): string {
  const role = message.role === 'assistant' ? 'Assistant' : 'User';
  let content = message.content.trim();

  if (
    message.role === 'user'
    && message.currentNote
    && !content.includes('<current_note>')
  ) {
    const currentNoteContext = formatCurrentNote(message.currentNote);
    content = content ? `${currentNoteContext}\n\n${content}` : currentNoteContext;
  }

  return `${role}: ${content}`;
}

function createAntigravityPrintLogPath(): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return path.join(os.tmpdir(), `grimoire-antigravity-print-${suffix}.log`);
}

async function recoverAntigravityPrintOutputFromTranscript(
  logFilePath: string,
  runtimeEnv: NodeJS.ProcessEnv,
): Promise<string> {
  const logText = await fs.readFile(logFilePath, 'utf-8').catch(() => '');
  if (!logText) {
    return '';
  }

  const conversationId = extractAntigravityConversationId(logText);
  if (!conversationId) {
    return '';
  }

  const appDataDir = extractAntigravityAppDataDir(logText)
    ?? getDefaultAntigravityAppDataDir(runtimeEnv);
  if (!appDataDir) {
    return '';
  }

  const transcriptPaths = [
    path.join(appDataDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl'),
    path.join(appDataDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript_full.jsonl'),
  ];
  for (const transcriptPath of transcriptPaths) {
    const transcriptText = await fs.readFile(transcriptPath, 'utf-8').catch(() => '');
    const content = extractLastAntigravityModelContent(transcriptText);
    if (content) {
      return content;
    }
  }
  return '';
}

function extractAntigravityConversationId(logText: string): string | null {
  const match = logText.match(/\b(?:conversation=|Created conversation )([0-9a-f-]{36})\b/i);
  return match?.[1] ?? null;
}

function extractAntigravityAppDataDir(logText: string): string | null {
  const match = logText.match(/CLI app data directory:\s*(.+)$/mi);
  return match?.[1]?.trim() || null;
}

function getDefaultAntigravityAppDataDir(runtimeEnv: NodeJS.ProcessEnv): string | null {
  const home = runtimeEnv.USERPROFILE
    ?? (runtimeEnv.HOMEDRIVE && runtimeEnv.HOMEPATH ? `${runtimeEnv.HOMEDRIVE}${runtimeEnv.HOMEPATH}` : undefined)
    ?? runtimeEnv.HOME;
  return home ? path.join(home, '.gemini', 'antigravity-cli') : null;
}

function extractLastAntigravityModelContent(transcriptText: string): string {
  let lastContent = '';
  for (const line of transcriptText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const record = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        record.source === 'MODEL'
        && record.status === 'DONE'
        && typeof record.content === 'string'
        && record.content.trim()
      ) {
        lastContent = record.content;
      }
    } catch {
      // Ignore malformed transcript lines from partial writes.
    }
  }
  return lastContent;
}

function appendLimited(
  current: string,
  chunk: Buffer | string,
  decoder: Utf8ChunkDecoder,
): string {
  return `${current}${decoder.write(chunk)}`.slice(-OUTPUT_BUFFER_LIMIT);
}

function getCwdLabel(plugin: GrimoirePlugin, cwd: string): string {
  return cwd === getVaultPath(plugin.app) ? 'vault' : 'process';
}

function summarizeAntigravityPrintArgs(args: string[]): string {
  return args.map((arg, index) => {
    if (arg === '--print' || arg === '--add-dir' || arg === '--log-file') {
      return arg;
    }
    if (index > 0 && args[index - 1] === '--print') {
      return '<prompt>';
    }
    // Keep the absolute vault path and the temp log path (which embeds the
    // username) out of debug logs; the shared sanitizer's path redaction
    // does not cover every platform's home and temp prefixes.
    if (index > 0 && args[index - 1] === '--add-dir') {
      return '<vault-path>';
    }
    if (index > 0 && args[index - 1] === '--log-file') {
      return '<log-path>';
    }
    return arg;
  }).join(' ');
}

function classifyAgyCommand(command: string): string {
  if (command === 'agy') {
    return 'path';
  }
  if (command.endsWith('/.local/bin/agy')) {
    return 'homeLocalBin';
  }
  return 'absolute';
}

function summarizeCliText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function formatAntigravityExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
): string {
  const status = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
  const message = `Antigravity CLI exited (${status})`;
  const details = stderr.trim();
  return details ? `${message}\n\n${details}` : message;
}

function formatAntigravityResultError(result: AntigravityResultFrame): string {
  const detail = result.error?.trim() || `status ${result.status}`;
  return `Antigravity CLI reported an error: ${detail}`;
}

/**
 * agy can flag `status:"ERROR"` for CLI-internal tool-permission bookkeeping
 * after the agent has already streamed a complete answer; the answer is real
 * (the text_delta frames sum exactly to result.response), so it survives and
 * the complaint rides along as a trailing note instead of a hard failure.
 */
function formatAntigravityAnswerWithNotice(result: AntigravityResultFrame): string {
  const detail = result.status === 'ERROR'
    ? result.error?.trim().replace(/\s+/g, ' ')
    : '';
  if (!detail) {
    return result.response;
  }
  return `${result.response}\n\n> Warning: Antigravity CLI reported an error after this answer: ${detail.slice(0, 500)}`;
}
