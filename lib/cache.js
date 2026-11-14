'use strict';

/**
 * Tiny in-memory TTL cache. Zero dependencies.
 *
 * Entries expire after `ttlMs`. Expired entries are evicted lazily on read
 * (and can be swept with `prune()`). Intended for caching the HayDay data set
 * so we don't hammer the upstream API on every tool call.
 */
class TTLCache {
  /**
   * @param {number} ttlMs - time-to-live per entry, in milliseconds.
   */
  constructor(ttlMs = 60 * 60 * 1000) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('TTLCache: ttlMs must be a positive number');
    }
    this.ttlMs = ttlMs;
    this._store = new Map();
  }

  /**
   * Return the cached value for `key`, or `undefined` if missing/expired.
   * @param {string} key
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store `value` under `key`, expiring after the configured TTL.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this._store.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  /**
   * True if a live (non-expired) entry exists for `key`.
   * @param {string} key
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /** Remove a single entry. */
  delete(key) {
    return this._store.delete(key);
  }

  /** Drop everything. */
  clear() {
    this._store.clear();
  }

  /** Evict all expired entries. Returns the number removed. */
  prune() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._store) {
      if (now > entry.expires) {
        this._store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Number of entries currently held (including not-yet-pruned expired ones). */
  get size() {
    return this._store.size;
  }
}

module.exports = { TTLCache };
