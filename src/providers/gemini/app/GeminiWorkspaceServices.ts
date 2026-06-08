import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderCliResolver,
  ProviderModelCatalog,
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import type GrimoirePlugin from '../../../main';
import { GeminiChatRuntime } from '../runtime/GeminiChatRuntime';
import { GeminiCliResolver } from '../runtime/GeminiCliResolver';
import { getGeminiProviderSettings } from '../settings';
import { geminiSettingsTabRenderer } from '../ui/GeminiSettingsTab';
import { geminiPlanUsageStore } from './GeminiPlanUsageStore';

export interface GeminiWorkspaceServices extends ProviderWorkspaceServices {
  cliResolver: ProviderCliResolver;
  modelCatalog: ProviderModelCatalog;
}

function createGeminiCliResolver(): ProviderCliResolver {
  return new GeminiCliResolver();
}

const geminiTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'runtime';
  },
};

function createGeminiModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  return {
    isAvailable(settings) {
      return getGeminiProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
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
  };
}

export async function createGeminiWorkspaceServices(plugin: GrimoirePlugin): Promise<GeminiWorkspaceServices> {
  return {
    cliResolver: createGeminiCliResolver(),
    modelCatalog: createGeminiModelCatalog(plugin),
    usageProvider: geminiPlanUsageStore,
    settingsTabRenderer: geminiSettingsTabRenderer,
    tabWarmupPolicy: geminiTabWarmupPolicy,
  };
}

export const geminiWorkspaceRegistration: ProviderWorkspaceRegistration<GeminiWorkspaceServices> = {
  initialize: async ({ plugin }) => createGeminiWorkspaceServices(plugin),
};

export function maybeGetGeminiWorkspaceServices(): GeminiWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('gemini') as GeminiWorkspaceServices | null;
}
