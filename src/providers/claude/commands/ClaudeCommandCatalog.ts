import type { DebugLogEvent } from '../../../core/debug/DebugLogService';
import type {
  ProviderCommandCatalog,
  ProviderCommandDropdownConfig,
} from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import type { SlashCommand } from '../../../core/types';
import { isSkill } from '../../../utils/slashCommand';
import type { SkillStorage } from '../storage/SkillStorage';
import type { SlashCommandStorage } from '../storage/SlashCommandStorage';
import type { RuntimeCommandCacheStore } from './ClaudeRuntimeCommandCacheStore';

function slashCommandToEntry(cmd: SlashCommand): ProviderCommandEntry {
  const skill = isSkill(cmd);
  return {
    id: cmd.id,
    providerId: 'claude',
    kind: skill ? 'skill' : 'command',
    name: cmd.name,
    description: cmd.description,
    content: cmd.content,
    argumentHint: cmd.argumentHint,
    allowedTools: cmd.allowedTools,
    model: cmd.model,
    disableModelInvocation: cmd.disableModelInvocation,
    userInvocable: cmd.userInvocable,
    context: cmd.context,
    agent: cmd.agent,
    hooks: cmd.hooks,
    scope: cmd.source === 'sdk' ? 'runtime' : 'vault',
    source: cmd.source ?? 'user',
    isEditable: cmd.source !== 'sdk',
    isDeletable: cmd.source !== 'sdk',
    displayPrefix: '/',
    insertPrefix: '/',
  };
}

function entryToSlashCommand(entry: ProviderCommandEntry): SlashCommand {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    content: entry.content,
    argumentHint: entry.argumentHint,
    allowedTools: entry.allowedTools,
    model: entry.model,
    disableModelInvocation: entry.disableModelInvocation,
    userInvocable: entry.userInvocable,
    context: entry.context,
    agent: entry.agent,
    hooks: entry.hooks,
    source: entry.source,
    kind: entry.kind,
  };
}

// SDK built-in skills that have no meaning inside Grimoire
const BUILTIN_HIDDEN_COMMANDS = new Set([
  'context', 'cost', 'debug', 'extra-usage', 'heapdump', 'init',
  'insights', 'loop', 'schedule', 'security-review', 'simplify', 'update-config',
]);

export type CommandProbe = () => Promise<SlashCommand[]>;

export interface RuntimeCommandCatalogDeps {
  cache?: RuntimeCommandCacheStore;
  recordEvent?: (event: DebugLogEvent) => void;
}

export class ClaudeCommandCatalog implements ProviderCommandCatalog {
  private sdkCommands: SlashCommand[] = [];
  private probePromise: Promise<void> | null = null;
  // A list restored from the cache is a snapshot: it can miss a skill created
  // since it was written, so it is merged with the vault before display. A list
  // from a live session is authoritative and is shown as-is.
  private sdkCommandsFromCache = false;

  constructor(
    private commandStorage: SlashCommandStorage,
    private skillStorage: SkillStorage,
    private probe?: CommandProbe,
    private deps: RuntimeCommandCatalogDeps = {},
  ) {}

  setRuntimeCommands(commands: SlashCommand[]): void {
    this.sdkCommands = commands;
    this.sdkCommandsFromCache = false;
    // An empty list is a reset, not a discovery: TabManager clears the catalog
    // for a blank tab that skips warmup. Keeping the cache means the next
    // dropdown open is served from it instead of paying for a probe.
    if (commands.length > 0) {
      void this.writeCache(commands);
    }
  }

  async listDropdownEntries(context: { includeBuiltIns: boolean }): Promise<ProviderCommandEntry[]> {
    void context;
    // SDK commands already include vault commands/skills (the SDK scans
    // .claude/commands/ and .claude/skills/ internally). No file scan needed.
    // A probe starts a full Claude Code session and bills against the plan
    // window, so a list persisted under the same configuration is reused first
    // and the probe only runs when there is nothing to reuse.
    if (this.sdkCommands.length === 0) {
      this.hydrateFromCache();
    }
    if (this.sdkCommands.length === 0 && this.probe) {
      await this.ensureProbed();
    }
    const runtimeEntries = this.sdkCommands
      .filter(cmd => !BUILTIN_HIDDEN_COMMANDS.has(cmd.name.toLowerCase()))
      .map(slashCommandToEntry);
    if (runtimeEntries.length === 0) {
      return this.listVaultEntries();
    }
    if (!this.sdkCommandsFromCache) {
      return runtimeEntries;
    }
    return this.mergeWithVaultEntries(runtimeEntries);
  }

  /** Restores a list persisted under the current configuration. Never probes. */
  private hydrateFromCache(): void {
    const cache = this.deps.cache;
    if (!cache) return;
    try {
      const record = cache.read();
      if (!record || record.commands.length === 0) return;
      if (record.fingerprint !== cache.currentFingerprint()) return;
      this.sdkCommands = record.commands;
      this.sdkCommandsFromCache = true;
      this.record('commandCatalog.probe.skipped', 'debug', {
        commandCount: record.commands.length,
        reason: 'cache_fresh',
      });
    } catch {
      // A cache that cannot be read or keyed leaves today's behaviour intact.
    }
  }

  /** The digest of the current configuration, or null when it cannot be computed. */
  private safeFingerprint(): string | null {
    const cache = this.deps.cache;
    if (!cache) return null;
    try {
      return cache.currentFingerprint();
    } catch {
      return null;
    }
  }

  private async writeCache(commands: SlashCommand[]): Promise<void> {
    const cache = this.deps.cache;
    if (!cache) return;
    try {
      await cache.write({ commands, fingerprint: cache.currentFingerprint() });
    } catch (error) {
      this.record('commandCatalog.cache.writeFailed', 'warn', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private record(
    event: string,
    level: DebugLogEvent['level'],
    data: Record<string, unknown>,
  ): void {
    this.deps.recordEvent?.({
      data: { providerId: 'claude', ...data },
      event,
      level,
      scope: 'provider.claude',
    });
  }

  /** Probe the SDK for commands. Deduplicates concurrent calls. */
  private async ensureProbed(): Promise<void> {
    if (!this.probe) return;
    if (!this.probePromise) {
      this.record('commandCatalog.probe.started', 'debug', {});
      this.probePromise = this.probe().then(async (commands) => {
        if (commands.length === 0) {
          this.record('commandCatalog.probe.empty', 'debug', {});
          return;
        }
        // Only apply probe results if the runtime hasn't provided fresher data
        const applied = this.sdkCommands.length === 0;
        if (applied) {
          this.sdkCommands = commands;
          this.sdkCommandsFromCache = false;
        }
        this.record('commandCatalog.probe.succeeded', 'info', {
          applied,
          commandCount: commands.length,
        });
        if (applied) {
          await this.writeCache(commands);
        }
      }).catch((error) => {
        // Probe is best-effort
        this.record('commandCatalog.probe.failed', 'warn', {
          message: error instanceof Error ? error.message : String(error),
        });
      }).finally(() => {
        this.probePromise = null;
      });
    }
    await this.probePromise;
  }

  /**
   * A cached list is a snapshot of what the SDK reported earlier, while the vault
   * folders it was built from keep changing. Reading them costs nothing, so the
   * snapshot is topped up with what is on disk right now. The vault version wins
   * a name collision: it is a real, editable file the user owns, whereas the
   * cached entry is only a description of it.
   */
  private async mergeWithVaultEntries(
    runtimeEntries: ProviderCommandEntry[],
  ): Promise<ProviderCommandEntry[]> {
    const vaultEntries = await this.listVaultEntries();
    const vaultByName = new Map(
      vaultEntries.map(entry => [entry.name.toLowerCase(), entry] as const),
    );
    const merged: ProviderCommandEntry[] = [];
    const taken = new Set<string>();

    for (const entry of runtimeEntries) {
      const key = entry.name.toLowerCase();
      if (taken.has(key)) continue;
      taken.add(key);
      merged.push(vaultByName.get(key) ?? entry);
    }
    for (const entry of vaultEntries) {
      const key = entry.name.toLowerCase();
      if (taken.has(key)) continue;
      taken.add(key);
      merged.push(entry);
    }

    return merged;
  }

  async listVaultEntries(): Promise<ProviderCommandEntry[]> {
    const commands = await this.commandStorage.loadAll();
    const skills = await this.skillStorage.loadAll();
    return [...commands, ...skills].map(slashCommandToEntry);
  }

  async saveVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    const cmd = entryToSlashCommand(entry);
    if (entry.kind === 'skill') {
      await this.skillStorage.save(cmd);
    } else {
      await this.commandStorage.save(cmd);
    }
  }

  async deleteVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    if (entry.kind === 'skill') {
      await this.skillStorage.delete(entry.id);
    } else {
      await this.commandStorage.delete(entry.id);
    }
  }

  getDropdownConfig(): ProviderCommandDropdownConfig {
    return {
      providerId: 'claude',
      triggerChars: ['/'],
      builtInPrefix: '/',
      skillPrefix: '/',
      commandPrefix: '/',
    };
  }

  async refresh(): Promise<void> {
    // Claude revalidation happens externally via setRuntimeCommands
  }
}
