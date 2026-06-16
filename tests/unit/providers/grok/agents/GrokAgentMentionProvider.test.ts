import { GrokAgentMentionProvider } from '@/providers/grok/agents/GrokAgentMentionProvider';
import type { GrokAgentStorage } from '@/providers/grok/storage/GrokAgentStorage';
import type { GrokAgentDefinition } from '@/providers/grok/types/agent';

function makeAgent(overrides: Partial<GrokAgentDefinition> = {}): GrokAgentDefinition {
  return {
    name: 'test-agent',
    description: 'A test agent',
    prompt: 'Do useful work.',
    ...overrides,
  };
}

function makeMockStorage(agents: GrokAgentDefinition[] = []): GrokAgentStorage {
  return { loadAll: async () => agents } as unknown as GrokAgentStorage;
}

describe('GrokAgentMentionProvider', () => {
  it('returns an empty array before loadAgents is called', () => {
    const provider = new GrokAgentMentionProvider(makeMockStorage([makeAgent()]));
    expect(provider.searchAgents('')).toEqual([]);
  });

  it('returns only explicit subagents after load', async () => {
    const provider = new GrokAgentMentionProvider(makeMockStorage([
      makeAgent({ name: 'review', description: 'Reviews code', mode: 'subagent' }),
      makeAgent({ name: 'plan', description: 'Plans work', mode: 'all' }),
      makeAgent({ name: 'general', description: 'Uses the default all-mode behavior' }),
      makeAgent({ name: 'build', description: 'Primary only', mode: 'primary' }),
      makeAgent({ name: 'hidden-review', description: 'Hidden', hidden: true, mode: 'subagent' }),
      makeAgent({ name: 'disabled-review', description: 'Disabled', disable: true, mode: 'subagent' }),
    ]));
    await provider.loadAgents();

    expect(provider.searchAgents('')).toEqual([
      {
        id: 'review',
        name: 'review',
        description: 'Reviews code',
        source: 'vault',
      },
    ]);
  });

  it('filters case-insensitively by name and description', async () => {
    const provider = new GrokAgentMentionProvider(makeMockStorage([
      makeAgent({ name: 'security/review', description: 'Finds auth issues', mode: 'subagent' }),
      makeAgent({ name: 'perf/explore', description: 'Profiles hot paths', mode: 'subagent' }),
    ]));
    await provider.loadAgents();

    expect(provider.searchAgents('SECURITY')).toHaveLength(1);
    expect(provider.searchAgents('auth')).toHaveLength(1);
    expect(provider.searchAgents('missing')).toEqual([]);
  });
});
