import type { SlashCommand } from '../../../core/types';
import type GrimoirePlugin from '../../../main';
import { getClaudeCliBinaryFingerprint } from '../cli/claudeCliBinaryFingerprint';
import {
  type ClaudeProviderSettings,
  getClaudeProviderSettings,
  normalizeClaudeDiscoveredCommands,
  updateClaudeProviderSettings,
} from '../settings';

export interface RuntimeCommandCacheRecord {
  fingerprint: string;
  commands: SlashCommand[];
}

/**
 * The catalog's only view of persistence. It hands out digests, never the raw
 * key, so the policy in ClaudeCommandCatalog can be tested against a fake and
 * the raw environment never leaves this file.
 */
export interface RuntimeCommandCacheStore {
  currentFingerprint(): string;
  read(): RuntimeCommandCacheRecord | null;
  write(value: RuntimeCommandCacheRecord): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The inputs that decide which commands the SDK can see at all. Deliberately the
 * same shape as the model catalog's key: a CLI swap, an environment change or a
 * settings-source change all alter the answer. Vault folders are absent on
 * purpose - their freshness comes from merging, not from invalidation, so that
 * editing a skill never costs a probe.
 */
function buildCommandCatalogCacheKey(
  settings: ClaudeProviderSettings,
  cliPath: string,
): string {
  return JSON.stringify({
    cliBinary: getClaudeCliBinaryFingerprint(cliPath),
    cliPath,
    enableChrome: settings.enableChrome,
    environmentHash: settings.environmentHash,
    environmentVariables: settings.environmentVariables,
    loadUserSettings: settings.loadUserSettings,
    projectSettingsEnvHash: settings.projectSettingsSnapshot.hash,
    respectProjectSettings: settings.respectProjectSettings,
  });
}

/**
 * FNV-1a over the cache key. The key embeds the raw environment variables, which
 * can hold an API key, so only the digest is ever persisted.
 */
function hashCommandCatalogCacheKey(cacheKey: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < cacheKey.length; index += 1) {
    hash ^= cacheKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createClaudeRuntimeCommandCacheStore(
  plugin: GrimoirePlugin,
): RuntimeCommandCacheStore {
  const readSettings = (): ClaudeProviderSettings =>
    getClaudeProviderSettings(plugin.settings ?? {});

  return {
    async clear() {
      updateClaudeProviderSettings(plugin.settings, {
        discoveredCommands: [],
        discoveredCommandsFingerprint: '',
      });
      await plugin.saveSettings?.();
    },
    currentFingerprint() {
      const cliPath = plugin.getResolvedProviderCliPath?.('claude') ?? '';
      return hashCommandCatalogCacheKey(buildCommandCatalogCacheKey(readSettings(), cliPath));
    },
    read() {
      const settings = readSettings();
      // Unlike the model catalog there is no legacy list to be lenient about:
      // the fingerprint field ships together with the cache itself, so a record
      // without one was never written by this store and is not trusted.
      if (settings.discoveredCommands.length === 0 || !settings.discoveredCommandsFingerprint) {
        return null;
      }
      return {
        commands: settings.discoveredCommands,
        fingerprint: settings.discoveredCommandsFingerprint,
      };
    },
    async write(value) {
      updateClaudeProviderSettings(plugin.settings, {
        discoveredCommands: normalizeClaudeDiscoveredCommands(value.commands),
        discoveredCommandsFingerprint: value.fingerprint,
      });
      await plugin.saveSettings?.();
    },
  };
}
