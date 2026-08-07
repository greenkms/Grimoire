import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import {
  AcpMcpStorage,
  getAcpMcpConfigPath,
} from '@/providers/acp/mcp/AcpMcpStorage';
import { toAcpMcpServers } from '@/providers/acp/mcp/toAcpMcpServers';

type MockAdapter = Pick<VaultFileAdapter, 'exists' | 'read' | 'write'> & {
  store: Record<string, string>;
};

function createAdapter(files: Record<string, string> = {}): MockAdapter {
  const store = { ...files };
  return {
    store,
    exists: async (path) => path in store,
    read: async (path) => {
      if (!(path in store)) throw new Error(`Missing ${path}`);
      return store[path];
    },
    write: async (path, content) => {
      store[path] = content;
    },
  };
}

describe('AcpMcpStorage', () => {
  it('round-trips Grimoire metadata in provider-owned storage', async () => {
    const adapter = createAdapter();
    const storage = new AcpMcpStorage(adapter, 'qwen');
    const servers = [{
      name: 'filesystem',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      enabled: false,
      contextSaving: true,
      disabledTools: ['read_file'],
      description: 'Vault files',
    }];

    await storage.save(servers);

    expect(JSON.parse(adapter.store['.grimoire/mcp/qwen.json'])).toEqual({
      mcpServers: {
        filesystem: servers[0].config,
      },
      _grimoire: {
        servers: {
          filesystem: {
            enabled: false,
            contextSaving: true,
            disabledTools: ['read_file'],
            description: 'Vault files',
          },
        },
      },
    });
    expect(await storage.load()).toEqual(servers);
  });

  it('returns no servers for malformed configuration and skips invalid entries', async () => {
    const adapter = createAdapter({
      '.grimoire/mcp/gemini.json': JSON.stringify({
        mcpServers: {
          valid: { command: 'valid' },
          invalid: { command: 42 },
        },
        _grimoire: { servers: { valid: { enabled: 'no' } } },
      }),
    });
    const storage = new AcpMcpStorage(adapter, 'gemini');

    expect(await storage.load()).toEqual([{
      name: 'valid',
      config: { command: 'valid' },
      enabled: true,
      contextSaving: false,
    }]);

    adapter.store['.grimoire/mcp/gemini.json'] = '{invalid';
    expect(await storage.load()).toEqual([]);
  });

  it('uses a separate config file for every ACP provider', () => {
    expect(getAcpMcpConfigPath('opencode')).toBe('.grimoire/mcp/opencode.json');
    expect(getAcpMcpConfigPath('mimocode')).toBe('.grimoire/mcp/mimocode.json');
    expect(getAcpMcpConfigPath('kimicode')).toBe('.grimoire/mcp/kimicode.json');
    expect(getAcpMcpConfigPath('grok')).toBe('.grimoire/mcp/grok.json');
    expect(getAcpMcpConfigPath('qwen')).toBe('.grimoire/mcp/qwen.json');
    expect(getAcpMcpConfigPath('gemini')).toBe('.grimoire/mcp/gemini.json');
  });
});

describe('toAcpMcpServers', () => {
  it('filters disabled servers and converts stdio, HTTP, and SSE configs', () => {
    expect(toAcpMcpServers([
      {
        name: 'disabled',
        config: { command: 'ignored' },
        enabled: false,
        contextSaving: true,
      },
      {
        name: 'stdio',
        config: { command: 'node', env: { TOKEN: 'secret' } },
        enabled: true,
        contextSaving: false,
        disabledTools: ['ignored'],
      },
      {
        name: 'http',
        config: { type: 'http', url: 'https://example.test/mcp', headers: { Authorization: 'Bearer token' } },
        enabled: true,
        contextSaving: true,
      },
      {
        name: 'sse',
        config: { type: 'sse', url: 'https://example.test/sse', headers: { 'X-Key': 'value' } },
        enabled: true,
        contextSaving: true,
      },
    ])).toEqual([
      {
        name: 'stdio',
        command: 'node',
        args: [],
        env: [{ name: 'TOKEN', value: 'secret' }],
      },
      {
        type: 'http',
        name: 'http',
        url: 'https://example.test/mcp',
        headers: [{ name: 'Authorization', value: 'Bearer token' }],
      },
      {
        type: 'sse',
        name: 'sse',
        url: 'https://example.test/sse',
        headers: [{ name: 'X-Key', value: 'value' }],
      },
    ]);
  });
});
