import type { StreamChunk } from '../../core/types';
import type { SDKToolUseResult } from '../../core/types/diff';
import type { AcpToolCall, AcpToolCallUpdate } from './types';

interface AcpToolStreamState {
  input: Record<string, unknown>;
  rawName: string;
}

export interface AcpToolStreamPresentationAdapter {
  normalizeToolInput(rawName: string | undefined, input: Record<string, unknown>): Record<string, unknown>;
  normalizeToolName(rawName: string | undefined): string;
  normalizeToolUseResult(
    rawName: string | undefined,
    input: Record<string, unknown>,
    rawOutput: unknown,
  ): SDKToolUseResult | undefined;
  resolveRawToolName(
    currentRawName: string | undefined,
    update: {
      kind?: string | null;
      title?: string | null;
    },
  ): string;
}

export class AcpToolStreamAdapter {
  private readonly toolStates = new Map<string, AcpToolStreamState>();

  constructor(private readonly adapter: AcpToolStreamPresentationAdapter) {}

  reset(): void {
    this.toolStates.clear();
  }

  normalizeToolCall(toolCall: AcpToolCall, chunks: StreamChunk[]): StreamChunk[] {
    const state = this.updateToolState(undefined, {
      kind: toolCall.kind,
      locations: toolCall.locations,
      rawInput: toolCall.rawInput,
      title: toolCall.title,
    });
    this.toolStates.set(toolCall.toolCallId, state);
    return chunks.map((chunk) => this.normalizeChunk(chunk, state, toolCall.rawOutput));
  }

  normalizeToolCallUpdate(toolCallUpdate: AcpToolCallUpdate, chunks: StreamChunk[]): StreamChunk[] {
    const previousState = this.toolStates.get(toolCallUpdate.toolCallId);
    const state = this.updateToolState(previousState, {
      kind: toolCallUpdate.kind,
      locations: toolCallUpdate.locations,
      rawInput: toolCallUpdate.rawInput,
      title: toolCallUpdate.title,
    });
    this.toolStates.set(toolCallUpdate.toolCallId, state);

    const result: StreamChunk[] = [];
    if (
      toolCallUpdate.rawInput !== undefined
      || !sameRecord(state.input, previousState?.input ?? {})
    ) {
      result.push({
        id: toolCallUpdate.toolCallId,
        input: state.input,
        name: this.adapter.normalizeToolName(state.rawName),
        type: 'tool_use',
      });
    }

    for (const chunk of chunks) {
      result.push(this.normalizeChunk(chunk, state, toolCallUpdate.rawOutput));
    }

    return result;
  }

  private updateToolState(
    current: AcpToolStreamState | undefined,
    update: {
      kind?: string | null;
      locations?: Array<{ path: string }> | null;
      rawInput?: unknown;
      title?: string | null;
    },
  ): AcpToolStreamState {
    const nextRawName = this.adapter.resolveRawToolName(current?.rawName, update);
    const nextInput = current?.input ?? {};

    if (update.rawInput !== undefined) {
      const rawInput = mergeLocationPaths(
        normalizeRawToolInput(update.rawInput),
        update.locations,
        nextRawName,
        update.kind,
      );
      return this.buildToolState(nextRawName, { ...nextInput, ...rawInput });
    }

    const locationInput = mergeLocationPaths({}, update.locations, nextRawName, update.kind);
    if (Object.keys(locationInput).length > 0) {
      return this.buildToolState(nextRawName, { ...nextInput, ...locationInput });
    }

    if (nextRawName !== current?.rawName) {
      return this.buildToolState(nextRawName, nextInput);
    }

    return current ?? this.buildToolState(nextRawName, {});
  }

  private buildToolState(
    rawName: string,
    input: Record<string, unknown>,
  ): AcpToolStreamState {
    return {
      input: this.adapter.normalizeToolInput(rawName, input),
      rawName,
    };
  }

  private normalizeChunk(
    chunk: StreamChunk,
    state: AcpToolStreamState,
    rawOutput?: unknown,
  ): StreamChunk {
    switch (chunk.type) {
      case 'tool_use':
        return {
          ...chunk,
          input: state.input,
          name: this.adapter.normalizeToolName(state.rawName),
        };
      case 'tool_result': {
        const toolUseResult = this.adapter.normalizeToolUseResult(state.rawName, state.input, rawOutput);
        return toolUseResult
          ? { ...chunk, toolUseResult }
          : chunk;
      }
      default:
        return chunk;
    }
  }
}

function normalizeRawToolInput(rawInput: unknown): Record<string, unknown> {
  return rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
    ? rawInput as Record<string, unknown>
    : {};
}

function mergeLocationPaths(
  input: Record<string, unknown>,
  locations: Array<{ path: string }> | null | undefined,
  rawName: string,
  kind?: string | null,
): Record<string, unknown> {
  const normalizedName = rawName.trim().toLowerCase();
  const isReadLike = normalizedName === 'read' || kind === 'read';
  if (!isReadLike) {
    return input;
  }

  const existingPath = firstTrimmedString(
    input.file_path,
    input.filePath,
    input.filepath,
    input.path,
  );
  if (existingPath) {
    return input;
  }

  const locationPath = firstTrimmedString(
    ...(locations ?? []).map((location) => location?.path),
  );
  if (!locationPath) {
    return input;
  }

  return {
    ...input,
    file_path: locationPath,
  };
}

function firstTrimmedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return undefined;
}

function sameRecord(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => Object.is(left[key], right[key]));
}
