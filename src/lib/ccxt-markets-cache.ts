/**
 * CCXT Markets 快取
 *
 * 快取交易所的 markets 資料，避免每次請求都調用 loadMarkets()
 * 透過 proxy 時，loadMarkets() 可能需要 1-2 秒，快取可大幅提升效能
 */

import { logger } from './logger';

interface MarketsCacheEntry {
  markets: Record<string, unknown>;
  expireAt: number;
}

/**
 * Markets 快取 TTL（毫秒）
 * 預設 30 分鐘，交易所的交易對不會頻繁變動
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * 全局 markets 快取
 * Key: 交易所 ID（如 'okx', 'mexc', 'gateio', 'bingx'）
 */
const marketsCache = new Map<string, MarketsCacheEntry>();

/**
 * 取得快取的 markets 資料
 *
 * @param exchangeId - 交易所 ID
 * @returns 快取的 markets 資料，如果不存在或已過期則返回 null
 */
export function getCachedMarkets(exchangeId: string): Record<string, unknown> | null {
  const entry = marketsCache.get(exchangeId);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expireAt) {
    // 快取過期，刪除並返回 null
    marketsCache.delete(exchangeId);
    logger.debug({ exchangeId }, 'Markets cache expired');
    return null;
  }

  logger.debug({ exchangeId }, 'Markets cache hit');
  return entry.markets;
}

/**
 * 設定 markets 快取
 *
 * @param exchangeId - 交易所 ID
 * @param markets - markets 資料
 * @param ttlMs - 快取 TTL（毫秒），預設 30 分鐘
 */
export function setCachedMarkets(
  exchangeId: string,
  markets: Record<string, unknown>,
  ttlMs: number = CACHE_TTL_MS
): void {
  marketsCache.set(exchangeId, {
    markets,
    expireAt: Date.now() + ttlMs,
  });

  const marketCount = Object.keys(markets).length;
  logger.info(
    { exchangeId, marketCount, ttlMs },
    'Markets cached'
  );
}

/**
 * 清除指定交易所的 markets 快取
 *
 * @param exchangeId - 交易所 ID
 */
export function clearCachedMarkets(exchangeId: string): void {
  marketsCache.delete(exchangeId);
  logger.debug({ exchangeId }, 'Markets cache cleared');
}

/**
 * 清除所有 markets 快取
 */
export function clearAllCachedMarkets(): void {
  marketsCache.clear();
  logger.info('All markets cache cleared');
}

/**
 * 取得快取統計資訊
 */
export function getMarketsCacheStats(): {
  size: number;
  exchanges: string[];
} {
  return {
    size: marketsCache.size,
    exchanges: Array.from(marketsCache.keys()),
  };
}

/**
 * 將快取的 markets 注入到 CCXT 實例
 * 如果快取存在且未過期，直接設定 markets 屬性，跳過 loadMarkets()
 *
 * @param exchange - CCXT 交易所實例
 * @param exchangeId - 交易所 ID
 * @returns 是否成功注入快取
 */
export function injectCachedMarkets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchange: any,
  exchangeId: string
): boolean {
  const cachedMarkets = getCachedMarkets(exchangeId);

  if (cachedMarkets) {
    exchange.markets = cachedMarkets;
    // 建立 markets_by_id 索引（如果 indexBy 方法存在）
    if (typeof exchange.indexBy === 'function') {
      exchange.markets_by_id = exchange.indexBy(cachedMarkets, 'id');
      exchange.marketsById = exchange.markets_by_id;
    }
    return true;
  }

  return false;
}

/**
 * 從 CCXT 實例提取並快取 markets
 *
 * @param exchange - CCXT 交易所實例（已載入 markets）
 * @param exchangeId - 交易所 ID
 */
export function cacheMarketsFromExchange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchange: any,
  exchangeId: string
): void {
  if (exchange.markets && Object.keys(exchange.markets).length > 0) {
    setCachedMarkets(exchangeId, exchange.markets);
  }
}
