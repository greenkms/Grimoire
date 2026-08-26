import type { SlashCommand } from '../../../core/types';
import type GrimoirePlugin from '../../../main';
import {
  buildClaudeCatalogCacheKey,
  hashClaudeCatalogCacheKey,
} from '../cli/claudeCatalogCacheKey';
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
      return hashClaudeCatalogCacheKey(buildClaudeCatalogCacheKey(readSettings(), cliPath));
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
      const commands = normalizeClaudeDiscoveredCommands(value.commands);
      const settings = readSettings();
      // A live session hands the same list over on every dropdown open, and a
      // settings write is a file write the user's vault sync sees. Nothing
      // changed means nothing to save.
      if (
        settings.discoveredCommandsFingerprint === value.fingerprint
        && JSON.stringify(settings.discoveredCommands) === JSON.stringify(commands)
      ) {
        return;
      }

      updateClaudeProviderSettings(plugin.settings, {
        discoveredCommands: commands,
        discoveredCommandsFingerprint: value.fingerprint,
      });
      await plugin.saveSettings?.();
    },
  };
}
