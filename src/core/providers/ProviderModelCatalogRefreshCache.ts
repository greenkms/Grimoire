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

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  seed(fingerprint: string): void {
    this.refreshGeneration += 1;
    this.freshFingerprint = fingerprint;
    this.lastSuccessfulRefreshAt = this.now();
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
