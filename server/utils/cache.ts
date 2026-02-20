/**
 * Simple in-memory TTL cache for server-side data.
 * Used for static or slowly-changing data (admin settings, genre benchmarks)
 * to reduce database round-trips.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  /** Get or compute: returns cached value or calls factory, caches result */
  async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  get size(): number {
    // Clean expired entries first
    const now = Date.now();
    const expired: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) expired.push(key);
    });
    expired.forEach(key => this.store.delete(key));
    return this.store.size;
  }
}

// ── Pre-configured caches ──

/** Admin settings cache — 5 min TTL (rarely changes) */
export const adminSettingsCache = new TTLCache<Record<string, unknown>>(5 * 60 * 1000);

/** Genre benchmarks cache — 15 min TTL (computed periodically) */
export const genreBenchmarksCache = new TTLCache<unknown[]>(15 * 60 * 1000);

/** User tier/limits cache — 1 min TTL (changes on subscription events) */
export const userTierCache = new TTLCache<{ tier: string; limits: Record<string, number> }>(60 * 1000);
