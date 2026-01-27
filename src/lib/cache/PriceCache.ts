/**
 * PriceCache
 *
 * LRU 快取用於儲存即時價格數據
 * Feature: 004-fix-okx-add-price-display
 * Task: T034
 */

import type { PriceData } from '../../types/service-interfaces.js';
import { logger } from '../logger.js';
import type { DataStructureStats, Monitorable } from '../../types/memory-stats.js';

/**
 * 快取配置
 */
export interface PriceCacheConfig {
  /** 最大快取數量 */
  maxSize?: number;
  /** 數據過期時間（毫秒）*/
  staleTresholdMs?: number;
}

/**
 * 快取項目
 */
interface CacheEntry {
  data: PriceData;
  accessTime: number;
}

/**
 * PriceCache
 *
 * LRU（Least Recently Used）快取實作：
 * - 最多儲存 100 個交易對的價格數據
 * - 10 秒內的數據視為新鮮
 * - 自動淘汰最少使用的項目
 */
export class PriceCache implements Monitorable {
  private config: Required<PriceCacheConfig>;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: PriceCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      staleTresholdMs: config.staleTresholdMs ?? 10000, // 10 秒
    };

    logger.debug({
      maxSize: this.config.maxSize,
      staleTresholdMs: this.config.staleTresholdMs,
    }, 'PriceCache initialized');
  }

  /**
   * 取得快取鍵（交易所 + 交易對）
   */
  private getCacheKey(exchange: string, symbol: string): string {
    return `${exchange}:${symbol}`;
  }

  /**
   * 設定價格數據
   */
  set(priceData: PriceData): void {
    const key = this.getCacheKey(priceData.exchange, priceData.symbol);

    // 如果快取已滿，移除最舊的項目
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      data: priceData,
      accessTime: Date.now(),
    };

    this.cache.set(key, entry);

    logger.debug({
      exchange: priceData.exchange,
      symbol: priceData.symbol,
      cacheSize: this.cache.size,
    }, 'Price cached');
  }

  /**
   * 取得價格數據
   */
  get(exchange: string, symbol: string): PriceData | null {
    const key = this.getCacheKey(exchange, symbol);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 更新訪問時間（LRU）
    entry.accessTime = Date.now();
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * 檢查數據是否過期
   */
  isStale(exchange: string, symbol: string): boolean {
    const priceData = this.get(exchange, symbol);

    if (!priceData) {
      return true; // 沒有數據視為過期
    }

    const now = Date.now();
    const age = now - priceData.timestamp.getTime();

    return age > this.config.staleTresholdMs;
  }

  /**
   * 取得所有價格數據
   */
  getAll(): PriceData[] {
    return Array.from(this.cache.values()).map((entry) => entry.data);
  }

  /**
   * 取得特定交易所的所有價格數據
   */
  getByExchange(exchange: string): PriceData[] {
    return Array.from(this.cache.values())
      .filter((entry) => entry.data.exchange === exchange)
      .map((entry) => entry.data);
  }

  /**
   * 取得特定交易對的所有交易所價格
   */
  getBySymbol(symbol: string): PriceData[] {
    return Array.from(this.cache.values())
      .filter((entry) => entry.data.symbol === symbol)
      .map((entry) => entry.data);
  }

  /**
   * 移除過期的項目
   */
  evictStale(): number {
    const now = Date.now();
    let evictedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.data.timestamp.getTime();
      if (age > this.config.staleTresholdMs) {
        this.cache.delete(key);
        evictedCount++;
      }
    }

    if (evictedCount > 0) {
      logger.debug({
        evictedCount,
        remainingSize: this.cache.size,
      }, 'Evicted stale entries');
    }

    return evictedCount;
  }

  /**
   * 移除最少使用的項目（LRU）
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug({
        evictedKey: oldestKey,
        cacheSize: this.cache.size,
      }, 'Evicted LRU entry');
    }
  }

  /**
   * 清除特定交易所的快取
   */
  clearExchange(exchange: string): number {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.exchange === exchange) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    logger.debug({
      exchange,
      clearedCount: keysToDelete.length,
    }, 'Cleared exchange cache');

    return keysToDelete.length;
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * 取得快取大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 取得快取統計
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
    exchanges: Record<string, number>;
  } {
    const exchanges: Record<string, number> = {};

    for (const entry of this.cache.values()) {
      const exchange = entry.data.exchange;
      exchanges[exchange] = (exchanges[exchange] || 0) + 1;
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      utilizationPercent: (this.cache.size / this.config.maxSize) * 100,
      exchanges,
    };
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const cacheStats = this.getStats();

    return {
      name: 'PriceCache',
      sizes: {
        cache: this.cache.size,
      },
      totalItems: this.cache.size,
      details: {
        maxSize: cacheStats.maxSize,
        utilizationPercent: Math.round(cacheStats.utilizationPercent * 100) / 100,
        exchangeDistribution: cacheStats.exchanges,
        staleTresholdMs: this.config.staleTresholdMs,
      },
    };
  }
}
