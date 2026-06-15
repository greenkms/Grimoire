import type { ProviderCapabilities } from '../../core/providers/types';

export const MIMOCODE_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: 'mimocode',
  supportsPersistentRuntime: true,
  supportsNativeHistory: true,
  supportsPlanMode: true,
  supportsRewind: false,
  supportsFork: false,
  supportsProviderCommands: true,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  reasoningControl: 'effort',
});
