import {
  CodexModelListingService,
} from '@/providers/codex/runtime/CodexModelListingService';

const mockTransportRequest = jest.fn();
const mockTransportDispose = jest.fn();
const mockTransportStart = jest.fn();
const mockProcessStart = jest.fn();
const mockProcessShutdown = jest.fn().mockResolvedValue(undefined);
const mockResolveLaunchSpec = jest.fn();

jest.mock('@/providers/codex/runtime/CodexRpcTransport', () => ({
  CodexRpcTransport: jest.fn().mockImplementation(() => ({
    request: mockTransportRequest,
    dispose: mockTransportDispose,
    start: mockTransportStart,
    notify: jest.fn(),
  })),
}));

jest.mock('@/providers/codex/runtime/CodexAppServerProcess', () => ({
  CodexAppServerProcess: jest.fn().mockImplementation(() => ({
    start: mockProcessStart,
    shutdown: mockProcessShutdown,
  })),
}));

jest.mock('@/providers/codex/runtime/codexAppServerSupport', () => ({
  initializeCodexAppServerTransport: jest.fn().mockResolvedValue({
    userAgent: 'test/0.1',
    codexHome: '/home/user/.codex',
    platformFamily: 'unix',
    platformOs: 'linux',
  }),
  resolveCodexAppServerLaunchSpec: (...args: unknown[]) => mockResolveLaunchSpec(...args),
}));

import { CodexAppServerProcess as MockedProcessClass } from '@/providers/codex/runtime/CodexAppServerProcess';

describe('CodexModelListingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveLaunchSpec.mockReturnValue({
      target: { method: 'host-native', platformFamily: 'unix', platformOs: 'linux' },
      command: 'codex',
      args: ['app-server', '--listen', 'stdio://'],
      spawnCwd: '/repo',
      targetCwd: '/repo',
      env: { OPENAI_API_KEY: 'sk-test' },
      pathMapper: {
        target: { method: 'host-native', platformFamily: 'unix', platformOs: 'linux' },
        toTargetPath: jest.fn(),
        toHostPath: jest.fn((value: string) => value),
        mapTargetPathList: jest.fn(),
        canRepresentHostPath: jest.fn(),
      },
    });
  });

  it('fetches all model/list pages and normalizes visible models', async () => {
    mockTransportRequest.mockImplementation(async (method: string, params: unknown) => {
      if (method === 'model/list' && (params as { cursor?: string }).cursor === 'page-2') {
        return {
          data: [
            {
              id: 'gpt-5.4-mini',
              model: 'gpt-5.4-mini',
              displayName: 'GPT-5.4-Mini',
              description: 'Small and fast.',
              hidden: false,
              isDefault: false,
              supportedReasoningEfforts: [],
              defaultReasoningEffort: 'medium',
              inputModalities: [],
              supportsPersonality: false,
              additionalSpeedTiers: [],
              serviceTiers: [],
              defaultServiceTier: null,
              upgrade: null,
              upgradeInfo: null,
              availabilityNux: null,
            },
          ],
          nextCursor: null,
        };
      }

      if (method === 'model/list') {
        return {
          data: [
            {
              id: 'gpt-5.5',
              model: 'gpt-5.5',
              displayName: 'GPT-5.5',
              description: 'Frontier model.',
              hidden: false,
              isDefault: true,
              supportedReasoningEfforts: [],
              defaultReasoningEffort: 'medium',
              inputModalities: [],
              supportsPersonality: false,
              additionalSpeedTiers: [],
              serviceTiers: [{ id: 'priority', name: 'Fast', description: 'Faster responses.' }],
              defaultServiceTier: null,
              upgrade: null,
              upgradeInfo: null,
              availabilityNux: null,
            },
            {
              id: 'hidden-model',
              model: 'hidden-model',
              displayName: 'Hidden',
              description: '',
              hidden: true,
              isDefault: false,
              supportedReasoningEfforts: [],
              defaultReasoningEffort: 'medium',
              inputModalities: [],
              supportsPersonality: false,
              additionalSpeedTiers: [],
              serviceTiers: [],
              defaultServiceTier: null,
              upgrade: null,
              upgradeInfo: null,
              availabilityNux: null,
            },
          ],
          nextCursor: 'page-2',
        };
      }

      throw new Error(`Unexpected request: ${method}`);
    });

    const service = new CodexModelListingService({
      settings: {},
      getResolvedProviderCliPath: jest.fn(),
      getActiveEnvironmentVariables: jest.fn(),
      app: {
        vault: {
          adapter: { basePath: '/repo' },
        },
      },
    } as any, { ttlMs: 0 });

    await expect(service.listModels({ forceReload: true })).resolves.toEqual([
      {
        id: 'gpt-5.5',
        label: 'GPT-5.5',
        description: 'Frontier model.',
        isDefault: true,
      },
      {
        id: 'gpt-5.4-mini',
        label: 'GPT-5.4-Mini',
        description: 'Small and fast.',
      },
    ]);
    expect(MockedProcessClass).toHaveBeenCalledWith(expect.objectContaining({
      command: 'codex',
      targetCwd: '/repo',
    }));
    expect(mockTransportRequest).toHaveBeenCalledWith('model/list', {
      includeHidden: false,
      limit: 100,
    });
    expect(mockTransportRequest).toHaveBeenCalledWith('model/list', {
      cursor: 'page-2',
      includeHidden: false,
      limit: 100,
    });
    expect(mockTransportDispose).toHaveBeenCalledTimes(1);
    expect(mockProcessShutdown).toHaveBeenCalledTimes(1);
  });

  it('keeps the app-server transport open until model/list resolves', async () => {
    let resolveModelList!: (value: unknown) => void;
    mockTransportRequest.mockImplementation((method: string) => {
      if (method === 'model/list') {
        return new Promise((resolve) => {
          resolveModelList = resolve;
        });
      }

      throw new Error(`Unexpected request: ${method}`);
    });
    const service = new CodexModelListingService({
      settings: {},
      getResolvedProviderCliPath: jest.fn(),
      getActiveEnvironmentVariables: jest.fn(),
      app: {
        vault: {
          adapter: { basePath: '/repo' },
        },
      },
    } as any, { ttlMs: 0 });

    const listPromise = service.listModels({ forceReload: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockTransportDispose).not.toHaveBeenCalled();

    resolveModelList({
      data: [
        {
          id: 'gpt-5.4',
          model: 'gpt-5.4',
          displayName: 'GPT-5.4',
          hidden: false,
        },
      ],
      nextCursor: null,
    });

    await expect(listPromise).resolves.toEqual([
      { id: 'gpt-5.4', label: 'GPT-5.4' },
    ]);
    expect(mockTransportDispose).toHaveBeenCalledTimes(1);
    expect(mockProcessShutdown).toHaveBeenCalledTimes(1);
  });

  it('reuses cached model results until the TTL expires', async () => {
    let currentTime = 1_000;
    const service = new CodexModelListingService({} as any, {
      ttlMs: 5_000,
      now: () => currentTime,
    });
    const fetchModels = jest.fn()
      .mockResolvedValueOnce([{ id: 'gpt-5.5', label: 'GPT-5.5' }])
      .mockResolvedValueOnce([{ id: 'gpt-5.4', label: 'gpt-5.4' }]);
    jest.spyOn(service as any, 'fetchModels').mockImplementation(fetchModels);

    await expect(service.listModels()).resolves.toEqual([{ id: 'gpt-5.5', label: 'GPT-5.5' }]);
    await expect(service.listModels()).resolves.toEqual([{ id: 'gpt-5.5', label: 'GPT-5.5' }]);
    expect(fetchModels).toHaveBeenCalledTimes(1);

    currentTime = 6_000;
    await expect(service.listModels()).resolves.toEqual([{ id: 'gpt-5.4', label: 'gpt-5.4' }]);
    expect(fetchModels).toHaveBeenCalledTimes(2);
  });
});
