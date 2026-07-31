import type { ProviderRegistration } from '../../core/providers/types';
import {
  QwenInlineEditService,
  QwenInstructionRefineService,
  QwenTaskResultInterpreter,
  QwenTitleGenerationService,
} from './auxiliary/QwenNoopServices';
import { QWEN_PROVIDER_CAPABILITIES } from './capabilities';
import { qwenSettingsReconciler } from './env/QwenSettingsReconciler';
import { QwenConversationHistoryService } from './history/QwenConversationHistoryService';
import { QwenChatRuntime } from './runtime/QwenChatRuntime';
import { getQwenProviderSettings } from './settings';
import { qwenChatUIConfig } from './ui/QwenChatUIConfig';

export const qwenProviderRegistration: ProviderRegistration = {
  blankTabOrder: 80,
  capabilities: QWEN_PROVIDER_CAPABILITIES,
  chatUIConfig: qwenChatUIConfig,
  createInlineEditService: () => new QwenInlineEditService(),
  createInstructionRefineService: () => new QwenInstructionRefineService(),
  createRuntime: ({ plugin }) => new QwenChatRuntime(plugin),
  createTitleGenerationService: () => new QwenTitleGenerationService(),
  displayName: 'Qwen Code',
  environmentKeyPatterns: [/^QWEN_/i, /^DASHSCOPE_/i, /^WEB_SEARCH_/i],
  historyService: new QwenConversationHistoryService(),
  isEnabled: (settings) => getQwenProviderSettings(settings).enabled,
  settingsReconciler: qwenSettingsReconciler,
  taskResultInterpreter: new QwenTaskResultInterpreter(),
};
