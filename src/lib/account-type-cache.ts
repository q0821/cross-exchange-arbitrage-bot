/**
 * 帳戶類型快取
 *
 * 快取交易所的帳戶類型偵測結果，避免每次開倉都呼叫 API
 * Binance: fapiPrivateGetPositionSideDual / papiGetUmPositionSideDual (1-2 次 API)
 * OKX: privateGetAccountConfig (1 次 API)
 * BingX: fetchPositionMode (1 次 API)
 *
 * 這些設定短期內不會改變，快取可節省 2-4 秒/次
 */

import { logger } from './logger';

/**
 * 帳戶類型快取項目
 */
export interface AccountTypeCacheEntry {
  /** Binance Portfolio Margin 模式（僅 Binance 使用） */
  isPortfolioMargin: boolean;
  /** 雙向持倉模式（Hedge Mode） */
  isHedgeMode: boolean;
  /** 快取過期時間（Unix timestamp） */
  expireAt: number;
}

/**
 * 快取 TTL（毫秒）
 * 預設 3 分鐘，帳戶設定短期內不會改變
 */
const CACHE_TTL_MS = 3 * 60 * 1000;

/**
 * 全局帳戶類型快取
 * Key 格式: ${exchange}:${apiKeyPrefix}
 * 例如: binance:Kj2uuAkE, okx:abc12345
 */
const accountTypeCache = new Map<string, AccountTypeCacheEntry>();

/**
 * 產生快取 key
 *
 * @param exchange - 交易所名稱
 * @param apiKey - API Key（使用前 8 字元作為識別）
 * @returns 快取 key
 */
export function buildAccountTypeCacheKey(exchange: string, apiKey: string): string {
  const prefix = apiKey.substring(0, 8);
  return `${exchange}:${prefix}`;
}

/**
 * 取得快取的帳戶類型資料
 *
 * @param exchange - 交易所名稱
 * @param apiKey - API Key
 * @returns 快取的帳戶類型資料，如果不存在或已過期則返回 null
 */
export function getCachedAccountType(
  exchange: string,
  apiKey: string
): AccountTypeCacheEntry | null {
  const key = buildAccountTypeCacheKey(exchange, apiKey);
  const entry = accountTypeCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expireAt) {
    // 快取過期，刪除並返回 null
    accountTypeCache.delete(key);
    logger.debug({ exchange, cacheKey: key }, 'Account type cache expired');
    return null;
  }

  logger.debug(
    { exchange, cacheKey: key, isPortfolioMargin: entry.isPortfolioMargin, isHedgeMode: entry.isHedgeMode },
    'Account type cache hit'
  );
  return entry;
}

/**
 * 設定帳戶類型快取
 *
 * @param exchange - 交易所名稱
 * @param apiKey - API Key
 * @param accountType - 帳戶類型資料
 * @param ttlMs - 快取 TTL（毫秒），預設 3 分鐘
 */
export function setCachedAccountType(
  exchange: string,
  apiKey: string,
  accountType: { isPortfolioMargin: boolean; isHedgeMode: boolean },
  ttlMs: number = CACHE_TTL_MS
): void {
  const key = buildAccountTypeCacheKey(exchange, apiKey);

  accountTypeCache.set(key, {
    isPortfolioMargin: accountType.isPortfolioMargin,
    isHedgeMode: accountType.isHedgeMode,
    expireAt: Date.now() + ttlMs,
  });

  logger.info(
    { exchange, cacheKey: key, ...accountType, ttlMs },
    'Account type cached'
  );
}

/**
 * 清除指定帳戶的快取
 *
 * @param exchange - 交易所名稱
 * @param apiKey - API Key
 */
export function clearCachedAccountType(exchange: string, apiKey: string): void {
  const key = buildAccountTypeCacheKey(exchange, apiKey);
  accountTypeCache.delete(key);
  logger.debug({ exchange, cacheKey: key }, 'Account type cache cleared');
}

/**
 * 清除指定交易所的所有帳戶快取
 *
 * @param exchange - 交易所名稱
 */
export function clearExchangeAccountTypeCache(exchange: string): void {
  const prefix = `${exchange}:`;
  for (const key of accountTypeCache.keys()) {
    if (key.startsWith(prefix)) {
      accountTypeCache.delete(key);
    }
  }
  logger.debug({ exchange }, 'All account type cache for exchange cleared');
}

/**
 * 清除所有帳戶類型快取
 */
export function clearAllAccountTypeCache(): void {
  accountTypeCache.clear();
  logger.info('All account type cache cleared');
}

/**
 * 取得快取統計資訊
 */
export function getAccountTypeCacheStats(): {
  size: number;
  entries: string[];
} {
  return {
    size: accountTypeCache.size,
    entries: Array.from(accountTypeCache.keys()),
  };
}

// 匯出 TTL 常數供測試使用
export const ACCOUNT_TYPE_CACHE_TTL_MS = CACHE_TTL_MS;
