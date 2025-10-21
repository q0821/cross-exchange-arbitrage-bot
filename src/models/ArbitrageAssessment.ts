/**
 * ArbitrageAssessment Model
 *
 * 套利評估結果模型（記憶體內）
 * Feature: 004-fix-okx-add-price-display
 */

import {
  ArbitrageAssessment as IArbitrageAssessment,
  ArbitrageFeasibility,
  RiskLevel,
} from '../types/service-interfaces';

/**
 * 建立套利評估結果
 */
export function createArbitrageAssessment(params: {
  symbol: string;
  binanceFundingRate: number;
  okxFundingRate: number;
  binancePrice: number;
  okxPrice: number;
  makerFee: number;
  takerFee: number;
  extremeSpreadThreshold: number;
}): IArbitrageAssessment {
  const {
    symbol,
    binanceFundingRate,
    okxFundingRate,
    binancePrice,
    okxPrice,
    makerFee,
    takerFee,
    extremeSpreadThreshold,
  } = params;

  // 1. 計算資金費率差異（絕對值）
  const fundingRateSpread = Math.abs(binanceFundingRate - okxFundingRate);

  // 2. 計算價格價差（百分比，絕對值）
  const priceSpread = Math.abs(binancePrice - okxPrice) / Math.min(binancePrice, okxPrice);

  // 3. 計算總手續費
  const totalFees = makerFee + takerFee;

  // 4. 計算淨收益
  // 淨收益 = 資金費率差異 - 價格價差 - 總手續費
  const netProfit = fundingRateSpread - priceSpread - totalFees;
  const netProfitPercent = netProfit * 100;

  // 5. 判斷套利方向
  let direction: string;
  if (binanceFundingRate > okxFundingRate) {
    direction = 'Binance 做多 + OKX 做空';
  } else {
    direction = 'OKX 做多 + Binance 做空';
  }

  // 6. 檢測極端價差
  const extremeSpreadDetected = priceSpread > extremeSpreadThreshold;

  // 7. 判斷可行性
  let feasibility: ArbitrageFeasibility;
  if (extremeSpreadDetected) {
    feasibility = 'HIGH_RISK';
  } else if (netProfit > 0) {
    feasibility = 'VIABLE';
  } else {
    feasibility = 'NOT_VIABLE';
  }

  // 8. 判斷風險等級
  let riskLevel: RiskLevel;
  let warningMessage: string | undefined;

  if (extremeSpreadDetected) {
    riskLevel = 'HIGH';
    warningMessage = `極端價差檢測: ${(priceSpread * 100).toFixed(2)}% (閾值: ${(extremeSpreadThreshold * 100).toFixed(0)}%)`;
  } else if (priceSpread > extremeSpreadThreshold * 0.5) {
    riskLevel = 'MEDIUM';
    warningMessage = `價差偏高: ${(priceSpread * 100).toFixed(2)}%`;
  } else {
    riskLevel = 'LOW';
  }

  return {
    symbol,
    timestamp: new Date(),
    binanceFundingRate,
    okxFundingRate,
    binancePrice,
    okxPrice,
    fundingRateSpread,
    priceSpread,
    totalFees,
    netProfit,
    netProfitPercent,
    direction,
    feasibility,
    riskLevel,
    extremeSpreadDetected,
    warningMessage,
  };
}

/**
 * 檢查套利機會是否可行
 */
export function isFeasible(assessment: IArbitrageAssessment): boolean {
  return assessment.feasibility === 'VIABLE';
}

/**
 * 檢查是否為高風險套利
 */
export function isHighRisk(assessment: IArbitrageAssessment): boolean {
  return assessment.feasibility === 'HIGH_RISK' || assessment.riskLevel === 'HIGH';
}

/**
 * 格式化套利可行性顯示
 */
export function formatFeasibility(feasibility: ArbitrageFeasibility): string {
  const feasibilityMap: Record<ArbitrageFeasibility, string> = {
    VIABLE: '✅ 可行',
    NOT_VIABLE: '❌ 不可行',
    HIGH_RISK: '⚠️ 高風險',
  };
  return feasibilityMap[feasibility];
}

/**
 * 格式化淨收益顯示
 */
export function formatNetProfit(netProfitPercent: number): string {
  const sign = netProfitPercent >= 0 ? '+' : '';
  return `${sign}${netProfitPercent.toFixed(3)}%`;
}

/**
 * 格式化風險等級顯示
 */
export function formatRiskLevel(riskLevel: RiskLevel): string {
  const riskMap: Record<RiskLevel, string> = {
    LOW: '🟢 低',
    MEDIUM: '🟡 中',
    HIGH: '🔴 高',
  };
  return riskMap[riskLevel];
}
