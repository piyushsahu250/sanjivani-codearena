// A single-process, in-memory TTL cache — deliberately not Redis. This platform runs one
// backend instance, so an in-process cache has no cross-instance consistency problem to solve;
// adding Redis here would be new paid infrastructure for a problem that doesn't exist yet. If
// this backend ever scales to multiple instances, this cache stops being globally consistent
// (each instance would cache independently) and should be swapped for a real distributed cache
// at that point — not before.
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Deletes every cached key starting with `prefix` — used after a write that could invalidate a
// whole family of cached reads (e.g. "leaderboard:" after an XP reset).
function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Wraps an async producer: returns the cached value if still fresh, otherwise calls fn(), caches
// the result, and returns it. Concurrent callers for the same not-yet-cached key will each run
// fn() once (no request-coalescing) — acceptable here since every use of this is read-only and
// idempotent, not a case where a duplicate concurrent compute would corrupt anything.
async function cached(key, ttlMs, fn) {
  const hit = get(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  set(key, value, ttlMs);
  return value;
}

module.exports = { get, set, invalidate, cached };
