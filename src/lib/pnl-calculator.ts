/**
 * PnL Calculator
 *
 * 損益計算工具函數
 * Feature: 035-close-position
 */

import { Decimal } from 'decimal.js';

/**
 * 損益計算輸入參數
 */
export interface PnLCalculationInput {
  // 多頭資訊
  longEntryPrice: Decimal;
  longExitPrice: Decimal;
  longPositionSize: Decimal;
  longFee: Decimal;

  // 空頭資訊
  shortEntryPrice: Decimal;
  shortExitPrice: Decimal;
  shortPositionSize: Decimal;
  shortFee: Decimal;

  // 槓桿
  leverage: number;

  // 開倉時間
  openedAt: Date;
  closedAt: Date;

  // 資金費率損益（可選，預設為 0）
  fundingRatePnL?: Decimal;
}

/**
 * 損益計算結果
 */
export interface PnLCalculationResult {
  /** 價差損益 (USDT) */
  priceDiffPnL: Decimal;
  /** 資金費率損益 (USDT) */
  fundingRatePnL: Decimal;
  /** 總手續費 (USDT) */
  totalFees: Decimal;
  /** 總損益 (USDT) */
  totalPnL: Decimal;
  /** 投資報酬率 (%) */
  roi: Decimal;
  /** 持倉時間 (秒) */
  holdingDuration: number;
  /** 使用的保證金 */
  marginUsed: Decimal;
}

/**
 * 計算多頭損益
 */
export function calculateLongPnL(
  entryPrice: Decimal,
  exitPrice: Decimal,
  positionSize: Decimal,
): Decimal {
  // 多頭損益 = (平倉價 - 開倉價) * 倉位數量
  return exitPrice.minus(entryPrice).times(positionSize);
}

/**
 * 計算空頭損益
 */
export function calculateShortPnL(
  entryPrice: Decimal,
  exitPrice: Decimal,
  positionSize: Decimal,
): Decimal {
  // 空頭損益 = (開倉價 - 平倉價) * 倉位數量
  return entryPrice.minus(exitPrice).times(positionSize);
}

/**
 * 計算價差損益
 */
export function calculatePriceDiffPnL(
  longEntryPrice: Decimal,
  longExitPrice: Decimal,
  longPositionSize: Decimal,
  shortEntryPrice: Decimal,
  shortExitPrice: Decimal,
  shortPositionSize: Decimal,
): Decimal {
  const longPnL = calculateLongPnL(longEntryPrice, longExitPrice, longPositionSize);
  const shortPnL = calculateShortPnL(shortEntryPrice, shortExitPrice, shortPositionSize);
  return longPnL.plus(shortPnL);
}

/**
 * 計算使用的保證金
 */
export function calculateMarginUsed(
  longEntryPrice: Decimal,
  longPositionSize: Decimal,
  shortEntryPrice: Decimal,
  shortPositionSize: Decimal,
  leverage: number,
): Decimal {
  const longMargin = longEntryPrice.times(longPositionSize).div(leverage);
  const shortMargin = shortEntryPrice.times(shortPositionSize).div(leverage);
  return longMargin.plus(shortMargin);
}

/**
 * 計算投資報酬率 (ROI)
 */
export function calculateROI(totalPnL: Decimal, marginUsed: Decimal): Decimal {
  if (marginUsed.isZero()) {
    return new Decimal(0);
  }
  // ROI = 總損益 / 保證金 * 100
  return totalPnL.div(marginUsed).times(100);
}

/**
 * 計算持倉時間（秒）
 */
export function calculateHoldingDuration(openedAt: Date, closedAt: Date): number {
  const durationMs = closedAt.getTime() - openedAt.getTime();
  return Math.floor(durationMs / 1000);
}

/**
 * 格式化持倉時間為人類可讀格式
 */
export function formatHoldingDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分`);

  return parts.length > 0 ? parts.join(' ') : '少於 1 分鐘';
}

/**
 * 計算完整的損益資訊
 */
export function calculatePnL(input: PnLCalculationInput): PnLCalculationResult {
  const {
    longEntryPrice,
    longExitPrice,
    longPositionSize,
    longFee,
    shortEntryPrice,
    shortExitPrice,
    shortPositionSize,
    shortFee,
    leverage,
    openedAt,
    closedAt,
    fundingRatePnL = new Decimal(0),
  } = input;

  // 1. 計算價差損益
  const priceDiffPnL = calculatePriceDiffPnL(
    longEntryPrice,
    longExitPrice,
    longPositionSize,
    shortEntryPrice,
    shortExitPrice,
    shortPositionSize,
  );

  // 2. 計算總手續費
  const totalFees = longFee.plus(shortFee);

  // 3. 計算總損益
  const totalPnL = priceDiffPnL.plus(fundingRatePnL).minus(totalFees);

  // 4. 計算使用的保證金
  const marginUsed = calculateMarginUsed(
    longEntryPrice,
    longPositionSize,
    shortEntryPrice,
    shortPositionSize,
    leverage,
  );

  // 5. 計算 ROI
  const roi = calculateROI(totalPnL, marginUsed);

  // 6. 計算持倉時間
  const holdingDuration = calculateHoldingDuration(openedAt, closedAt);

  return {
    priceDiffPnL,
    fundingRatePnL,
    totalFees,
    totalPnL,
    roi,
    holdingDuration,
    marginUsed,
  };
}

/**
 * 估算平倉損益（用於確認對話框顯示）
 */
export function estimatePnL(
  longEntryPrice: number,
  longCurrentPrice: number,
  longPositionSize: number,
  shortEntryPrice: number,
  shortCurrentPrice: number,
  shortPositionSize: number,
  estimatedFeeRate: number = 0.0005, // 預設 0.05% 手續費
): {
  priceDiffPnL: number;
  estimatedFees: number;
  netPnL: number;
} {
  // 計算價差損益
  const longPnL = (longCurrentPrice - longEntryPrice) * longPositionSize;
  const shortPnL = (shortEntryPrice - shortCurrentPrice) * shortPositionSize;
  const priceDiffPnL = longPnL + shortPnL;

  // 估算手續費
  const longFee = longCurrentPrice * longPositionSize * estimatedFeeRate;
  const shortFee = shortCurrentPrice * shortPositionSize * estimatedFeeRate;
  const estimatedFees = longFee + shortFee;

  // 淨損益
  const netPnL = priceDiffPnL - estimatedFees;

  return {
    priceDiffPnL,
    estimatedFees,
    netPnL,
  };
}

export default {
  calculateLongPnL,
  calculateShortPnL,
  calculatePriceDiffPnL,
  calculateMarginUsed,
  calculateROI,
  calculateHoldingDuration,
  formatHoldingDuration,
  calculatePnL,
  estimatePnL,
};
