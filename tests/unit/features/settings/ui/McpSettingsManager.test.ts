import { createMockEl } from '@test/helpers/mockElement';

import { McpSettingsManager } from '@/features/settings/ui/McpSettingsManager';

// The mock element's ownerDocument delegates document-level event listeners to
// globalThis.document, so we install a controllable fake there.
const docAdd = jest.fn();
const docRemove = jest.fn();

function createManager(servers: any[] = []) {
  const container = createMockEl();
  const manager = new McpSettingsManager(container, {
    app: {} as any,
    mcpStorage: {
      load: jest.fn().mockResolvedValue(servers),
      save: jest.fn().mockResolvedValue(undefined),
    },
    broadcastMcpReload: jest.fn().mockResolvedValue(undefined),
  });

  return { container, manager };
}

const flush = () => new Promise((resolve) => window.setTimeout(resolve, 0));

describe('McpSettingsManager document click listener lifecycle', () => {
  beforeEach(() => {
    docAdd.mockReset();
    docRemove.mockReset();
    (globalThis as any).document = { addEventListener: docAdd, removeEventListener: docRemove };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });
  it('does not accumulate document click listeners across re-renders', async () => {
    const { manager } = createManager();
    await flush();

    docAdd.mockClear();
    docRemove.mockClear();

    (manager as any).render();
    (manager as any).render();
    (manager as any).render();

    // Each render registers its dismiss handler but first removes the previous
    // one, so the number of live document listeners never grows past one.
    expect(docAdd).toHaveBeenCalledTimes(3);
    expect(docRemove).toHaveBeenCalledTimes(3);
  });

  it('removes the document click listener on dispose', async () => {
    const { manager } = createManager();
    await flush();

    docAdd.mockClear();
    docRemove.mockClear();

    (manager as any).dispose();

    expect(docRemove).toHaveBeenCalledTimes(1);
    expect(docAdd).not.toHaveBeenCalled();
  });

  it('exposes MCP enablement as toggle state instead of a reversed state label', async () => {
    const { container } = createManager([
      {
        name: 'filesystem',
        config: { command: 'filesystem-server' },
        enabled: true,
        contextSaving: false,
      },
    ]);
    await flush();

    const toggle = (container).querySelectorAll('.grimoire-mcp-action-btn').find(
      (button: any) => button.getAttribute('aria-label') === 'filesystem',
    );

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle?.getAttribute('title')).toBe('Enabled');
  });
});
