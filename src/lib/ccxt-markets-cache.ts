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
 * 追蹤正在執行的 loadMarkets Promise（Singleflight Pattern）
 * 用於避免 Cache Stampede（快取踩踏）問題
 * Key: 交易所 ID
 */
const inflightLoads = new Map<string, Promise<Record<string, unknown>>>();

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

/**
 * 將 markets 資料注入到 CCXT 實例（內部 helper）
 *
 * @param exchange - CCXT 交易所實例（或相容介面）
 * @param markets - markets 資料
 */
function injectMarketsToExchange(
  exchange: { markets?: Record<string, unknown> },
  markets: Record<string, unknown>
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = exchange as any;
  ex.markets = markets;

  // 建立 markets_by_id 索引（如果 indexBy 方法存在）
  if (typeof ex.indexBy === 'function') {
    ex.markets_by_id = ex.indexBy(markets, 'id');
    ex.marketsById = ex.markets_by_id;
  }
}

/**
 * 可呼叫 loadMarkets 的交易所實例介面
 */
interface ExchangeWithLoadMarkets {
  loadMarkets(): Promise<unknown>;
  markets?: Record<string, unknown>;
}

/**
 * 帶並發控制的 loadMarkets（Singleflight Pattern）
 *
 * 解決 Cache Stampede（快取踩踏）問題：
 * 當多個並行請求同時發現快取未命中時，只有第一個請求會執行 loadMarkets()，
 * 其他請求會等待同一個 Promise 完成。
 *
 * 流程：
 * 1. 檢查快取，有則直接返回
 * 2. 檢查是否有進行中的請求，有則等待
 * 3. 若為第一個請求，執行 loadMarkets 並追蹤 Promise
 *
 * @param exchange - CCXT 交易所實例（或相容介面）
 * @param exchangeId - 交易所 ID（用於快取 key）
 * @returns markets 資料
 */
export async function loadMarketsWithCache(
  exchange: ExchangeWithLoadMarkets,
  exchangeId: string
): Promise<Record<string, unknown>> {
  // 1. 先檢查快取
  const cachedMarkets = getCachedMarkets(exchangeId);
  if (cachedMarkets) {
    injectMarketsToExchange(exchange, cachedMarkets);
    logger.debug({ exchangeId }, 'loadMarketsWithCache: cache hit');
    return cachedMarkets;
  }

  // 2. 檢查是否有進行中的請求
  const inflightPromise = inflightLoads.get(exchangeId);
  if (inflightPromise) {
    logger.debug({ exchangeId }, 'loadMarketsWithCache: waiting for inflight request');
    const markets = await inflightPromise;
    injectMarketsToExchange(exchange, markets);
    return markets;
  }

  // 3. 第一個請求，執行 loadMarkets
  logger.info({ exchangeId }, 'loadMarketsWithCache: starting loadMarkets');

  const loadPromise = exchange.loadMarkets()
    .then(() => {
      // CCXT loadMarkets 返回 Dictionary<Market>，並設定在 exchange.markets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marketsDict = (exchange as any).markets as Record<string, unknown>;
      setCachedMarkets(exchangeId, marketsDict);
      return marketsDict;
    })
    .finally(() => {
      // 無論成功或失敗都清理 inflight 追蹤
      inflightLoads.delete(exchangeId);
    });

  inflightLoads.set(exchangeId, loadPromise);
  return loadPromise;
}

/**
 * 取得 inflight loads 的數量（供測試使用）
 */
export function getInflightLoadsCount(): number {
  return inflightLoads.size;
}

/**
 * 清除所有 inflight loads（供測試使用）
 */
export function clearInflightLoads(): void {
  inflightLoads.clear();
}
