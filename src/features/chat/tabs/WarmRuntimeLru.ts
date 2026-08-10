interface WarmRuntimeEntry<Runtime> {
  runtime: Runtime;
}

export interface WarmRuntimeTrimOptions<Runtime> {
  isLive: (tabId: string, runtime: Runtime) => boolean;
  isProtected: (tabId: string, runtime: Runtime) => boolean;
  onEvict: (tabId: string, runtime: Runtime) => void;
}

/** LRU bookkeeping for ready per-tab provider runtimes. */
export class WarmRuntimeLru<Runtime> {
  private readonly entries = new Map<string, WarmRuntimeEntry<Runtime>>();

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('Warm runtime limit must be a positive integer');
    }
  }

  touch(tabId: string, runtime: Runtime): void {
    this.entries.delete(tabId);
    this.entries.set(tabId, { runtime });
  }

  remove(tabId: string, runtime?: Runtime): void {
    const entry = this.entries.get(tabId);
    if (!entry || (runtime !== undefined && entry.runtime !== runtime)) {
      return;
    }
    this.entries.delete(tabId);
  }

  clear(): void {
    this.entries.clear();
  }

  trim(options: WarmRuntimeTrimOptions<Runtime>): void {
    for (const [tabId, entry] of this.entries) {
      if (!options.isLive(tabId, entry.runtime)) {
        this.entries.delete(tabId);
      }
    }

    while (this.entries.size > this.limit) {
      const candidate = [...this.entries].find(([tabId, entry]) => (
        !options.isProtected(tabId, entry.runtime)
      ));
      if (!candidate) {
        return;
      }

      const [tabId, entry] = candidate;
      this.entries.delete(tabId);
      options.onEvict(tabId, entry.runtime);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
