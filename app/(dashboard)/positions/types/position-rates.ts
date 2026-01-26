/**
 * Position Rates Types
 * 持倉頁面即時資金費率相關類型定義
 *
 * Feature: 持倉管理頁面顯示即時資金費率
 */

import type { ExchangeName, ExchangeRateData, MarketRate } from '../../market-monitor/types';

/**
 * 單一交易所費率資訊
 */
export interface ExchangeRateInfo {
  name: ExchangeName;
  rate: number;
  /** 標準化後的費率（百分比） */
  ratePercent: number;
  /** 下次結算時間 */
  nextFundingTime: Date | null;
  /** 距離下次結算的毫秒數 */
  timeUntilNextFunding: number | null;
  /** 原始費率週期（小時），如 8 表示每 8 小時結算一次 */
  originalInterval: number | null;
  /** 標準化為 1 小時的費率（百分比） */
  normalized1hPercent: number | null;
}

/**
 * 單一持倉的即時費率資訊
 */
export interface PositionRateInfo {
  /** 交易對符號 */
  symbol: string;
  /** 做多交易所費率資訊 */
  longExchange: ExchangeRateInfo | null;
  /** 做空交易所費率資訊 */
  shortExchange: ExchangeRateInfo | null;
  /** 費率差（做空 - 做多，正值表示有利） */
  spreadPercent: number | null;
  /** 費率差方向是否有利 */
  isFavorable: boolean | null;
  /** 最後更新時間 */
  lastUpdated: Date;
}

/**
 * 從 ExchangeRateData 提取交易所費率資訊
 */
function extractExchangeRateInfo(
  exchangeName: string,
  data: ExchangeRateData,
  now: number
): ExchangeRateInfo {
  return {
    name: exchangeName as ExchangeName,
    rate: data.rate,
    ratePercent: data.rate * 100,
    nextFundingTime: data.nextFundingTime ? new Date(data.nextFundingTime) : null,
    timeUntilNextFunding: data.nextFundingTime
      ? new Date(data.nextFundingTime).getTime() - now
      : null,
    originalInterval: data.originalInterval ?? null,
    normalized1hPercent: data.normalized?.['1h'] != null
      ? data.normalized['1h'] * 100
      : null,
  };
}

/**
 * 從 MarketRate 提取特定持倉的費率資訊
 */
export function extractPositionRateInfo(
  marketRate: MarketRate,
  longExchangeName: string,
  shortExchangeName: string
): PositionRateInfo {
  const longData = marketRate.exchanges[longExchangeName] as ExchangeRateData | undefined;
  const shortData = marketRate.exchanges[shortExchangeName] as ExchangeRateData | undefined;

  const now = Date.now();

  const longExchange = longData
    ? extractExchangeRateInfo(longExchangeName, longData, now)
    : null;

  const shortExchange = shortData
    ? extractExchangeRateInfo(shortExchangeName, shortData, now)
    : null;

  // 計算費率差：做空費率 - 做多費率
  // 正值表示「有利」（做空收取費用 > 做多支付費用）
  let spreadPercent: number | null = null;
  let isFavorable: boolean | null = null;

  if (longExchange && shortExchange) {
    spreadPercent = (shortExchange.rate - longExchange.rate) * 100;
    // 當費率差 > 0 時，表示做空端費率較高（收取費用多），策略有利
    isFavorable = spreadPercent > 0;
  }

  return {
    symbol: marketRate.symbol,
    longExchange,
    shortExchange,
    spreadPercent,
    isFavorable,
    lastUpdated: new Date(marketRate.timestamp),
  };
}

/**
 * 格式化倒計時顯示
 * @param ms 毫秒數
 * @returns 格式化字串，如 "2h 15m" 或 "45m" 或 "已結算"
 */
export function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) {
    return '已結算';
  }

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * 格式化費率百分比顯示
 * @param rate 費率（如 0.0001 表示 0.01%）
 * @returns 格式化字串，如 "+0.0100%" 或 "-0.0050%"
 */
export function formatRatePercent(rate: number): string {
  const percent = rate * 100;
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(4)}%`;
}
