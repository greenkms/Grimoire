import type {
  InlineEditRequest,
  InlineEditResult,
  InlineEditService,
  InstructionRefineService,
  ProviderTaskResultInterpreter,
  ProviderTaskTerminalStatus,
  RefineProgressCallback,
  TitleGenerationCallback,
  TitleGenerationService,
} from '../../../core/providers/types';
import type { InstructionRefineResult } from '../../../core/types';

const UNSUPPORTED_MESSAGE = 'Antigravity auxiliary tasks are not implemented yet.';

export class AntigravityTitleGenerationService implements TitleGenerationService {
  async generateTitle(
    conversationId: string,
    _userMessage: string,
    callback: TitleGenerationCallback,
  ): Promise<void> {
    await callback(conversationId, { success: false, error: UNSUPPORTED_MESSAGE });
  }

  cancel(): void {}
}

export class AntigravityInstructionRefineService implements InstructionRefineService {
  setModelOverride(_model?: string): void {}

  resetConversation(): void {}

  async refineInstruction(
    _rawInstruction: string,
    _existingInstructions: string,
    _onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    return { success: false, error: UNSUPPORTED_MESSAGE };
  }

  async continueConversation(
    _message: string,
    _onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    return { success: false, error: UNSUPPORTED_MESSAGE };
  }

  cancel(): void {}
}

export class AntigravityInlineEditService implements InlineEditService {
  setModelOverride(_model?: string): void {}

  resetConversation(): void {}

  async editText(_request: InlineEditRequest): Promise<InlineEditResult> {
    return { success: false, error: UNSUPPORTED_MESSAGE };
  }

  async continueConversation(_message: string, _contextFiles?: string[]): Promise<InlineEditResult> {
    return { success: false, error: UNSUPPORTED_MESSAGE };
  }

  cancel(): void {}
}

export class AntigravityTaskResultInterpreter implements ProviderTaskResultInterpreter {
  hasAsyncLaunchMarker(_toolUseResult: unknown): boolean {
    return false;
  }

  extractAgentId(_toolUseResult: unknown): string | null {
    return null;
  }

  extractStructuredResult(_toolUseResult: unknown): string | null {
    return null;
  }

  resolveTerminalStatus(
    _toolUseResult: unknown,
    fallbackStatus: ProviderTaskTerminalStatus,
  ): ProviderTaskTerminalStatus {
    return fallbackStatus;
  }

  extractTagValue(_payload: string, _tagName: string): string | null {
    return null;
  }
}
