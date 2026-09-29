const { createCache, clearAllCaches } = require('../../utils/cache');

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

describe('createCache', () => {
  it('does not call the loader again within the TTL', async () => {
    const cache = createCache({ ttlMs: 10_000 });
    const loader = jest.fn().mockResolvedValue('v');
    expect(await cache.get('k', loader)).toBe('v');
    expect(await cache.get('k', loader)).toBe('v');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads once the TTL passes', async () => {
    jest.useFakeTimers();
    try {
      const cache = createCache({ ttlMs: 1000 });
      const loader = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
      expect(await cache.get('k', loader)).toBe('old');
      jest.advanceTimersByTime(1001);
      expect(await cache.get('k', loader)).toBe('new');
    } finally {
      jest.useRealTimers();
    }
  });

  it('concurrent lookups of one key call the loader once (in-flight coalescing)', async () => {
    const cache = createCache({ ttlMs: 10_000 });
    const d = deferred();
    const loader = jest.fn(() => d.promise);
    const all = Promise.all([cache.get('k', loader), cache.get('k', loader), cache.get('k', loader)]);
    d.resolve('v');
    expect(await all).toEqual(['v', 'v', 'v']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('a clear() during a lookup keeps that result out of the cache (no stale rewrite)', async () => {
    const cache = createCache({ ttlMs: 10_000 });
    const d = deferred();
    const first = cache.get('k', () => d.promise);
    cache.clear(); // A write happens → invalidated
    d.resolve('stale');
    expect(await first).toBe('stale'); // A caller already in flight still gets its value
    const loader = jest.fn().mockResolvedValue('fresh');
    expect(await cache.get('k', loader)).toBe('fresh'); // but nothing was left in the cache
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('a failing loader is not cached and is retried on the next call', async () => {
    const cache = createCache({ ttlMs: 10_000 });
    await expect(cache.get('k', () => Promise.reject(new Error('db down')))).rejects.toThrow('db down');
    expect(await cache.get('k', async () => 'ok')).toBe('ok');
  });

  it('evicts the oldest key once max is exceeded', async () => {
    const cache = createCache({ ttlMs: 10_000, max: 2 });
    await cache.get('a', async () => 1);
    await cache.get('b', async () => 2);
    await cache.get('c', async () => 3);
    expect(cache.size).toBe(2);
    const loader = jest.fn().mockResolvedValue(1);
    await cache.get('a', loader);
    expect(loader).toHaveBeenCalledTimes(1); // a was evicted
  });

  it('clearAllCaches empties every registered cache', async () => {
    const c1 = createCache({ ttlMs: 10_000 });
    const c2 = createCache({ ttlMs: 10_000 });
    await c1.get('k', async () => 1);
    await c2.get('k', async () => 2);
    clearAllCaches();
    expect(c1.size).toBe(0);
    expect(c2.size).toBe(0);
  });
});
