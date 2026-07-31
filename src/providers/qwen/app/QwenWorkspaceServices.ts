import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderCliResolver,
  ProviderModelCatalog,
  ProviderTabWarmupPolicy,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import type GrimoirePlugin from '../../../main';
import { QwenChatRuntime } from '../runtime/QwenChatRuntime';
import { QwenCliResolver } from '../runtime/QwenCliResolver';
import { getQwenProviderSettings } from '../settings';
import { qwenSettingsTabRenderer } from '../ui/QwenSettingsTab';
import { qwenPlanUsageStore } from './QwenPlanUsageStore';

export interface QwenWorkspaceServices extends ProviderWorkspaceServices {
  cliResolver: ProviderCliResolver;
  modelCatalog: ProviderModelCatalog;
}

function createQwenCliResolver(): ProviderCliResolver {
  return new QwenCliResolver();
}

const qwenTabWarmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode() {
    return 'runtime';
  },
};

function createQwenModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  return {
    isAvailable(settings) {
      return getQwenProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
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
  };
}

export async function createQwenWorkspaceServices(plugin: GrimoirePlugin): Promise<QwenWorkspaceServices> {
  return {
    cliResolver: createQwenCliResolver(),
    modelCatalog: createQwenModelCatalog(plugin),
    usageProvider: qwenPlanUsageStore,
    settingsTabRenderer: qwenSettingsTabRenderer,
    tabWarmupPolicy: qwenTabWarmupPolicy,
  };
}

export const qwenWorkspaceRegistration: ProviderWorkspaceRegistration<QwenWorkspaceServices> = {
  initialize: async ({ plugin }) => createQwenWorkspaceServices(plugin),
};

export function maybeGetQwenWorkspaceServices(): QwenWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('qwen') as QwenWorkspaceServices | null;
}
