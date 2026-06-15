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
import { KimicodeAgentMentionProvider } from '../agents/KimicodeAgentMentionProvider';
import { KimicodeCommandCatalog } from '../commands/KimicodeCommandCatalog';
import { KimicodeChatRuntime } from '../runtime/KimicodeChatRuntime';
import { KimicodeCliResolver } from '../runtime/KimicodeCliResolver';
import { getKimicodeProviderSettings } from '../settings';
import { KimicodeAgentStorage } from '../storage/KimicodeAgentStorage';
import { kimicodeSettingsTabRenderer } from '../ui/KimicodeSettingsTab';
import { kimicodePlanUsageStore } from './KimicodePlanUsageStore';
import { KimicodeRuntimeCommandLoader } from './KimicodeRuntimeCommandLoader';

export interface KimicodeWorkspaceServices extends ProviderWorkspaceServices {
  agentStorage: KimicodeAgentStorage;
  agentMentionProvider: KimicodeAgentMentionProvider;
  commandCatalog: ProviderCommandCatalog;
  modelCatalog: ProviderModelCatalog;
}

const KIMICODE_METADATA_WARMUP_DB = ':memory:';

const kimicodeTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'commands';
  },
};

const MODEL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function createKimicodeModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const initialSettings = getKimicodeProviderSettings(plugin.settings ?? {});
  let lastRefreshAt = initialSettings.discoveredModels.length > 0 ? Date.now() : 0;
  let lastRefreshCacheKey = buildKimicodeModelCatalogCacheKey(initialSettings);

  return {
    isAvailable(settings) {
      return getKimicodeProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
      const currentSettings = getKimicodeProviderSettings(settings);
      const cacheKey = buildKimicodeModelCatalogCacheKey(currentSettings);
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
            providerId: 'kimicode',
            reason: 'cache_fresh',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.kimicode',
        });
        return false;
      }

      const before = JSON.stringify(currentSettings.discoveredModels);
      const runtime = new KimicodeChatRuntime(plugin);
      try {
        runtime.syncConversationState({
          providerState: { databasePath: KIMICODE_METADATA_WARMUP_DB },
          sessionId: null,
        });
        const loaded = await runtime.ensureReady({ allowSessionCreation: true });
        const updatedSettings = getKimicodeProviderSettings(settings);
        lastRefreshAt = Date.now();
        lastRefreshCacheKey = buildKimicodeModelCatalogCacheKey(updatedSettings);
        const after = JSON.stringify(getKimicodeProviderSettings(settings).discoveredModels);
        return loaded && before !== after;
      } finally {
        runtime.cleanup();
      }
    },
  };
}

function buildKimicodeModelCatalogCacheKey(settings: ReturnType<typeof getKimicodeProviderSettings>): string {
  return JSON.stringify({
    cliPath: settings.cliPath,
    cliPathsByHost: settings.cliPathsByHost,
    environmentHash: settings.environmentHash,
    environmentVariables: settings.environmentVariables,
  });
}

export async function createKimicodeWorkspaceServices(
  plugin: GrimoirePlugin,
  vaultAdapter: VaultFileAdapter,
): Promise<KimicodeWorkspaceServices> {
  const agentStorage = new KimicodeAgentStorage(vaultAdapter);
  const agentMentionProvider = new KimicodeAgentMentionProvider(agentStorage);
  await agentMentionProvider.loadAgents();

  return {
    agentStorage,
    agentMentionProvider,
    commandCatalog: new KimicodeCommandCatalog(),
    cliResolver: new KimicodeCliResolver(),
    modelCatalog: createKimicodeModelCatalog(plugin),
    usageProvider: kimicodePlanUsageStore,
    runtimeCommandLoader: new KimicodeRuntimeCommandLoader(),
    settingsTabRenderer: kimicodeSettingsTabRenderer,
    tabWarmupPolicy: kimicodeTabWarmupPolicy,
    refreshAgentMentions: async () => {
      await agentMentionProvider.loadAgents();
    },
  };
}

export const kimicodeWorkspaceRegistration: ProviderWorkspaceRegistration<KimicodeWorkspaceServices> = {
  initialize: async ({ plugin, vaultAdapter }) => createKimicodeWorkspaceServices(plugin, vaultAdapter),
};

export function maybeGetKimicodeWorkspaceServices(): KimicodeWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('kimicode') as KimicodeWorkspaceServices | null;
}
