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
import { GeminiCommandCatalog } from '../commands/GeminiCommandCatalog';
import { GeminiChatRuntime } from '../runtime/GeminiChatRuntime';
import { GeminiCliResolver } from '../runtime/GeminiCliResolver';
import { getGeminiProviderSettings } from '../settings';
import { GeminiAgentStorage } from '../storage/GeminiAgentStorage';
import { geminiSettingsTabRenderer } from '../ui/GeminiSettingsTab';
import { geminiPlanUsageStore } from './GeminiPlanUsageStore';

export interface GeminiWorkspaceServices extends ProviderWorkspaceServices {
  agentStorage: GeminiAgentStorage;
  commandCatalog: ProviderCommandCatalog;
  cliResolver: ProviderCliResolver;
  modelCatalog: ProviderModelCatalog;
  mcpStorage: AcpMcpStorage;
  mcpServerManager: McpServerManager;
}

function createGeminiCliResolver(): ProviderCliResolver {
  return new GeminiCliResolver();
}

const geminiTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'runtime';
  },
};

const MODEL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function buildGeminiModelCatalogFingerprint(
  settings: ReturnType<typeof getGeminiProviderSettings>,
  cliPath: string,
  environmentVariables: string,
): string {
  return JSON.stringify({
    cliPath,
    cliPathsByHost: settings.cliPathsByHost,
    environmentVariables,
  });
}

function resolveGeminiModelCatalogFingerprint(
  plugin: GrimoirePlugin,
  settings: ReturnType<typeof getGeminiProviderSettings>,
): string {
  return buildGeminiModelCatalogFingerprint(
    settings,
    plugin.getResolvedProviderCliPath?.('gemini') ?? settings.cliPath,
    plugin.getActiveEnvironmentVariables?.('gemini') ?? settings.environmentVariables,
  );
}

function createGeminiModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const initialSettings = getGeminiProviderSettings(plugin.settings ?? {});
  const refreshCache = new ProviderModelCatalogRefreshCache(MODEL_CATALOG_CACHE_TTL_MS);
  if (initialSettings.discoveredModels.length > 0) {
    // The resolved CLI path is part of the fingerprint but is not available
    // here: this catalog is built inside createGeminiWorkspaceServices, which runs
    // inside ProviderWorkspaceRegistry.initialize(), and the registry assigns
    // this.services[providerId] only after that resolves - until then
    // getResolvedProviderCliPath returns null and an eager seed would be filed
    // under settings.cliPath while every later refresh looks it up under the
    // resolved path. Hold the seed back until the path is known.
    const initialEnvironmentVariables = plugin.getActiveEnvironmentVariables?.('gemini')
      ?? initialSettings.environmentVariables;
    if (plugin.getResolvedProviderCliPath?.('gemini') == null) {
      refreshCache.seedOnFirstRefresh(() => buildGeminiModelCatalogFingerprint(
        initialSettings,
        plugin.getResolvedProviderCliPath?.('gemini') ?? initialSettings.cliPath,
        initialEnvironmentVariables,
      ));
    } else {
      refreshCache.seed(resolveGeminiModelCatalogFingerprint(plugin, initialSettings));
    }
  }

  return {
    isAvailable(settings) {
      return getGeminiProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
      // Discovery boots the real CLI over ACP and creates a session, so it must
      // not run again for every model dropdown that opens.
      const currentSettings = getGeminiProviderSettings(settings);
      const fingerprint = resolveGeminiModelCatalogFingerprint(plugin, currentSettings);
      const hasCachedModels = currentSettings.discoveredModels.length > 0;
      if (refreshCache.applyDeferredSeed(fingerprint, hasCachedModels)) {
        plugin.recordDebugLog?.({
          data: {
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'gemini',
            reason: 'seeded_on_first_use',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.gemini',
        });
        return false;
      }

      if (refreshCache.isFresh(fingerprint, hasCachedModels)) {
        plugin.recordDebugLog?.({
          data: {
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'gemini',
            reason: 'cache_fresh',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.gemini',
        });
        return false;
      }

      return refreshCache.refresh({
        fingerprint,
        hasCachedModels,
        load: async () => {
          const before = JSON.stringify(getGeminiProviderSettings(settings).discoveredModels);
          const runtime = new GeminiChatRuntime(plugin);
          try {
            const loaded = await runtime.ensureReady({ allowSessionCreation: true });
            const after = JSON.stringify(getGeminiProviderSettings(settings).discoveredModels);
            return loaded && before !== after;
          } finally {
            runtime.cleanup();
          }
        },
      });
    },
  };
}

export async function createGeminiWorkspaceServices(
  plugin: GrimoirePlugin,
  vaultAdapter: VaultFileAdapter,
): Promise<GeminiWorkspaceServices> {
  const mcpStorage = new AcpMcpStorage(vaultAdapter, 'gemini');
  const mcpServerManager = new McpServerManager(mcpStorage);
  await mcpServerManager.loadServers();
  const agentStorage = new GeminiAgentStorage(vaultAdapter);
  return {
    agentStorage,
    commandCatalog: new GeminiCommandCatalog(vaultAdapter),
    cliResolver: createGeminiCliResolver(),
    modelCatalog: createGeminiModelCatalog(plugin),
    mcpStorage,
    mcpServerManager,
    usageProvider: geminiPlanUsageStore,
    settingsTabRenderer: geminiSettingsTabRenderer,
    tabWarmupPolicy: geminiTabWarmupPolicy,
  };
}

export const geminiWorkspaceRegistration: ProviderWorkspaceRegistration<GeminiWorkspaceServices> = {
  workspaceCapabilities: {
    skills: { inventory: 'managed', manager: 'managed' },
    commands: { inventory: 'managed', manager: 'managed', runtimeCommandDiscovery: 'none' },
    agents: { inventory: 'managed', manager: 'managed' },
    mcp: { inventory: 'managed', manager: 'managed' },
    environment: { inventory: 'managed', manager: 'managed' },
  },
  initialize: async ({ plugin, vaultAdapter }) => createGeminiWorkspaceServices(plugin, vaultAdapter),
};

export function maybeGetGeminiWorkspaceServices(): GeminiWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('gemini') as GeminiWorkspaceServices | null;
}
