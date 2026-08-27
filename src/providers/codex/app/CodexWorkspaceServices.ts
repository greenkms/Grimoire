import { hashCatalogFingerprint } from '../../../core/providers/catalogFingerprint';
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
import type { HomeFileAdapter } from '../../../core/storage/HomeFileAdapter';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type GrimoirePlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { CodexAgentMentionProvider } from '../agents/CodexAgentMentionProvider';
import { CodexSkillCatalog } from '../commands/CodexSkillCatalog';
import {
  buildCodexModelCatalogFingerprint,
  resolveCodexModelCatalogFingerprint,
} from '../modelCatalogFingerprint';
import { updateCodexModelDiscoveryState } from '../modelDiscoveryState';
import { CodexCliResolver } from '../runtime/CodexCliResolver';
import { CodexModelListingService } from '../runtime/CodexModelListingService';
import { getCodexProviderSettings } from '../settings';
import { CodexSkillListingService } from '../skills/CodexSkillListingService';
import { CodexSkillStorage } from '../storage/CodexSkillStorage';
import { CodexSubagentStorage } from '../storage/CodexSubagentStorage';
import { codexSettingsTabRenderer } from '../ui/CodexSettingsTab';
import { codexPlanUsageStore } from './CodexPlanUsageStore';

export interface CodexWorkspaceServices extends ProviderWorkspaceServices {
  subagentStorage: CodexSubagentStorage;
  commandCatalog: ProviderCommandCatalog;
  agentMentionProvider: CodexAgentMentionProvider;
  cliResolver: ProviderCliResolver;
  modelCatalog: ProviderModelCatalog;
}

function createCodexCliResolver(): ProviderCliResolver {
  return new CodexCliResolver();
}

const codexTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'runtime';
  },
};

const MODEL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function createCodexModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const modelListingService = new CodexModelListingService(plugin);
  const initialSettings = getCodexProviderSettings(plugin.settings ?? {});
  const refreshCache = new ProviderModelCatalogRefreshCache(MODEL_CATALOG_CACHE_TTL_MS);
  if (initialSettings.discoveredModels.length > 0) {
    // The resolved CLI path is part of the fingerprint but is not available
    // here: this catalog is built inside createCodexWorkspaceServices, which runs
    // inside ProviderWorkspaceRegistry.initialize(), and the registry assigns
    // this.services[providerId] only after that resolves - until then
    // getResolvedProviderCliPath returns null and an eager seed would be filed
    // under settings.cliPath while every later refresh looks it up under the
    // resolved path. Hold the seed back until the path is known.
    const initialEnvironmentVariables = plugin.getActiveEnvironmentVariables?.('codex')
      ?? initialSettings.environmentVariables;
    if (plugin.getResolvedProviderCliPath?.('codex') == null) {
      refreshCache.seedOnFirstRefresh(() => buildCodexModelCatalogFingerprint(
        initialSettings,
        plugin.getResolvedProviderCliPath?.('codex') ?? initialSettings.cliPath,
        initialEnvironmentVariables,
      ));
    } else {
      refreshCache.seed(
        resolveCodexModelCatalogFingerprint(plugin, initialSettings),
        initialSettings.discoveredModelsFingerprint,
      );
    }
  }
  return {
    isAvailable(settings) {
      return getCodexProviderSettings(settings).enabled;
    },
    async refreshModels({ force, settings }) {
      const currentSettings = getCodexProviderSettings(settings);
      const fingerprint = resolveCodexModelCatalogFingerprint(plugin, currentSettings);
      const appliedDeferredSeed = refreshCache.applyDeferredSeed(
        fingerprint,
        currentSettings.discoveredModels.length > 0,
        currentSettings.discoveredModelsFingerprint,
      );
      if (appliedDeferredSeed && !force) {
        plugin.recordDebugLog?.({
          data: {
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'codex',
            reason: 'seeded_on_first_use',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.codex',
        });
        return false;
      }

      if (!force && refreshCache.isFresh(fingerprint, currentSettings.discoveredModels.length > 0)) {
        plugin.recordDebugLog?.({
          data: {
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'codex',
            reason: 'cache_fresh',
            ttlMs: MODEL_CATALOG_CACHE_TTL_MS,
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.codex',
        });
        return false;
      }

      return refreshCache.refresh({
        fingerprint,
        force,
        hasCachedModels: currentSettings.discoveredModels.length > 0,
        load: async () => {
      plugin.recordDebugLog?.({
        data: { providerId: 'codex' },
        event: 'modelCatalog.refresh.started',
        level: 'debug',
        scope: 'provider.codex',
      });

      try {
        modelListingService.invalidate();
        const models = await modelListingService.listModels();
        if (models.length === 0) {
          plugin.recordDebugLog?.({
            data: { providerId: 'codex' },
            event: 'modelCatalog.refresh.empty',
            level: 'debug',
            scope: 'provider.codex',
          });
          return false;
        }

        const changed = updateCodexModelDiscoveryState(settings, {
          discoveredModels: models,
          discoveredModelsFingerprint: hashCatalogFingerprint(fingerprint),
        });
        if (changed) {
          await plugin.saveSettings?.();
        }
        plugin.recordDebugLog?.({
          data: {
            changed,
            modelCount: models.length,
            providerId: 'codex',
          },
          event: 'modelCatalog.refresh.succeeded',
          level: 'info',
          scope: 'provider.codex',
        });
        return changed;
      } catch (error) {
        plugin.recordDebugLog?.({
          data: {
            message: error instanceof Error ? error.message : String(error),
            providerId: 'codex',
          },
          error,
          event: 'modelCatalog.refresh.failed',
          level: 'warn',
          scope: 'provider.codex',
        });
        throw error;
      }
        },
      });
    },
  };
}

export async function createCodexWorkspaceServices(
  plugin: GrimoirePlugin,
  vaultAdapter: VaultFileAdapter,
  homeAdapter: HomeFileAdapter,
): Promise<CodexWorkspaceServices> {
  const subagentStorage = new CodexSubagentStorage(vaultAdapter);
  const agentMentionProvider = new CodexAgentMentionProvider(subagentStorage);
  await agentMentionProvider.loadAgents();

  const skillListProvider = new CodexSkillListingService(plugin);
  const commandCatalog = new CodexSkillCatalog(
    new CodexSkillStorage(
      vaultAdapter,
      homeAdapter,
    ),
    skillListProvider,
    getVaultPath(plugin.app),
  );

  return {
    subagentStorage,
    commandCatalog,
    agentMentionProvider,
    cliResolver: createCodexCliResolver(),
    modelCatalog: createCodexModelCatalog(plugin),
    usageProvider: codexPlanUsageStore,
    settingsTabRenderer: codexSettingsTabRenderer,
    tabWarmupPolicy: codexTabWarmupPolicy,
    refreshAgentMentions: async () => {
      await agentMentionProvider.loadAgents();
    },
  };
}

export const codexWorkspaceRegistration: ProviderWorkspaceRegistration<CodexWorkspaceServices> = {
  workspaceCapabilities: {
    skills: { inventory: 'managed', manager: 'managed' },
    commands: { inventory: 'none', manager: 'none' },
    agents: { inventory: 'managed', manager: 'managed' },
    mcp: { inventory: 'none', manager: 'guidance' },
    environment: { inventory: 'managed', manager: 'managed' },
  },
  initialize: async ({ plugin, vaultAdapter, homeAdapter }) => createCodexWorkspaceServices(
    plugin,
    vaultAdapter,
    homeAdapter,
  ),
};

export function maybeGetCodexWorkspaceServices(): CodexWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('codex') as CodexWorkspaceServices | null;
}

export function getCodexWorkspaceServices(): CodexWorkspaceServices {
  return ProviderWorkspaceRegistry.requireServices('codex') as CodexWorkspaceServices;
}
