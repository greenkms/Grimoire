import type { AgentDefinition } from '../../../core/types';

export interface GeminiAgentDefinition extends AgentDefinition {
  persistenceKey?: string;
  kind?: 'local' | 'remote';
  temperature?: number;
  maxTurns?: number;
  timeoutMins?: number;
  mcpServers?: Record<string, unknown>;
}
