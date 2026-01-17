/**
 * Open Interest Service
 * Feature: 010-open-interest-selection
 *
 * 提供 OI 資料獲取功能，設計為可被 Next.js API routes 安全引入
 * 不依賴 connectors/ 目錄，直接使用 axios 呼叫 Binance API
 */

import axios from 'axios';
import pLimit from 'p-limit';
import { oiCache } from '../lib/cache';
import { logger } from '../lib/logger';
import type { OpenInterestUSD, TradingPairRanking } from '../types/open-interest';

const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com';

/**
 * 獲取所有 USDT 永續合約交易對
 */
async function getUSDTPerpetualSymbols(): Promise<string[]> {
  const response = await axios.get(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/exchangeInfo`);
  const symbols = response.data.symbols
    .filter(
      (s: { quoteAsset: string; contractType: string; status: string }) =>
        s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL' && s.status === 'TRADING',
    )
    .map((s: { symbol: string }) => s.symbol);
  return symbols;
}

/**
 * 獲取單一交易對的 Open Interest
 */
async function getOpenInterestForSymbol(symbol: string): Promise<number> {
  try {
    const response = await axios.get(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/openInterest`, {
      params: { symbol },
    });
    return parseFloat(response.data.openInterest);
  } catch (error) {
    logger.warn({ symbol, error }, 'Failed to fetch OI for symbol');
    throw error;
  }
}

/**
 * 批量獲取標記價格
 */
async function getMarkPrices(symbols?: string[]): Promise<Map<string, number>> {
  const response = await axios.get(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/premiumIndex`);
  const allData = Array.isArray(response.data) ? response.data : [response.data];
  const filtered =
    symbols && symbols.length > 0
      ? allData.filter((item: { symbol: string }) => symbols.includes(item.symbol))
      : allData;

  const priceMap = new Map<string, number>();
  filtered.forEach((item: { symbol: string; markPrice: string }) => {
    priceMap.set(item.symbol, parseFloat(item.markPrice));
  });
  return priceMap;
}

/**
 * 批量獲取 Open Interest（限制並發數）
 */
async function getBatchOpenInterest(symbols: string[]): Promise<Map<string, number>> {
  const limit = pLimit(10); // 限制並發數為 10
  const oiMap = new Map<string, number>();

  const tasks = symbols.map((symbol) =>
    limit(async () => {
      try {
        const oi = await getOpenInterestForSymbol(symbol);
        oiMap.set(symbol, oi);
      } catch (_error) {
        // Skip failed symbols
      }
    }),
  );

  await Promise.all(tasks);
  return oiMap;
}

/**
 * 獲取所有交易對的 OI 排名資料
 */
async function getAllOpenInterest(): Promise<OpenInterestUSD[]> {
  const symbols = await getUSDTPerpetualSymbols();
  const [oiDataMap, markPrices] = await Promise.all([
    getBatchOpenInterest(symbols),
    getMarkPrices(symbols),
  ]);

  const results: OpenInterestUSD[] = [];
  for (const [symbol, oiContracts] of oiDataMap.entries()) {
    const markPrice = markPrices.get(symbol);
    if (!markPrice) continue;

    results.push({
      symbol,
      openInterestUSD: oiContracts * markPrice,
      openInterestContracts: oiContracts,
      markPrice,
      timestamp: Date.now(),
    });
  }

  return results;
}

/**
 * 從快取或 Binance API 獲取 OI 排名前 N 的交易對
 *
 * @param topN 前 N 個交易對
 * @param minOI 最小 OI 門檻（美元，可選）
 * @returns 交易對列表
 */
export async function getTopOISymbols(topN: number, minOI?: number): Promise<string[]> {
  try {
    // 1. 檢查快取
    const cached = oiCache.get(topN);
    if (cached) {
      logger.debug({ topN, cacheHit: true }, 'OI symbols from cache');
      return cached.rankings.map((r) => r.symbol);
    }

    // 2. 快取未命中，從 Binance API 獲取
    logger.info({ topN, cacheHit: false }, 'Fetching OI symbols from Binance');

    const allOI = await getAllOpenInterest();

    // 3. 過濾並排序
    let filtered = allOI;
    if (minOI !== undefined && minOI > 0) {
      filtered = allOI.filter((oi) => oi.openInterestUSD >= minOI);
    }

    const sorted = filtered.sort((a, b) => b.openInterestUSD - a.openInterestUSD);
    const topSymbols = sorted.slice(0, topN);

    // 4. 建立 TradingPairRanking 並儲存到快取
    const ranking: TradingPairRanking = {
      rankings: topSymbols,
      totalSymbols: allOI.length,
      topN,
      generatedAt: Date.now(),
    };

    oiCache.set(topN, ranking);

    logger.info(
      {
        topN,
        fetched: topSymbols.length,
        topSymbol: topSymbols[0]?.symbol,
      },
      'OI symbols fetched successfully',
    );

    return topSymbols.map((r) => r.symbol);
  } catch (error) {
    logger.error({ error, topN }, 'Failed to fetch OI symbols');
    // 發生錯誤時返回空陣列，讓前端顯示靜態配置的備份
    return [];
  }
}

/**
 * 檢查 OI 快取是否存在且有效
 */
export function hasValidOICache(topN: number): boolean {
  return oiCache.get(topN) !== null;
}

/**
 * 清除所有 OI 快取
 */
export function clearOICache(): void {
  oiCache.clear();
}
