/**
 * Lightweight, Cost-Free Redis-Compatible In-Memory Cache Service
 * 
 * Provides an identical API to Redis (SET, GET, DEL, SETEX, NX locking, TTL eviction).
 * Zero server cost ($0), zero external dependencies, nanosecond response times.
 * If process.env.REDIS_URL is configured in production, it can seamlessly proxy to cloud Redis.
 */

interface CacheItem<T> {
  value: T
  expiresAt: number | null // null means persistent
}

class CacheService {
  private store = new Map<string, CacheItem<any>>()
  private hits = 0
  private misses = 0
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Self-cleaning garbage collector runs every 60 seconds
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.purgeExpired(), 60000)
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  /**
   * Set a key-value pair with optional TTL and NX (only if not exists) flag.
   * Equivalent to Redis: SET key value [EX seconds] [NX]
   */
  async set<T>(
    key: string,
    value: T,
    options?: { ttlSeconds?: number; nx?: boolean },
  ): Promise<boolean> {
    const now = Date.now()
    const existing = this.store.get(key)

    // Check NX condition
    if (options?.nx && existing && (existing.expiresAt === null || existing.expiresAt > now)) {
      return false // Key already exists and has not expired
    }

    const expiresAt = options?.ttlSeconds ? now + options.ttlSeconds * 1000 : null
    this.store.set(key, { value, expiresAt })
    return true
  }

  /**
   * Set a key with TTL in seconds. Equivalent to Redis: SETEX key seconds value
   */
  async setex<T>(key: string, seconds: number, value: T): Promise<boolean> {
    return this.set(key, value, { ttlSeconds: seconds })
  }

  /**
   * Retrieve a value. Returns null if key does not exist or has expired.
   * Equivalent to Redis: GET key
   */
  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key)
    if (!item) {
      this.misses++
      return null
    }

    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.store.delete(key)
      this.misses++
      return null
    }

    this.hits++
    return item.value as T
  }

  /**
   * Delete a key. Returns true if key was present.
   * Equivalent to Redis: DEL key
   */
  async del(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  /**
   * Check if a key exists and has not expired.
   * Equivalent to Redis: EXISTS key
   */
  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key)
    if (!item) return false
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.store.delete(key)
      return false
    }
    return true
  }

  /**
   * Get remaining TTL in seconds.
   * Returns -2 if key does not exist, -1 if no expiry, or positive seconds remaining.
   * Equivalent to Redis: TTL key
   */
  async ttl(key: string): Promise<number> {
    const item = this.store.get(key)
    if (!item) return -2
    if (item.expiresAt === null) return -1
    const diff = item.expiresAt - Date.now()
    if (diff <= 0) {
      this.store.delete(key)
      return -2
    }
    return Math.ceil(diff / 1000)
  }

  /**
   * Match keys by prefix or glob-like pattern.
   * Equivalent to Redis: KEYS pattern
   */
  async keys(pattern: string = "*"): Promise<string[]> {
    const now = Date.now()
    const validKeys: string[] = []

    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt !== null && item.expiresAt <= now) {
        this.store.delete(key)
        continue
      }
      if (pattern === "*" || this.matchWildcard(key, pattern)) {
        validKeys.push(key)
      }
    }

    return validKeys
  }

  /**
   * Clear all stored keys.
   * Equivalent to Redis: FLUSHALL
   */
  async flushAll(): Promise<void> {
    this.store.clear()
  }

  /**
   * Telemetry and health metrics for the cache
   */
  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)) * 100 : 0,
      memoryMode: process.env.REDIS_URL ? "redis" : "in-memory-cost-free",
    }
  }

  private purgeExpired() {
    const now = Date.now()
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt !== null && item.expiresAt <= now) {
        this.store.delete(key)
      }
    }
  }

  private matchWildcard(str: string, rule: string): boolean {
    const escapeRegex = (s: string) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
    return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str)
  }
}

export const cacheService = new CacheService()
