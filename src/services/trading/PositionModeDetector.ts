/**
 * Position Mode Detector
 *
 * 偵測交易所帳戶的持倉模式（單向/雙向）
 * 使用 CCXT 統一的 fetchPositionMode 方法
 */

import { logger } from '../../lib/logger';
import type { SupportedExchange } from '../../lib/ccxt-factory';

/**
 * 持倉模式類型
 */
export interface PositionModeResult {
  /** 是否為雙向持倉模式（Hedge Mode） */
  hedged: boolean;
  /** 是否為單向持倉模式（One-way Mode） */
  oneWay: boolean;
}

/**
 * 快取的持倉模式
 * Key: `${exchangeId}:${userId}` 或 `${exchangeId}:${apiKeyHash}`
 */
const positionModeCache = new Map<string, PositionModeResult>();

/**
 * 快取 TTL（5 分鐘）
 * 持倉模式通常不會頻繁變動
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 快取過期時間記錄
 */
const cacheExpiry = new Map<string, number>();

/**
 * 偵測交易所帳戶的持倉模式
 *
 * 使用 CCXT 的 fetchPositionMode 方法查詢
 * 支援 Binance、OKX、BingX、Gate.io、MEXC
 *
 * @param exchange - CCXT 交易所實例
 * @param exchangeId - 交易所 ID
 * @param symbol - 交易對符號（部分交易所需要）
 * @param cacheKey - 快取鍵值（用於區分不同用戶）
 * @returns 持倉模式結果
 */
export async function detectPositionMode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchange: any,
  exchangeId: SupportedExchange,
  symbol: string,
  cacheKey?: string,
): Promise<PositionModeResult> {
  // 檢查快取
  const key = cacheKey || exchangeId;
  const cached = positionModeCache.get(key);
  const expiry = cacheExpiry.get(key);

  if (cached && expiry && Date.now() < expiry) {
    logger.debug({ exchangeId, cached }, 'Position mode cache hit');
    return cached;
  }

  try {
    // 檢查交易所是否支援 fetchPositionMode
    if (!exchange.has['fetchPositionMode']) {
      logger.warn(
        { exchangeId },
        'Exchange does not support fetchPositionMode, assuming hedge mode',
      );
      return { hedged: true, oneWay: false };
    }

    // 調用 CCXT fetchPositionMode
    const result = await exchange.fetchPositionMode(symbol);

    const positionMode: PositionModeResult = {
      hedged: result.hedged === true,
      oneWay: result.hedged === false,
    };

    // 更新快取
    positionModeCache.set(key, positionMode);
    cacheExpiry.set(key, Date.now() + CACHE_TTL_MS);

    logger.info(
      { exchangeId, symbol, positionMode },
      'Detected position mode',
    );

    return positionMode;
  } catch (error) {
    logger.warn(
      { exchangeId, symbol, error },
      'Failed to detect position mode, assuming hedge mode',
    );
    // 預設使用雙向持倉模式（較安全的預設值）
    return { hedged: true, oneWay: false };
  }
}

/**
 * 清除持倉模式快取
 *
 * @param cacheKey - 快取鍵值，如不提供則清除所有
 */
export function clearPositionModeCache(cacheKey?: string): void {
  if (cacheKey) {
    positionModeCache.delete(cacheKey);
    cacheExpiry.delete(cacheKey);
    logger.debug({ cacheKey }, 'Position mode cache cleared');
  } else {
    positionModeCache.clear();
    cacheExpiry.clear();
    logger.debug('All position mode cache cleared');
  }
}

/**
 * 根據持倉模式和交易方向，取得正確的 positionSide 參數
 *
 * @param exchangeId - 交易所 ID
 * @param side - 交易方向（buy=開多, sell=開空）
 * @param isHedgeMode - 是否為雙向持倉模式
 * @returns 訂單參數
 */
export function getPositionSideParams(
  exchangeId: SupportedExchange,
  side: 'buy' | 'sell',
  isHedgeMode: boolean,
): Record<string, unknown> {
  // OKX 使用不同的參數名稱
  if (exchangeId === 'okx') {
    if (isHedgeMode) {
      // 雙向模式：posSide = 'long' 或 'short'
      return {
        posSide: side === 'buy' ? 'long' : 'short',
        tdMode: 'cross',
      };
    } else {
      // 單向模式：posSide = 'net'
      return {
        posSide: 'net',
        tdMode: 'cross',
      };
    }
  }

  // Binance, BingX, MEXC, Gate.io 使用 positionSide
  if (isHedgeMode) {
    // 雙向模式：positionSide = 'LONG' 或 'SHORT'
    return {
      positionSide: side === 'buy' ? 'LONG' : 'SHORT',
    };
  } else {
    // 單向模式：positionSide = 'BOTH'（或不傳，使用 reduceOnly）
    // BingX 單向模式需要明確傳 'BOTH'
    if (exchangeId === 'bingx') {
      return { positionSide: 'BOTH' };
    }
    // 其他交易所單向模式不需要 positionSide
    return {};
  }
}

/**
 * 根據持倉模式和原始持倉方向，取得平倉的 positionSide 參數
 *
 * @param exchangeId - 交易所 ID
 * @param originalSide - 原始開倉方向（buy=多倉, sell=空倉）
 * @param isHedgeMode - 是否為雙向持倉模式
 * @returns 訂單參數
 */
export function getClosePositionSideParams(
  exchangeId: SupportedExchange,
  originalSide: 'buy' | 'sell',
  isHedgeMode: boolean,
): Record<string, unknown> {
  // OKX 使用不同的參數名稱
  if (exchangeId === 'okx') {
    if (isHedgeMode) {
      // 雙向模式：平多倉用 posSide='long'，平空倉用 posSide='short'
      return {
        posSide: originalSide === 'buy' ? 'long' : 'short',
        tdMode: 'cross',
      };
    } else {
      // 單向模式：posSide = 'net'
      return {
        posSide: 'net',
        tdMode: 'cross',
        reduceOnly: true,
      };
    }
  }

  // Binance, BingX, MEXC, Gate.io
  if (isHedgeMode) {
    // 雙向模式：平多倉用 positionSide='LONG'，平空倉用 positionSide='SHORT'
    return {
      positionSide: originalSide === 'buy' ? 'LONG' : 'SHORT',
    };
  } else {
    // 單向模式
    if (exchangeId === 'bingx') {
      return { positionSide: 'BOTH', reduceOnly: true };
    }
    return { reduceOnly: true };
  }
}
