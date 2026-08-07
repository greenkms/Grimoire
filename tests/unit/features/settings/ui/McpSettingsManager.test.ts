import { createMockEl } from '@test/helpers/mockElement';

import { McpSettingsManager } from '@/features/settings/ui/McpSettingsManager';

// The mock element's ownerDocument delegates document-level event listeners to
// globalThis.document, so we install a controllable fake there.
const docAdd = jest.fn();
const docRemove = jest.fn();

function createManager(
  servers: any[] = [],
  features?: { contextSaving?: boolean; toolFiltering?: boolean },
) {
  const container = createMockEl();
  const manager = new McpSettingsManager(container, {
    app: {} as any,
    mcpStorage: {
      load: jest.fn().mockResolvedValue(servers),
      save: jest.fn().mockResolvedValue(undefined),
    },
    broadcastMcpReload: jest.fn().mockResolvedValue(undefined),
    features,
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
  it('registers an outside-click listener only while the add menu is open', async () => {
    const { container, manager } = createManager();
    await flush();

    docAdd.mockClear();
    docRemove.mockClear();

    (manager as any).render();
    (manager as any).render();
    (manager as any).render();

    expect(docAdd).not.toHaveBeenCalled();
    expect(docRemove).not.toHaveBeenCalled();

    container.querySelectorAll('.grimoire-settings-action-btn')[0]?.click();
    expect(docAdd).toHaveBeenCalledTimes(1);
  });

  it('removes the document click listener on dispose', async () => {
    const { manager } = createManager();
    await flush();

    docAdd.mockClear();
    docRemove.mockClear();

    (manager as any).dispose();

    expect(docRemove).not.toHaveBeenCalled();
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

  it('does not show unsupported context-saving state for ACP-managed servers', async () => {
    const { container } = createManager([
      {
        name: 'filesystem',
        config: { command: 'filesystem-server' },
        enabled: true,
        contextSaving: true,
      },
    ], { contextSaving: false, toolFiltering: false });
    await flush();

    expect((container).querySelectorAll('.grimoire-mcp-context-saving-badge')).toHaveLength(0);
  });
});
