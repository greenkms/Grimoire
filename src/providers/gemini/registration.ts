import type { ProviderRegistration } from '../../core/providers/types';
import {
  GeminiInlineEditService,
  GeminiInstructionRefineService,
  GeminiTaskResultInterpreter,
  GeminiTitleGenerationService,
} from './auxiliary/GeminiNoopServices';
import { GEMINI_PROVIDER_CAPABILITIES } from './capabilities';
import { geminiSettingsReconciler } from './env/GeminiSettingsReconciler';
import { GeminiConversationHistoryService } from './history/GeminiConversationHistoryService';
import { GeminiChatRuntime } from './runtime/GeminiChatRuntime';
import { getGeminiProviderSettings } from './settings';
import { geminiChatUIConfig } from './ui/GeminiChatUIConfig';

export const geminiProviderRegistration: ProviderRegistration = {
  blankTabOrder: 80,
  capabilities: GEMINI_PROVIDER_CAPABILITIES,
  chatUIConfig: geminiChatUIConfig,
  createInlineEditService: () => new GeminiInlineEditService(),
  createInstructionRefineService: () => new GeminiInstructionRefineService(),
  createRuntime: ({ plugin }) => new GeminiChatRuntime(plugin),
  createTitleGenerationService: () => new GeminiTitleGenerationService(),
  displayName: 'Gemini CLI (Legacy)',
  environmentKeyPatterns: [/^GEMINI_/i, /^GOOGLE_/i, /^VERTEX_/i],
  historyService: new GeminiConversationHistoryService(),
  isEnabled: (settings) => getGeminiProviderSettings(settings).enabled,
  settingsReconciler: geminiSettingsReconciler,
  taskResultInterpreter: new GeminiTaskResultInterpreter(),
};
