import { WarmRuntimeLru } from '@/features/chat/tabs/WarmRuntimeLru';

describe('WarmRuntimeLru', () => {
  it('evicts the least recently used unprotected runtime', () => {
    const lru = new WarmRuntimeLru<object>(2);
    const first = {};
    const second = {};
    const third = {};
    const evicted: string[] = [];
    lru.touch('first', first);
    lru.touch('second', second);
    lru.touch('first', first);
    lru.touch('third', third);

    lru.trim({
      isLive: () => true,
      isProtected: () => false,
      onEvict: tabId => evicted.push(tabId),
    });

    expect(evicted).toEqual(['second']);
    expect(lru.size).toBe(2);
  });

  it('temporarily exceeds the limit when every candidate is protected', () => {
    const lru = new WarmRuntimeLru<object>(1);
    lru.touch('active', {});
    lru.touch('streaming', {});

    lru.trim({
      isLive: () => true,
      isProtected: () => true,
      onEvict: jest.fn(),
    });

    expect(lru.size).toBe(2);
  });

  it('drops stale entries without invoking eviction cleanup', () => {
    const lru = new WarmRuntimeLru<object>(1);
    const onEvict = jest.fn();
    lru.touch('stale', {});
    lru.touch('live', {});

    lru.trim({
      isLive: tabId => tabId === 'live',
      isProtected: () => false,
      onEvict,
    });

    expect(lru.size).toBe(1);
    expect(onEvict).not.toHaveBeenCalled();
  });
});
