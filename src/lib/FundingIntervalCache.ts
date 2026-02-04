import type { DataStructureStats, Monitorable } from '../types/memory-stats';

export interface CachedInterval {
  /** 間隔值(小時) */
  interval: number;

  /** 資料來源 */
  source: 'native-api' | 'calculated' | 'default';

  /** 快取建立時間戳(毫秒) */
  timestamp: number;

  /** 存活時間(毫秒) */
  ttl: number;
}

/** 快取間隔的中繼資料資訊 */
export interface CachedIntervalMetadata {
  /** 交易所名稱 */
  exchange: string;

  /** 交易對符號 */
  symbol: string;

  /** 間隔值(小時) */
  interval: number;

  /** 資料來源 */
  source: 'native-api' | 'calculated' | 'default';

  /** 快取建立時間戳(毫秒) */
  timestamp: number;

  /** 存活時間(毫秒) */
  ttl: number;

  /** 是否過期 */
  isExpired: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
}

/**
 * 資金費率間隔快取
 * 用於避免重複 API 呼叫，預設 TTL 為 24 小時
 *
 * 支援單例模式（getInstance）讓多個服務共享快取：
 * - GateioConnector (REST API) 透過 getFundingInterval() 填充快取
 * - GateioFundingWs (WebSocket) 透過 get() 查詢快取計算 nextFundingTime
 */
export class FundingIntervalCache implements Monitorable {
  private static instance: FundingIntervalCache | null = null;

  private cache: Map<string, CachedInterval>;
  private stats: CacheStats;
  private defaultTTL: number;

  constructor(defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    this.defaultTTL = defaultTTL;
  }

  /**
   * 取得全域單例實例
   * 用於讓多個服務（如 GateioConnector 和 GateioFundingWs）共享快取
   */
  static getInstance(): FundingIntervalCache {
    if (!FundingIntervalCache.instance) {
      FundingIntervalCache.instance = new FundingIntervalCache();
    }
    return FundingIntervalCache.instance;
  }

  /**
   * 重置單例（僅供測試使用）
   */
  static resetInstance(): void {
    FundingIntervalCache.instance = null;
  }

  /**
   * 設定間隔值
   * @param exchange 交易所名稱
   * @param symbol 交易對符號
   * @param interval 間隔值(小時)
   * @param source 資料來源
   */
  set(
    exchange: string,
    symbol: string,
    interval: number,
    source: 'native-api' | 'calculated' | 'default'
  ): void {
    const key = this.generateKey(exchange, symbol);
    this.cache.set(key, {
      interval,
      source,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    });
    this.stats.sets++;
  }

  /**
   * 獲取間隔值(若過期則返回 null)
   * @param exchange 交易所名稱
   * @param symbol 交易對符號
   * @returns 間隔值或 null
   */
  get(exchange: string, symbol: string): number | null {
    const key = this.generateKey(exchange, symbol);
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // 檢查是否過期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.interval;
  }

  /**
   * 獲取間隔值及其中繼資料
   * @param exchange 交易所名稱
   * @param symbol 交易對符號
   * @returns 包含中繼資料的快取資訊或 null
   */
  getWithMetadata(exchange: string, symbol: string): CachedIntervalMetadata | null {
    const key = this.generateKey(exchange, symbol);
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const isExpired = now - cached.timestamp > cached.ttl;

    if (isExpired) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return {
      exchange,
      symbol,
      interval: cached.interval,
      source: cached.source,
      timestamp: cached.timestamp,
      ttl: cached.ttl,
      isExpired: false,
    };
  }

  /**
   * 獲取所有快取的間隔值及其中繼資料
   * @returns 所有快取項目的中繼資料陣列
   */
  getAllWithMetadata(): CachedIntervalMetadata[] {
    const now = Date.now();
    const results: CachedIntervalMetadata[] = [];

    for (const [key, cached] of this.cache) {
      const parts = key.split('-');
      const exchange = parts[0] ?? '';
      const symbol = parts.slice(1).join('-');
      const isExpired = now - cached.timestamp > cached.ttl;

      results.push({
        exchange,
        symbol,
        interval: cached.interval,
        source: cached.source,
        timestamp: cached.timestamp,
        ttl: cached.ttl,
        isExpired,
      });
    }

    return results;
  }

  /**
   * 批量設定間隔值
   * @param exchange 交易所名稱
   * @param intervals 符號與間隔的映射
   * @param source 資料來源
   */
  setAll(
    exchange: string,
    intervals: Map<string, number>,
    source: 'native-api' | 'calculated' | 'default'
  ): void {
    for (const [symbol, interval] of intervals) {
      this.set(exchange, symbol, interval, source);
    }
  }

  /**
   * 清除快取
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
  }

  /**
   * 清除過期項目
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 獲取快取統計
   */
  getStats(): {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    sets: number;
  } {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      size: this.cache.size,
      hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
    };
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const cacheStats = this.getStats();

    return {
      name: 'FundingIntervalCache',
      sizes: {
        cache: this.cache.size,
      },
      totalItems: this.cache.size,
      details: {
        hitRate: Math.round(cacheStats.hitRate * 100) / 100,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        sets: cacheStats.sets,
        defaultTTLMs: this.defaultTTL,
      },
    };
  }

  /**
   * 生成快取鍵
   */
  private generateKey(exchange: string, symbol: string): string {
    return `${exchange}-${symbol}`;
  }
}
