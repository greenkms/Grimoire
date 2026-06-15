import type { ProviderRegistration } from '../../core/providers/types';
import {
  AntigravityInlineEditService,
  AntigravityInstructionRefineService,
  AntigravityTaskResultInterpreter,
  AntigravityTitleGenerationService,
} from './auxiliary/AntigravityNoopServices';
import { ANTIGRAVITY_PROVIDER_CAPABILITIES } from './capabilities';
import { antigravitySettingsReconciler } from './env/AntigravitySettingsReconciler';
import { AntigravityConversationHistoryService } from './history/AntigravityConversationHistoryService';
import { AntigravityChatRuntime } from './runtime/AntigravityChatRuntime';
import { getAntigravityProviderSettings } from './settings';
import { antigravityChatUIConfig } from './ui/AntigravityChatUIConfig';

export const antigravityProviderRegistration: ProviderRegistration = {
  blankTabOrder: 70,
  capabilities: ANTIGRAVITY_PROVIDER_CAPABILITIES,
  chatUIConfig: antigravityChatUIConfig,
  createInlineEditService: () => new AntigravityInlineEditService(),
  createInstructionRefineService: () => new AntigravityInstructionRefineService(),
  createRuntime: ({ plugin }) => new AntigravityChatRuntime(plugin),
  createTitleGenerationService: () => new AntigravityTitleGenerationService(),
  displayName: 'Antigravity',
  environmentKeyPatterns: [/^ANTIGRAVITY_/i, /^GOOGLE_/i, /^GEMINI_/i, /^VERTEX_/i],
  historyService: new AntigravityConversationHistoryService(),
  isEnabled: (settings) => getAntigravityProviderSettings(settings).enabled,
  settingsReconciler: antigravitySettingsReconciler,
  taskResultInterpreter: new AntigravityTaskResultInterpreter(),
};
