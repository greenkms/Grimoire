import {
  bumpAcpLifecycleGeneration,
  isAcpLifecycleCurrent,
  runAcpLifecycleCleanup,
} from '@/providers/acp/acpLifecycle';

describe('acpLifecycle', () => {
  it('bumps generation so stale ensureReady work can detect races', () => {
    const state = { cleanupPromise: null, lifecycleGeneration: 0 };
    expect(bumpAcpLifecycleGeneration(state)).toBe(1);
    expect(isAcpLifecycleCurrent(state, 1)).toBe(true);
    expect(isAcpLifecycleCurrent(state, 0)).toBe(false);
  });

  it('serializes cleanup behind a shared promise', async () => {
    const state = { cleanupPromise: null as Promise<void> | null, lifecycleGeneration: 0 };
    let active = 0;
    let maxActive = 0;
    const cleanup = jest.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
    });

    await Promise.all([
      runAcpLifecycleCleanup(state, cleanup),
      runAcpLifecycleCleanup(state, cleanup),
    ]);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(maxActive).toBe(1);
    expect(state.cleanupPromise).toBeNull();
    expect(state.lifecycleGeneration).toBe(1);
  });
});
