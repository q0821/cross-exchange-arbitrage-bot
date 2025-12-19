/**
 * Conditional Order Calculator
 *
 * 條件單觸發價格計算工具
 * Feature: 038-specify-scripts-bash
 */

import Decimal from 'decimal.js';
import type { TradeSide } from '../types/trading';

/**
 * 計算停損觸發價格
 *
 * Long 倉位: 停損價 = 開倉均價 × (1 - 停損百分比 / 100)
 * Short 倉位: 停損價 = 開倉均價 × (1 + 停損百分比 / 100)
 *
 * @param entryPrice 開倉均價
 * @param stopLossPercent 停損百分比 (0.5 - 50)
 * @param side 倉位方向
 * @returns 停損觸發價格
 */
export function calculateStopLossPrice(
  entryPrice: Decimal,
  stopLossPercent: number,
  side: TradeSide,
): Decimal {
  const percentMultiplier = new Decimal(stopLossPercent).dividedBy(100);

  if (side === 'LONG') {
    // Long 倉位: 價格下跌時觸發停損
    return entryPrice.times(new Decimal(1).minus(percentMultiplier));
  } else {
    // Short 倉位: 價格上漲時觸發停損
    return entryPrice.times(new Decimal(1).plus(percentMultiplier));
  }
}

/**
 * 計算停利觸發價格
 *
 * Long 倉位: 停利價 = 開倉均價 × (1 + 停利百分比 / 100)
 * Short 倉位: 停利價 = 開倉均價 × (1 - 停利百分比 / 100)
 *
 * @param entryPrice 開倉均價
 * @param takeProfitPercent 停利百分比 (0.5 - 100)
 * @param side 倉位方向
 * @returns 停利觸發價格
 */
export function calculateTakeProfitPrice(
  entryPrice: Decimal,
  takeProfitPercent: number,
  side: TradeSide,
): Decimal {
  const percentMultiplier = new Decimal(takeProfitPercent).dividedBy(100);

  if (side === 'LONG') {
    // Long 倉位: 價格上漲時觸發停利
    return entryPrice.times(new Decimal(1).plus(percentMultiplier));
  } else {
    // Short 倉位: 價格下跌時觸發停利
    return entryPrice.times(new Decimal(1).minus(percentMultiplier));
  }
}

/**
 * 計算條件單觸發價格（包含停損和停利）
 *
 * @param params 計算參數
 * @returns 觸發價格結果
 */
export interface TriggerPriceParams {
  entryPrice: Decimal;
  side: TradeSide;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface TriggerPriceResult {
  stopLossPrice?: Decimal;
  takeProfitPrice?: Decimal;
}

export function calculateTriggerPrices(params: TriggerPriceParams): TriggerPriceResult {
  const { entryPrice, side, stopLossPercent, takeProfitPercent } = params;
  const result: TriggerPriceResult = {};

  if (stopLossPercent !== undefined) {
    result.stopLossPrice = calculateStopLossPrice(entryPrice, stopLossPercent, side);
  }

  if (takeProfitPercent !== undefined) {
    result.takeProfitPrice = calculateTakeProfitPrice(entryPrice, takeProfitPercent, side);
  }

  return result;
}

/**
 * 格式化價格用於交易所 API
 * 根據交易對的價格精度進行四捨五入
 *
 * @param price 價格
 * @param precision 精度（小數位數）
 * @returns 格式化後的價格字串
 */
export function formatPriceForExchange(price: Decimal, precision: number = 8): string {
  return price.toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toString();
}

/**
 * 驗證停損價格是否有效
 * 確保停損價格與當前價格之間有足夠的距離，避免立即觸發
 *
 * @param stopLossPrice 停損觸發價格
 * @param currentPrice 當前市場價格
 * @param side 倉位方向
 * @param minDistancePercent 最小距離百分比（默認 0.1%）
 * @returns 是否有效
 */
export function isStopLossPriceValid(
  stopLossPrice: Decimal,
  currentPrice: Decimal,
  side: TradeSide,
  minDistancePercent: number = 0.1,
): boolean {
  const minDistance = currentPrice.times(new Decimal(minDistancePercent).dividedBy(100));

  if (side === 'LONG') {
    // Long 倉位: 停損價必須低於當前價格且有足夠距離
    return stopLossPrice.lessThan(currentPrice.minus(minDistance));
  } else {
    // Short 倉位: 停損價必須高於當前價格且有足夠距離
    return stopLossPrice.greaterThan(currentPrice.plus(minDistance));
  }
}

/**
 * 驗證停利價格是否有效
 * 確保停利價格與當前價格之間有足夠的距離，避免立即觸發
 *
 * @param takeProfitPrice 停利觸發價格
 * @param currentPrice 當前市場價格
 * @param side 倉位方向
 * @param minDistancePercent 最小距離百分比（默認 0.1%）
 * @returns 是否有效
 */
export function isTakeProfitPriceValid(
  takeProfitPrice: Decimal,
  currentPrice: Decimal,
  side: TradeSide,
  minDistancePercent: number = 0.1,
): boolean {
  const minDistance = currentPrice.times(new Decimal(minDistancePercent).dividedBy(100));

  if (side === 'LONG') {
    // Long 倉位: 停利價必須高於當前價格且有足夠距離
    return takeProfitPrice.greaterThan(currentPrice.plus(minDistance));
  } else {
    // Short 倉位: 停利價必須低於當前價格且有足夠距離
    return takeProfitPrice.lessThan(currentPrice.minus(minDistance));
  }
}
