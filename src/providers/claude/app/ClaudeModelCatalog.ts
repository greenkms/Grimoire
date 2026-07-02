import { requestUrl } from 'obsidian';

import type { ProviderModelCatalog } from '../../../core/providers/types';
import type GrimoirePlugin from '../../../main';
import {
  type ClaudeDiscoveredModel,
  getClaudeEffectiveEnvironmentVariables,
  getClaudeProviderSettings,
  normalizeClaudeDiscoveredModels,
  updateClaudeProviderSettings,
} from '../settings';

const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MODEL_CATALOG_LIMIT = 1000;
const MODEL_CATALOG_MAX_PAGES = 10;

interface ClaudeModelsApiResponse {
  data?: unknown;
  has_more?: unknown;
  last_id?: unknown;
}

function normalizeAnthropicBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, '') || ANTHROPIC_DEFAULT_BASE_URL;
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function buildModelsApiUrl(baseUrl: string, afterId?: string): string {
  const params = new URLSearchParams({ limit: String(MODEL_CATALOG_LIMIT) });
  if (afterId) {
    params.set('after_id', afterId);
  }
  return `${baseUrl}/models?${params.toString()}`;
}

function toClaudeDiscoveredModels(value: unknown): ClaudeDiscoveredModel[] {
  return normalizeClaudeDiscoveredModels(value);
}

async function fetchClaudeModelsFromAnthropicApi(
  envVars: Record<string, string>,
): Promise<ClaudeDiscoveredModel[]> {
  const apiKey = envVars.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const baseUrl = normalizeAnthropicBaseUrl(envVars.ANTHROPIC_BASE_URL);
  const models: ClaudeDiscoveredModel[] = [];
  const seen = new Set<string>();
  let afterId: string | undefined;

  for (let page = 0; page < MODEL_CATALOG_MAX_PAGES; page += 1) {
    const response = await requestUrl({
      url: buildModelsApiUrl(baseUrl, afterId),
      method: 'GET',
      headers: {
        'anthropic-version': ANTHROPIC_API_VERSION,
        'x-api-key': apiKey,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Claude Models API request failed with HTTP ${response.status}`);
    }

    const payload = response.json as ClaudeModelsApiResponse;
    for (const model of toClaudeDiscoveredModels(payload.data)) {
      if (seen.has(model.id)) {
        continue;
      }

      seen.add(model.id);
      models.push(model);
    }

    if (payload.has_more !== true || typeof payload.last_id !== 'string' || !payload.last_id) {
      break;
    }

    afterId = payload.last_id;
  }

  return models;
}

function buildClaudeModelCatalogCacheKey(settings: ReturnType<typeof getClaudeProviderSettings>): string {
  return JSON.stringify({
    environmentHash: settings.environmentHash,
    environmentVariables: settings.environmentVariables,
    projectSettingsEnvHash: settings.projectSettingsSnapshot.hash,
    respectProjectSettings: settings.respectProjectSettings,
  });
}

export function createClaudeModelCatalog(plugin: GrimoirePlugin): ProviderModelCatalog {
  const initialSettings = getClaudeProviderSettings(plugin.settings ?? {});
  let lastRefreshAt = initialSettings.discoveredModels.length > 0 ? Date.now() : 0;
  let lastRefreshCacheKey = buildClaudeModelCatalogCacheKey(initialSettings);

  return {
    isAvailable(settings) {
      return getClaudeProviderSettings(settings).enabled;
    },
    async refreshModels({ settings }) {
      const currentSettings = getClaudeProviderSettings(settings);
      const cacheKey = buildClaudeModelCatalogCacheKey(currentSettings);
      if (currentSettings.discoveredModels.length > 0 && lastRefreshAt === 0) {
        lastRefreshAt = Date.now();
        lastRefreshCacheKey = cacheKey;
      }

      const cacheAgeMs = lastRefreshAt > 0 ? Date.now() - lastRefreshAt : Number.POSITIVE_INFINITY;
      if (
        currentSettings.discoveredModels.length > 0
        && cacheKey === lastRefreshCacheKey
        && cacheAgeMs < 10 * 60 * 1000
      ) {
        plugin.recordDebugLog?.({
          data: {
            ageMs: cacheAgeMs,
            modelCount: currentSettings.discoveredModels.length,
            providerId: 'claude',
            reason: 'cache_fresh',
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.claude',
        });
        return false;
      }

      const envVars = getClaudeEffectiveEnvironmentVariables(settings);
      if (!envVars.ANTHROPIC_API_KEY?.trim()) {
        plugin.recordDebugLog?.({
          data: {
            providerId: 'claude',
            reason: 'missing_anthropic_api_key',
          },
          event: 'modelCatalog.refresh.skipped',
          level: 'debug',
          scope: 'provider.claude',
        });
        return false;
      }

      const before = JSON.stringify(currentSettings.discoveredModels);
      try {
        const discoveredModels = await fetchClaudeModelsFromAnthropicApi(envVars);
        if (discoveredModels.length === 0) {
          return false;
        }

        updateClaudeProviderSettings(settings, { discoveredModels });
        await plugin.saveSettings?.();

        const updatedSettings = getClaudeProviderSettings(settings);
        lastRefreshAt = Date.now();
        lastRefreshCacheKey = buildClaudeModelCatalogCacheKey(updatedSettings);
        const changed = before !== JSON.stringify(updatedSettings.discoveredModels);
        plugin.recordDebugLog?.({
          data: {
            changed,
            modelCount: updatedSettings.discoveredModels.length,
            providerId: 'claude',
          },
          event: changed ? 'modelCatalog.refresh.succeeded' : 'modelCatalog.refresh.empty',
          level: changed ? 'info' : 'debug',
          scope: 'provider.claude',
        });
        return changed;
      } catch (error) {
        plugin.recordDebugLog?.({
          data: {
            message: error instanceof Error ? error.message : String(error),
            providerId: 'claude',
          },
          event: 'modelCatalog.refresh.failed',
          level: 'warn',
          scope: 'provider.claude',
        });
        return false;
      }
    },
  };
}
