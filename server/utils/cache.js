// In-memory TTL cache — removes DB round trips for data that barely changes (board list, block list).
//
// A production DB round trip is ~70ms, so re-reading the same board list on every request is expensive.
// (see perf/server-bench.js)
//
// · in-flight coalescing: the home screen fires 5 APIs at once. Concurrent lookups of the same key
//   hit the DB once and share that single Promise.
// · generation counter: stops a lookup that began just before clear() from finishing afterwards
//   and writing a stale value back.
// · single-instance assumption: invalidation propagates only inside this process. Add instances and
//   the others can serve a value up to one TTL stale (docs/ARCHITECTURE.md, Known limits).
const registry = new Set();

function createCache({ ttlMs, max = 5000 }) {
  const store = new Map(); // key → { value, expires }
  const inflight = new Map(); // key → Promise
  let generation = 0;

  const cache = {
    async get(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;
      if (inflight.has(key)) return inflight.get(key);

      const gen = generation;
      const p = Promise.resolve()
        .then(loader)
        .then((value) => {
          if (gen === generation) {
            store.set(key, { value, expires: Date.now() + ttlMs });
            // Past the cap, evict in insertion order, oldest first (Map preserves insertion order)
            if (store.size > max) store.delete(store.keys().next().value);
          }
          return value;
        })
        .finally(() => {
          if (inflight.get(key) === p) inflight.delete(key);
        });
      inflight.set(key, p);
      return p;
    },
    clear() {
      generation++;
      store.clear();
      inflight.clear();
    },
    get size() {
      return store.size;
    },
  };
  registry.add(cache);
  return cache;
}

// When a test clears a collection straight through the driver (skipping the model hooks), clear the cache too
function clearAllCaches() {
  for (const c of registry) c.clear();
}

module.exports = { createCache, clearAllCaches };
