/**
 * PriceData Model
 *
 * 即時價格數據模型（記憶體內）
 * Feature: 004-fix-okx-add-price-display
 */

import { PriceData as IPriceData, Exchange, PriceSource } from '../types/service-interfaces';

/**
 * 建立新的價格數據物件
 */
export function createPriceData(params: {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h?: number;
  source: PriceSource;
  latencyMs?: number;
}): IPriceData {
  return {
    id: `${params.exchange}:${params.symbol}:${Date.now()}`,
    timestamp: new Date(),
    ...params,
  };
}

/**
 * 計算價格的中間價 (Mid Price)
 */
export function calculateMidPrice(priceData: IPriceData): number {
  return (priceData.bidPrice + priceData.askPrice) / 2;
}

/**
 * 檢查價格數據是否過期
 * @param priceData 價格數據
 * @param staleThresholdMs 過期時間閾值（毫秒）
 */
export function isPriceStale(priceData: IPriceData, staleThresholdMs: number): boolean {
  const now = Date.now();
  const priceTime = priceData.timestamp.getTime();
  return (now - priceTime) > staleThresholdMs;
}

/**
 * 計算價格延遲（秒）
 */
export function calculatePriceDelay(priceData: IPriceData): number {
  const now = Date.now();
  const priceTime = priceData.timestamp.getTime();
  return Math.floor((now - priceTime) / 1000);
}

/**
 * 格式化價格顯示（保留 2 位小數）
 */
export function formatPrice(price: number): string {
  return price.toFixed(2);
}

/**
 * 格式化價差百分比
 */
export function formatPriceSpreadPercent(spread: number): string {
  return (spread * 100).toFixed(3) + '%';
}
