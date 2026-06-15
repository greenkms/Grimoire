import type { AgentMentionProvider } from '../../../core/providers/types';
import type { MimocodeAgentStorage } from '../storage/MimocodeAgentStorage';
import type { MimocodeAgentDefinition } from '../types/agent';

export class MimocodeAgentMentionProvider implements AgentMentionProvider {
  private agents: MimocodeAgentDefinition[] = [];

  constructor(private storage: MimocodeAgentStorage) {}

  async loadAgents(): Promise<void> {
    this.agents = await this.storage.loadAll();
  }

  searchAgents(query: string): Array<{
    id: string;
    name: string;
    description?: string;
    source: 'plugin' | 'vault' | 'global' | 'builtin';
  }> {
    const q = query.toLowerCase();
    return this.agents
      .filter((agent) => isMentionableSubagent(agent))
      .filter((agent) => (
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q)
      ))
      .map((agent) => ({
        id: agent.name,
        name: agent.name,
        description: agent.description,
        source: 'vault' as const,
      }));
  }
}

function isMentionableSubagent(agent: MimocodeAgentDefinition): boolean {
  if (agent.hidden || agent.disable) {
    return false;
  }

  return agent.mode === 'subagent';
}
