import { createMockEl } from '@test/helpers/mockElement';

import { McpSettingsManager } from '@/features/settings/ui/McpSettingsManager';

// The mock element's ownerDocument delegates document-level event listeners to
// globalThis.document, so we install a controllable fake there.
const docAdd = jest.fn();
const docRemove = jest.fn();

function createManager() {
  const container = createMockEl();
  const manager = new McpSettingsManager(container as any, {
    app: {} as any,
    mcpStorage: {
      load: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    } as any,
    broadcastMcpReload: jest.fn().mockResolvedValue(undefined),
  });

  return { manager };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
});
