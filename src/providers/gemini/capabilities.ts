import type { ProviderCapabilities } from '../../core/providers/types';

export const GEMINI_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: 'gemini',
  supportsPersistentRuntime: true,
  // Resume uses ACP loadSession + Grimoire-persisted messages only; no native
  // transcript store is hydrated yet.
  supportsNativeHistory: false,
  supportsPlanMode: true,
  supportsRewind: false,
  supportsFork: false,
  supportsProviderCommands: false,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  // Effort UI is exposed for session discovery, but the runtime only applies
  // model selection until Gemini ACP effort options are wired end-to-end.
  reasoningControl: 'none',
});
