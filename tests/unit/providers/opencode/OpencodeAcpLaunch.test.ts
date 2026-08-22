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

import { OpencodeChatRuntime } from '@/providers/opencode/runtime/OpencodeChatRuntime';
import { prepareOpencodeLaunchArtifacts } from '@/providers/opencode/runtime/OpencodeLaunchArtifacts';

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

jest.mock('@/providers/opencode/runtime/OpencodeLaunchArtifacts', () => {
  const actual = jest.requireActual('@/providers/opencode/runtime/OpencodeLaunchArtifacts');
  return {
    ...actual,
    prepareOpencodeLaunchArtifacts: jest.fn(),
  };
});

const MockAcpClientConnection = AcpClientConnection as jest.MockedClass<typeof AcpClientConnection>;
const MockAcpJsonRpcTransport = AcpJsonRpcTransport as jest.MockedClass<typeof AcpJsonRpcTransport>;
const MockAcpSubprocess = AcpSubprocess as jest.MockedClass<typeof AcpSubprocess>;
const mockPrepareOpencodeLaunchArtifacts = prepareOpencodeLaunchArtifacts as jest.MockedFunction<typeof prepareOpencodeLaunchArtifacts>;

describe('OpenCode ACP launch', () => {
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
    mockPrepareOpencodeLaunchArtifacts.mockResolvedValue({
      configPath: 'C:\\tmp\\grimoire-opencode\\config.json',
      configContent: '{}\n',
      databasePath: null,
      launchKey: 'launch-key',
      systemPromptPath: 'C:\\tmp\\grimoire-opencode\\system.md',
    });
  });

  it('does not pass the workspace path through OpenCode CLI arguments', async () => {
    const runtime = new OpencodeChatRuntime(createAcpLaunchMockPlugin({
      cliPath: 'C:\\Tools\\opencode.exe',
      providerId: 'opencode',
    }));

    await expect(runtime.ensureReady()).resolves.toBe(true);

    expect(MockAcpSubprocess).toHaveBeenCalledWith(expect.objectContaining({
      args: ['acp'],
      command: 'C:\\Tools\\opencode.exe',
      cwd: WINDOWS_UNICODE_VAULT,
    }));
    expect(mockConnection.newSession).toHaveBeenCalledWith({
      cwd: WINDOWS_UNICODE_VAULT,
      mcpServers: [],
    });
  });

  it('passes the managed config as OPENCODE_CONFIG_CONTENT and never OPENCODE_CONFIG', async () => {
    const plugin = createAcpLaunchMockPlugin({
      cliPath: 'C:\\Tools\\opencode.exe',
      providerId: 'opencode',
    });
    plugin.settings.providerConfigs.opencode.environmentVariables = 'OPENCODE_CONFIG=C:\\tmp\\user-opencode.json';

    const runtime = new OpencodeChatRuntime(plugin);
    await expect(runtime.ensureReady()).resolves.toBe(true);

    const launchEnv: NodeJS.ProcessEnv = MockAcpSubprocess.mock.calls[0][0].env;
    expect(launchEnv.OPENCODE_CONFIG_CONTENT).toBe('{}\n');
    expect(launchEnv.OPENCODE_CONFIG).toBeUndefined();
  });
});
