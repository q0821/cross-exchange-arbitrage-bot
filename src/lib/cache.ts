import type { CacheEntry, TradingPairRanking } from '../types/open-interest';
import { logger } from './logger';

/**
 * Simple in-memory cache with TTL support
 * Used for caching Open Interest data to reduce API calls
 *
 * @example
 * ```ts
 * const cache = new OICache();
 * cache.set(100, rankingData);
 * const cached = cache.get(100); // Returns data if not expired
 * ```
 */
export class OICache {
  private cache = new Map<string, CacheEntry<TradingPairRanking>>();
  private readonly TTL_MS: number;

  /**
   * @param ttlMs Time to live in milliseconds (default: 30 minutes)
   */
  constructor(ttlMs: number = 30 * 60 * 1000) {
    this.TTL_MS = ttlMs;
  }

  /**
   * Set cache entry with automatic expiration
   * @param topN Number of top symbols (used as part of cache key)
   * @param ranking Trading pair ranking data
   */
  set(topN: number, ranking: TradingPairRanking): void {
    const key = this.getCacheKey(topN);
    const expiresAt = Date.now() + this.TTL_MS;

    this.cache.set(key, {
      data: ranking,
      expiresAt,
    });

    logger.debug({
      cacheKey: key,
      ttlMs: this.TTL_MS,
      expiresAt: new Date(expiresAt).toISOString(),
      totalSymbols: ranking.totalSymbols,
    }, 'OI cache entry created');
  }

  /**
   * Get cache entry if not expired
   * @param topN Number of top symbols
   * @returns Cached data or null if expired/missing
   */
  get(topN: number): TradingPairRanking | null {
    const key = this.getCacheKey(topN);
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug({ cacheKey: key }, 'OI cache miss - entry not found');
      return null;
    }

    // Check expiration
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug({
        cacheKey: key,
        expiredAt: new Date(entry.expiresAt).toISOString(),
        now: new Date(now).toISOString(),
      }, 'OI cache miss - entry expired');
      return null;
    }

    logger.debug({
      cacheKey: key,
      expiresIn: Math.round((entry.expiresAt - now) / 1000),
    }, 'OI cache hit');

    return entry.data;
  }

  /**
   * Check if cache has valid entry for given topN
   * @param topN Number of top symbols
   * @returns true if entry exists and not expired
   */
  has(topN: number): boolean {
    return this.get(topN) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.info({ clearedEntries: count }, 'OI cache cleared');
  }

  /**
   * Remove expired entries from cache
   * Can be called periodically to prevent memory leak
   */
  clearExpired(): void {
    const now = Date.now();
    let clearedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.debug({ clearedEntries: clearedCount }, 'Expired OI cache entries removed');
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache size and entry details
   */
  getStats(): { size: number; entries: Array<{ key: string; expiresIn: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      expiresIn: Math.max(0, Math.round((entry.expiresAt - now) / 1000)),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Generate cache key based on topN parameter
   * @param topN Number of top symbols
   * @returns Cache key string
   */
  private getCacheKey(topN: number): string {
    return `top_oi_${topN}`;
  }
}

/**
 * Global OI cache instance
 * Used across the application to share cache state
 */
export const oiCache = new OICache();
