import type { ClaudeProviderSettings } from '../settings';
import { getClaudeCliBinaryFingerprint } from './claudeCliBinaryFingerprint';

/**
 * The inputs that decide what the Claude Code SDK can see at all: which binary
 * runs, where it runs from, and which settings sources and environment it reads.
 * Both catalogs that persist a discovery - models and commands - are keyed on
 * this, because a change to any of it can change the answer.
 *
 * Vault folders are deliberately absent. Their freshness comes from merging
 * what is on disk at display time, not from invalidating the cache, so editing
 * a skill never costs a probe.
 */
export function buildClaudeCatalogCacheKey(
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
 * FNV-1a over the cache key. The key embeds the raw environment variables,
 * which can hold an API key, so only the digest is ever persisted.
 */
export function hashClaudeCatalogCacheKey(cacheKey: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < cacheKey.length; index += 1) {
    hash ^= cacheKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
