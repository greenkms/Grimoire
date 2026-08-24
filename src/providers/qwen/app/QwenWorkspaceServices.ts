import { McpServerManager } from '../../../core/mcp/McpServerManager';
import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderModelCatalogRefreshCache } from '../../../core/providers/ProviderModelCatalogRefreshCache';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderCliResolver,
  ProviderModelCatalog,
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type GrimoirePlugin from '../../../main';
import { AcpMcpStorage } from '../../acp/mcp/AcpMcpStorage';
import { QwenCommandCatalog } from '../commands/QwenCommandCatalog';
import { QwenChatRuntime } from '../runtime/QwenChatRuntime';
import { QwenCliResolver } from '../runtime/QwenCliResolver';
import { getQwenProviderSettings } from '../settings';
import { QwenAgentStorage } from '../storage/QwenAgentStorage';
import { qwenSettingsTabRenderer } from '../ui/QwenSettingsTab';
import { qwenPlanUsageStore } from './QwenPlanUsageStore';

export interface QwenWorkspaceServices extends ProviderWorkspaceServices {
  agentStorage: QwenAgentStorage;
  commandCatalog: ProviderCommandCatalog;
  cliResolver: ProviderCliResolver;
  modelCatalog: ProviderModelCatalog;
  mcpStorage: AcpMcpStorage;
  mcpServerManager: McpServerManager;
}

function createQwenCliResolver(): ProviderCliResolver {
  return new QwenCliResolver();
}

const qwenTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'runtime';
  },
};

const MODEL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function buildQwenModelCatalogFingerprint(
  plugin: GrimoirePlugin,
  settings: ReturnType<typeof getQwenProviderSettings>,
): string {
  return JSON.stringify({
    cliPath: plugin.getResolvedProviderCliPath?.('qwen') ?? settings.cliPath,
    cliPathsByHost: settings.cliPathsByHost,
    environmentVariables: plugin.getActiveEnvironmentVariables?.('qwen')
      ?? settings.environmentVariables,
  });
}

function createQwenModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const initialSettings = getQwenProviderSettings(plugin.settings ?? {});
  const refreshCache = new ProviderModelCatalogRefreshCache(MODEL_CATALOG_CACHE_TTL_MS);
  if (initialSettings.discoveredModels.length > 0) {
    refreshCache.seed(buildQwenModelCatalogFingerprint(plugin, initialSettings));
  }

  return {
    isAvailable(settings) {
      return getQwenProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
      // Discovery boots the real CLI over ACP and creates a session, so it must
      // not run again for every model dropdown that opens.
      const currentSettings = getQwenProviderSettings(settings);
      const fingerprint = buildQwenModelCatalogFingerprint(plugin, currentSettings);
      const hasCachedModels = currentSettings.discoveredModels.length > 0;
      if (refreshCache.isFresh(fingerprint, hasCachedModels)) {
        plugin.recordDebugLog?.({
          data: {
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'qwen',
            reason: 'cache_fresh',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.qwen',
        });
        return false;
      }

      return refreshCache.refresh({
        fingerprint,
        hasCachedModels,
        load: async () => {
          const before = JSON.stringify(getQwenProviderSettings(settings).discoveredModels);
          const runtime = new QwenChatRuntime(plugin);
          try {
            const loaded = await runtime.ensureReady({ allowSessionCreation: true });
            const after = JSON.stringify(getQwenProviderSettings(settings).discoveredModels);
            return loaded && before !== after;
          } finally {
            runtime.cleanup();
          }
        },
      });
    },
  };
}

export async function createQwenWorkspaceServices(
  plugin: GrimoirePlugin,
  vaultAdapter: VaultFileAdapter,
): Promise<QwenWorkspaceServices> {
  const mcpStorage = new AcpMcpStorage(vaultAdapter, 'qwen');
  const mcpServerManager = new McpServerManager(mcpStorage);
  await mcpServerManager.loadServers();
  const agentStorage = new QwenAgentStorage(vaultAdapter);
  return {
    agentStorage,
    commandCatalog: new QwenCommandCatalog(vaultAdapter),
    cliResolver: createQwenCliResolver(),
    modelCatalog: createQwenModelCatalog(plugin),
    mcpStorage,
    mcpServerManager,
    usageProvider: qwenPlanUsageStore,
    settingsTabRenderer: qwenSettingsTabRenderer,
    tabWarmupPolicy: qwenTabWarmupPolicy,
  };
}

export const qwenWorkspaceRegistration: ProviderWorkspaceRegistration<QwenWorkspaceServices> = {
  workspaceCapabilities: {
    skills: { inventory: 'managed', manager: 'managed' },
    commands: { inventory: 'managed', manager: 'managed', runtimeCommandDiscovery: 'active-session-only' },
    agents: { inventory: 'managed', manager: 'managed' },
    mcp: { inventory: 'managed', manager: 'managed' },
    environment: { inventory: 'managed', manager: 'managed' },
  },
  initialize: async ({ plugin, vaultAdapter }) => createQwenWorkspaceServices(plugin, vaultAdapter),
};

export function maybeGetQwenWorkspaceServices(): QwenWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('qwen') as QwenWorkspaceServices | null;
}
