export interface ProviderModelCatalogRefreshRequest {
  fingerprint: string;
  hasCachedModels: boolean;
  load: () => Promise<boolean>;
}

interface PendingRefresh {
  fingerprint: string;
  promise: Promise<boolean>;
}

/**
 * Keeps provider model catalogs stale-while-revalidate without repeating an
 * expensive CLI warmup. A fingerprint change bypasses the TTL immediately.
 */
export class ProviderModelCatalogRefreshCache {
  private freshFingerprint: string | null = null;
  private lastSuccessfulRefreshAt = 0;
  private pending: PendingRefresh | null = null;
  private refreshGeneration = 0;
  private deferredSeed: (() => string) | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  seed(fingerprint: string): void {
    this.refreshGeneration += 1;
    this.freshFingerprint = fingerprint;
    this.lastSuccessfulRefreshAt = this.now();
  }

  /**
   * Holds a seed back until the first refresh, for a catalog whose fingerprint
   * cannot be computed yet.
   *
   * Provider workspace services are built *inside*
   * `ProviderWorkspaceRegistry.initialize()`, and the registry only assigns
   * `this.services[providerId]` after that promise resolves, so a catalog under
   * construction still sees `getCliResolver` as null and
   * `getResolvedProviderCliPath` returns null. Seeding under that unresolved
   * path files the seed under a key no later lookup ever uses, and the CLI
   * warmup the seed exists to prevent runs on every plugin load regardless.
   */
  seedOnFirstRefresh(buildSeedFingerprint: () => string): void {
    this.deferredSeed = buildSeedFingerprint;
  }

  /**
   * Consumes a held-back seed, applying it only when nothing but the resolved
   * CLI path changed since construction. A real configuration change in that
   * window must still reach discovery, so the seed is dropped instead of being
   * filed under the new fingerprint.
   */
  applyDeferredSeed(fingerprint: string, hasCachedModels: boolean): boolean {
    const buildSeedFingerprint = this.deferredSeed;
    if (!buildSeedFingerprint) {
      return false;
    }

    this.deferredSeed = null;
    if (!hasCachedModels || buildSeedFingerprint() !== fingerprint) {
      return false;
    }

    this.seed(fingerprint);
    return true;
  }

  isFresh(fingerprint: string, hasCachedModels: boolean): boolean {
    return hasCachedModels
      && fingerprint === this.freshFingerprint
      && this.lastSuccessfulRefreshAt > 0
      && this.now() - this.lastSuccessfulRefreshAt < this.ttlMs;
  }

  refresh(request: ProviderModelCatalogRefreshRequest): Promise<boolean> {
    if (this.isFresh(request.fingerprint, request.hasCachedModels)) {
      return Promise.resolve(false);
    }
    if (this.pending?.fingerprint === request.fingerprint) {
      return this.pending.promise;
    }

    const generation = this.refreshGeneration + 1;
    this.refreshGeneration = generation;
    const promise = request.load().then((changed) => {
      if (generation === this.refreshGeneration) {
        this.freshFingerprint = request.fingerprint;
        this.lastSuccessfulRefreshAt = this.now();
      }
      return changed;
    }).finally(() => {
      if (this.pending?.promise === promise) {
        this.pending = null;
      }
    });
    this.pending = { fingerprint: request.fingerprint, promise };
    return promise;
  }
}
