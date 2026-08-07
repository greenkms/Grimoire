import type { ProviderCapabilities } from '../../core/providers/types';

export const QWEN_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: 'qwen',
  supportsPersistentRuntime: true,
  // Resume uses ACP loadSession + Grimoire-persisted messages only; no native
  // transcript store is hydrated yet.
  supportsNativeHistory: false,
  supportsPlanMode: true,
  supportsRewind: false,
  supportsFork: false,
  // Commands are enabled only after Qwen emits ACP available_commands_update;
  // the runtime otherwise returns an empty command list.
  supportsProviderCommands: true,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  reasoningControl: 'effort',
});
