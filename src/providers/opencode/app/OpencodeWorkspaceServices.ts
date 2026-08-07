import { McpServerManager } from '../../../core/mcp/McpServerManager';
import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderModelCatalog,
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type GrimoirePlugin from '../../../main';
import { AcpMcpStorage } from '../../acp/mcp/AcpMcpStorage';
import { OpencodeAgentMentionProvider } from '../agents/OpencodeAgentMentionProvider';
import { OpencodeCommandCatalog } from '../commands/OpencodeCommandCatalog';
import { OpencodeChatRuntime } from '../runtime/OpencodeChatRuntime';
import { OpencodeCliResolver } from '../runtime/OpencodeCliResolver';
import { getOpencodeProviderSettings } from '../settings';
import { OpencodeAgentStorage } from '../storage/OpencodeAgentStorage';
import { opencodeSettingsTabRenderer } from '../ui/OpencodeSettingsTab';
import { opencodePlanUsageStore } from './OpencodePlanUsageStore';
import { OpencodeRuntimeCommandLoader } from './OpencodeRuntimeCommandLoader';

export interface OpencodeWorkspaceServices extends ProviderWorkspaceServices {
  agentStorage: OpencodeAgentStorage;
  agentMentionProvider: OpencodeAgentMentionProvider;
  commandCatalog: ProviderCommandCatalog;
  modelCatalog: ProviderModelCatalog;
  mcpStorage: AcpMcpStorage;
  mcpServerManager: McpServerManager;
}

const OPENCODE_METADATA_WARMUP_DB = ':memory:';

const opencodeTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

const MODEL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function createOpencodeModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const initialSettings = getOpencodeProviderSettings(plugin.settings ?? {});
  let lastRefreshAt = initialSettings.discoveredModels.length > 0 ? Date.now() : 0;
  let lastRefreshCacheKey = buildOpencodeModelCatalogCacheKey(initialSettings);

  return {
    isAvailable(settings) {
      return getOpencodeProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
      const currentSettings = getOpencodeProviderSettings(settings);
      const cacheKey = buildOpencodeModelCatalogCacheKey(currentSettings);
      if (currentSettings.discoveredModels.length > 0 && lastRefreshAt === 0) {
        lastRefreshAt = Date.now();
        lastRefreshCacheKey = cacheKey;
      }
      const cacheAgeMs = lastRefreshAt > 0 ? Date.now() - lastRefreshAt : Number.POSITIVE_INFINITY;
      if (
        currentSettings.discoveredModels.length > 0
        && cacheKey === lastRefreshCacheKey
        && cacheAgeMs < MODEL_CATALOG_CACHE_TTL_MS
      ) {
        plugin.recordDebugLog?.({
          data: {
            ageMs: cacheAgeMs,
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'opencode',
            reason: 'cache_fresh',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.opencode',
        });
        return false;
      }

      const before = JSON.stringify(currentSettings.discoveredModels);
      const runtime = new OpencodeChatRuntime(plugin);
      try {
        runtime.syncConversationState({
          providerState: { databasePath: OPENCODE_METADATA_WARMUP_DB },
          sessionId: null,
        });
        const loaded = await runtime.ensureReady({ allowSessionCreation: true });
        const updatedSettings = getOpencodeProviderSettings(settings);
        lastRefreshAt = Date.now();
        lastRefreshCacheKey = buildOpencodeModelCatalogCacheKey(updatedSettings);
        const after = JSON.stringify(getOpencodeProviderSettings(settings).discoveredModels);
        return loaded && before !== after;
      } finally {
        runtime.cleanup();
      }
    },
  };
}

function buildOpencodeModelCatalogCacheKey(settings: ReturnType<typeof getOpencodeProviderSettings>): string {
  return JSON.stringify({
    cliPath: settings.cliPath,
    cliPathsByHost: settings.cliPathsByHost,
    environmentHash: settings.environmentHash,
    environmentVariables: settings.environmentVariables,
  });
}

export async function createOpencodeWorkspaceServices(
  plugin: GrimoirePlugin,
  vaultAdapter: VaultFileAdapter,
): Promise<OpencodeWorkspaceServices> {
  const mcpStorage = new AcpMcpStorage(vaultAdapter, 'opencode');
  const mcpServerManager = new McpServerManager(mcpStorage);
  await mcpServerManager.loadServers();
  const agentStorage = new OpencodeAgentStorage(vaultAdapter);
  const agentMentionProvider = new OpencodeAgentMentionProvider(agentStorage);
  await agentMentionProvider.loadAgents();

  return {
    agentStorage,
    agentMentionProvider,
    commandCatalog: new OpencodeCommandCatalog(vaultAdapter),
    cliResolver: new OpencodeCliResolver(),
    modelCatalog: createOpencodeModelCatalog(plugin),
    mcpStorage,
    mcpServerManager,
    usageProvider: opencodePlanUsageStore,
    runtimeCommandLoader: new OpencodeRuntimeCommandLoader(),
    settingsTabRenderer: opencodeSettingsTabRenderer,
    tabWarmupPolicy: opencodeTabWarmupPolicy,
    refreshAgentMentions: async () => {
      await agentMentionProvider.loadAgents();
    },
  };
}

export const opencodeWorkspaceRegistration: ProviderWorkspaceRegistration<OpencodeWorkspaceServices> = {
  workspaceCapabilities: {
    skills: { inventory: 'managed', manager: 'managed' },
    commands: { inventory: 'readonly', manager: 'managed', runtimeCommandDiscovery: 'ephemeral' },
    agents: { inventory: 'managed', manager: 'managed' },
    mcp: { inventory: 'managed', manager: 'managed' },
    environment: { inventory: 'managed', manager: 'managed' },
  },
  initialize: async ({ plugin, vaultAdapter }) => createOpencodeWorkspaceServices(plugin, vaultAdapter),
};

export function maybeGetOpencodeWorkspaceServices(): OpencodeWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('opencode') as OpencodeWorkspaceServices | null;
}
