import { ProviderModelCatalogRefreshCache } from '@/core/providers/ProviderModelCatalogRefreshCache';

describe('ProviderModelCatalogRefreshCache', () => {
  it('uses a seeded catalog while its fingerprint remains fresh', async () => {
    const load = jest.fn().mockResolvedValue(true);
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    cache.seed('cli-a:env-a');

    await expect(cache.refresh({
      fingerprint: 'cli-a:env-a',
      hasCachedModels: true,
      load,
    })).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('refreshes immediately when the CLI or environment fingerprint changes', async () => {
    const load = jest.fn().mockResolvedValue(true);
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    cache.seed('cli-a:env-a');

    await expect(cache.refresh({
      fingerprint: 'cli-b:env-a',
      hasCachedModels: true,
      load,
    })).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent refreshes for the same fingerprint', async () => {
    let resolveLoad!: (changed: boolean) => void;
    const load = jest.fn(() => new Promise<boolean>((resolve) => {
      resolveLoad = resolve;
    }));
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    const request = { fingerprint: 'cli-a:env-a', hasCachedModels: false, load };

    const first = cache.refresh(request);
    const second = cache.refresh(request);
    resolveLoad(true);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not mark failed refreshes as fresh', async () => {
    const load = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(false);
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    const request = { fingerprint: 'cli-a:env-a', hasCachedModels: true, load };

    await expect(cache.refresh(request)).rejects.toThrow('offline');
    await expect(cache.refresh(request)).resolves.toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not let an older environment refresh overwrite newer freshness', async () => {
    let resolveOld!: (changed: boolean) => void;
    let resolveNew!: (changed: boolean) => void;
    const oldLoad = jest.fn(() => new Promise<boolean>((resolve) => {
      resolveOld = resolve;
    }));
    const newLoad = jest.fn(() => new Promise<boolean>((resolve) => {
      resolveNew = resolve;
    }));
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);

    const oldRefresh = cache.refresh({ fingerprint: 'old-env', hasCachedModels: false, load: oldLoad });
    const newRefresh = cache.refresh({ fingerprint: 'new-env', hasCachedModels: false, load: newLoad });
    resolveNew(false);
    await newRefresh;
    resolveOld(false);
    await oldRefresh;

    const reloadOld = jest.fn().mockResolvedValue(false);
    await cache.refresh({ fingerprint: 'old-env', hasCachedModels: true, load: reloadOld });
    expect(reloadOld).toHaveBeenCalledTimes(1);
  });

  it('applies a deferred seed once the resolved CLI path is known', async () => {
    const load = jest.fn().mockResolvedValue(true);
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    cache.seedOnFirstRefresh(() => 'cli-a:env-a');

    expect(cache.applyDeferredSeed('cli-a:env-a', true)).toBe(true);
    await expect(cache.refresh({
      fingerprint: 'cli-a:env-a',
      hasCachedModels: true,
      load,
    })).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('drops a deferred seed when more than the CLI path changed since construction', async () => {
    const load = jest.fn().mockResolvedValue(true);
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    cache.seedOnFirstRefresh(() => 'cli-a:env-a');

    expect(cache.applyDeferredSeed('cli-a:env-b', true)).toBe(false);
    await expect(cache.refresh({
      fingerprint: 'cli-a:env-b',
      hasCachedModels: true,
      load,
    })).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('consumes a deferred seed even when the cached catalog is gone', () => {
    const cache = new ProviderModelCatalogRefreshCache(1_000, () => 100);
    cache.seedOnFirstRefresh(() => 'cli-a:env-a');

    expect(cache.applyDeferredSeed('cli-a:env-a', false)).toBe(false);
    expect(cache.applyDeferredSeed('cli-a:env-a', true)).toBe(false);
  });
});
