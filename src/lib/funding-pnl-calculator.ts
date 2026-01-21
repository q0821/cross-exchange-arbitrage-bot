/**
 * Funding PnL Calculator
 *
 * Feature: 067-position-exit-monitor
 *
 * 計算持倉的累計資金費率收益
 * - 查詢雙邊交易所的資金費率結算記錄
 * - 實作 5 分鐘 TTL 快取機制
 * - 更新 Position.cachedFundingPnL 欄位
 */

import { Decimal } from 'decimal.js';
import type { Position } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createExchangeConnector } from '@/lib/exchange-connector-factory';

/**
 * 資金費率記錄
 */
interface FundingFeeEntry {
  amount: number;
  timestamp: number;
}

/**
 * API Key 資訊
 */
interface ApiKeyInfo {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
}

/**
 * 快取 TTL（5 分鐘）
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 判斷快取是否有效
 *
 * @param cachedAt - 快取時間
 * @param ttl - TTL（毫秒）
 * @returns 快取是否有效
 */
export function isCacheValid(
  cachedAt: Date | null | undefined,
  ttl: number = CACHE_TTL_MS
): boolean {
  if (!cachedAt) return false;
  const now = Date.now();
  const cacheTime = cachedAt.getTime();
  return now - cacheTime < ttl;
}

/**
 * 計算資金費率記錄的總和
 *
 * @param entries - 資金費率記錄陣列
 * @returns 總和（Decimal）
 */
export function calculateTotalFundingPnL(entries: FundingFeeEntry[]): Decimal {
  return entries.reduce(
    (sum, entry) => sum.plus(new Decimal(entry.amount)),
    new Decimal(0)
  );
}

/**
 * 查詢交易所的資金費率歷史
 *
 * @param exchange - 交易所名稱
 * @param symbol - 交易對符號
 * @param since - 開始時間（毫秒）
 * @param apiKey - API Key 資訊
 * @returns 資金費率記錄陣列
 */
async function fetchFundingHistory(
  exchange: string,
  symbol: string,
  since: number,
  apiKey: ApiKeyInfo
): Promise<FundingFeeEntry[]> {
  const connector = createExchangeConnector(exchange, {
    apiKey: apiKey.apiKey,
    apiSecret: apiKey.apiSecret,
    passphrase: apiKey.passphrase,
    isTestnet: apiKey.isTestnet,
  });

  // 使用 CCXT fetchFundingHistory
  const history = await connector.fetchFundingHistory(symbol, { since });

  return history.map((entry: any) => ({
    amount: entry.amount || 0,
    timestamp: entry.timestamp || Date.now(),
  }));
}

/**
 * 取得持倉的累計資金費率收益
 *
 * 實作邏輯：
 * 1. 檢查快取是否有效（5 分鐘 TTL）
 * 2. 如果快取有效，直接返回快取值
 * 3. 如果快取無效或不存在，查詢雙邊交易所的資金費率歷史
 * 4. 計算總和並更新快取
 *
 * @param position - 持倉資料
 * @param apiKeys - 用戶的 API Key 資訊（按交易所名稱索引）
 * @returns 累計資金費率收益（Decimal）
 */
export async function getCumulativeFundingPnL(
  position: Position,
  apiKeys: Record<string, ApiKeyInfo>
): Promise<Decimal> {
  // 檢查快取
  if (
    position.cachedFundingPnL !== null &&
    isCacheValid(position.cachedFundingPnLUpdatedAt, CACHE_TTL_MS)
  ) {
    logger.debug(
      { positionId: position.id },
      '[Feature 067] Using cached funding PnL'
    );
    return new Decimal(position.cachedFundingPnL.toString());
  }

  // 驗證 API Keys
  const longApiKey = apiKeys[position.longExchange];
  const shortApiKey = apiKeys[position.shortExchange];

  if (!longApiKey) {
    throw new Error(`Missing API key for exchange: ${position.longExchange}`);
  }
  if (!shortApiKey) {
    throw new Error(`Missing API key for exchange: ${position.shortExchange}`);
  }

  // 查詢雙邊資金費率歷史
  if (!position.openedAt) {
    throw new Error('Position openedAt is required for funding PnL calculation');
  }
  const since = position.openedAt.getTime();

  logger.debug(
    {
      positionId: position.id,
      symbol: position.symbol,
      longExchange: position.longExchange,
      shortExchange: position.shortExchange,
      since: new Date(since).toISOString(),
    },
    '[Feature 067] Fetching funding history'
  );

  // 並行查詢雙邊
  const [longHistory, shortHistory] = await Promise.all([
    fetchFundingHistory(
      position.longExchange,
      position.symbol,
      since,
      longApiKey
    ),
    fetchFundingHistory(
      position.shortExchange,
      position.symbol,
      since,
      shortApiKey
    ),
  ]);

  // 計算總和
  const longTotal = calculateTotalFundingPnL(longHistory);
  const shortTotal = calculateTotalFundingPnL(shortHistory);
  const total = longTotal.plus(shortTotal);

  logger.debug(
    {
      positionId: position.id,
      longTotal: longTotal.toNumber(),
      shortTotal: shortTotal.toNumber(),
      total: total.toNumber(),
      longEntries: longHistory.length,
      shortEntries: shortHistory.length,
    },
    '[Feature 067] Calculated funding PnL'
  );

  // 更新快取
  await prisma.position.update({
    where: { id: position.id },
    data: {
      cachedFundingPnL: total,
      cachedFundingPnLUpdatedAt: new Date(),
    },
  });

  return total;
}
