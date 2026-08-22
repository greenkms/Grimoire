import '@/providers';

import {
  type AcpLaunchMockConnection,
  type AcpLaunchMockProcess,
  type AcpLaunchMockTransport,
  createAcpLaunchMockPlugin,
  createAcpMockConnection,
  createAcpMockProcess,
  createAcpMockTransport,
  WINDOWS_UNICODE_VAULT,
  wireAcpMocks,
} from '@test/helpers/acpLaunchMocks';

import { MimocodeChatRuntime } from '@/providers/mimocode/runtime/MimocodeChatRuntime';
import { prepareMimocodeLaunchArtifacts } from '@/providers/mimocode/runtime/MimocodeLaunchArtifacts';

import { AcpClientConnection, AcpJsonRpcTransport, AcpSubprocess } from '../../../../src/providers/acp';

jest.mock('../../../../src/providers/acp', () => {
  const actual = jest.requireActual('../../../../src/providers/acp');
  return {
    ...actual,
    AcpClientConnection: jest.fn(),
    AcpJsonRpcTransport: jest.fn(),
    AcpSubprocess: jest.fn(),
  };
});

jest.mock('@/providers/mimocode/runtime/MimocodeLaunchArtifacts', () => {
  const actual = jest.requireActual('@/providers/mimocode/runtime/MimocodeLaunchArtifacts');
  return {
    ...actual,
    prepareMimocodeLaunchArtifacts: jest.fn(),
  };
});

const MockAcpClientConnection = AcpClientConnection as jest.MockedClass<typeof AcpClientConnection>;
const MockAcpJsonRpcTransport = AcpJsonRpcTransport as jest.MockedClass<typeof AcpJsonRpcTransport>;
const MockAcpSubprocess = AcpSubprocess as jest.MockedClass<typeof AcpSubprocess>;
const mockPrepareMimocodeLaunchArtifacts = prepareMimocodeLaunchArtifacts as jest.MockedFunction<typeof prepareMimocodeLaunchArtifacts>;

describe('MiMoCode ACP launch', () => {
  let mockConnection: AcpLaunchMockConnection;
  let mockProcess: AcpLaunchMockProcess;
  let mockTransport: AcpLaunchMockTransport;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createAcpMockConnection();
    mockProcess = createAcpMockProcess();
    mockTransport = createAcpMockTransport();

    wireAcpMocks({
      connection: mockConnection,
      connectionCtor: MockAcpClientConnection,
      process: mockProcess,
      subprocessCtor: MockAcpSubprocess,
      transport: mockTransport,
      transportCtor: MockAcpJsonRpcTransport,
    });
    mockPrepareMimocodeLaunchArtifacts.mockResolvedValue({
      configPath: 'C:\\tmp\\grimoire-mimocode\\config.json',
      configContent: '{}\n',
      databasePath: null,
      launchKey: 'launch-key',
      systemPromptPath: 'C:\\tmp\\grimoire-mimocode\\system.md',
    });
  });

  it('does not pass the workspace path through MiMoCode CLI arguments', async () => {
    const runtime = new MimocodeChatRuntime(createAcpLaunchMockPlugin({
      cliPath: 'C:\\Tools\\mimo.exe',
      providerId: 'mimocode',
    }));

    await expect(runtime.ensureReady()).resolves.toBe(true);

    expect(MockAcpSubprocess).toHaveBeenCalledWith(expect.objectContaining({
      args: ['acp'],
      command: 'C:\\Tools\\mimo.exe',
      cwd: WINDOWS_UNICODE_VAULT,
    }));
    expect(mockConnection.newSession).toHaveBeenCalledWith({
      cwd: WINDOWS_UNICODE_VAULT,
      mcpServers: [],
    });
  });

  it('passes the managed config as MIMOCODE_CONFIG_CONTENT and never MIMOCODE_CONFIG', async () => {
    const plugin = createAcpLaunchMockPlugin({
      cliPath: 'C:\\Tools\\mimo.exe',
      providerId: 'mimocode',
    });
    plugin.settings.providerConfigs.mimocode.environmentVariables = 'MIMOCODE_CONFIG=C:\\tmp\\user-mimocode.json';

    const runtime = new MimocodeChatRuntime(plugin);
    await expect(runtime.ensureReady()).resolves.toBe(true);

    const launchEnv: NodeJS.ProcessEnv = MockAcpSubprocess.mock.calls[0][0].env;
    expect(launchEnv.MIMOCODE_CONFIG_CONTENT).toBe('{}\n');
    expect(launchEnv.MIMOCODE_CONFIG).toBeUndefined();
  });
});
