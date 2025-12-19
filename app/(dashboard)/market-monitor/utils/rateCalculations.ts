/**
 * 費率計算工具函數
 *
 * 根據用戶選擇的時間基準重新計算最佳套利對
 * Feature 019: 修復費率差異根據時間基準動態計算
 * Feature 022: 年化收益門檻套利機會偵測
 * Feature 036: 可配置年化收益門檻
 */

import type {
  MarketRate,
  ExchangeRateData,
  BestArbitragePair,
  ExchangeName,
  TimeBasis,
} from '../types';
import type { PaybackResult } from '../types/payback';

// ============================================================================
// 年化收益門檻常數 (Feature 022)
// ============================================================================

/**
 * 預設年化收益門檻（百分比）
 * 當年化收益 >= 此值時，判定為套利機會
 */
export const DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED = 800;

/**
 * 「接近機會」門檻比例（主門檻的 75%）
 */
export const APPROACHING_THRESHOLD_RATIO = 0.75;

/**
 * 預設「接近機會」門檻
 * 800 × 0.75 = 600
 */
export const DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED =
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED * APPROACHING_THRESHOLD_RATIO;

/**
 * 根據時間基準獲取標準化費率
 *
 * @param exchangeData 交易所費率數據
 * @param timeBasis 目標時間基準（1, 4, 8, 24 小時）
 * @returns 標準化後的費率或原始費率
 */
function getNormalizedRate(
  exchangeData: ExchangeRateData,
  timeBasis: TimeBasis
): number {
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
  const normalized = exchangeData.normalized?.[timeBasisKey];
  const originalInterval = exchangeData.originalInterval;

  // 規則 1: 優先使用標準化值（如果存在且需要標準化）
  if (
    normalized !== undefined &&
    normalized !== null &&
    originalInterval &&
    originalInterval !== timeBasis
  ) {
    return normalized;
  }

  // 規則 2: 如果原始週期等於目標時間基準，直接使用原始費率
  if (originalInterval === timeBasis) {
    return exchangeData.rate;
  }

  // 規則 3: 降級處理 - 即時計算標準化值
  if (originalInterval && originalInterval !== timeBasis) {
    const originalRate = exchangeData.rate;
    // 標準化公式：rate_new = rate_original * (interval_target / interval_original)
    return originalRate * (timeBasis / originalInterval);
  }

  // 規則 4: 最後降級 - 返回原始費率並記錄警告
  console.warn(
    '[getNormalizedRate] Missing normalization data, using original rate',
    {
      timeBasis,
      originalInterval,
      rate: exchangeData.rate,
    }
  );
  return exchangeData.rate;
}

/**
 * 計算兩個交易所之間的價差百分比
 *
 * @param data1 第一個交易所的數據
 * @param data2 第二個交易所的數據
 * @param isLongEx1 第一個交易所是否為做多方
 * @returns 價差百分比或 null
 */
function calculatePriceDiff(
  data1: ExchangeRateData,
  data2: ExchangeRateData,
  isLongEx1: boolean
): number | null {
  const price1 = data1.price;
  const price2 = data2.price;

  if (!price1 || !price2) {
    return null;
  }

  const avgPrice = (price1 + price2) / 2;
  // 價差方向：做空的交易所價格 - 做多的交易所價格
  const shortPrice = isLongEx1 ? price2 : price1;
  const longPrice = isLongEx1 ? price1 : price2;

  return ((shortPrice - longPrice) / avgPrice) * 100;
}

/**
 * 根據時間基準重新計算最佳套利對
 *
 * 此函數會遍歷所有交易所對，找出利差最大的兩個交易所，
 * 並計算對應的費率差、年化收益等資訊。
 *
 * Feature 036: 新增可配置年化收益門檻參數
 *
 * @param rate 原始市場費率數據
 * @param timeBasis 目標時間基準（1, 4, 8, 24 小時）
 * @param opportunityThreshold 可選的年化收益門檻（預設 800%）
 * @returns 更新後的市場費率數據（包含重新計算的 bestPair）
 */
export function recalculateBestPair(
  rate: MarketRate,
  timeBasis: TimeBasis,
  opportunityThreshold: number = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
): MarketRate {
  const exchangeNames = Object.keys(rate.exchanges) as ExchangeName[];

  // 至少需要 2 個交易所才能計算套利
  if (exchangeNames.length < 2) {
    return {
      ...rate,
      bestPair: null,
      status: 'normal',
    };
  }

  let maxSpread = 0;
  let bestPair: BestArbitragePair | null = null;

  // 計算所有交易所兩兩之間的利差
  for (let i = 0; i < exchangeNames.length; i++) {
    for (let j = i + 1; j < exchangeNames.length; j++) {
      const ex1 = exchangeNames[i] as ExchangeName;
      const ex2 = exchangeNames[j] as ExchangeName;
      const data1 = rate.exchanges[ex1];
      const data2 = rate.exchanges[ex2];

      if (!data1 || !data2) continue;

      // 獲取標準化費率
      const rate1 = getNormalizedRate(data1, timeBasis);
      const rate2 = getNormalizedRate(data2, timeBasis);
      const spread = Math.abs(rate1 - rate2);

      if (spread > maxSpread) {
        maxSpread = spread;

        // 確定做多和做空的交易所
        // 費率高的交易所做空（支付資金費率），費率低的交易所做多（收取資金費率）
        const longExchange: ExchangeName = rate1 > rate2 ? ex2 : ex1;
        const shortExchange: ExchangeName = rate1 > rate2 ? ex1 : ex2;
        const isLongEx1 = longExchange === ex1;

        // 計算價差百分比
        const priceDiffPercent = calculatePriceDiff(data1, data2, isLongEx1);

        // 計算年化收益
        // 年化 = 利差 × 每年結算次數
        // 每年結算次數 = 365 天 × (24 小時 / 時間基準)
        const settlementsPerYear = 365 * (24 / timeBasis);
        const annualizedReturn = spread * settlementsPerYear * 100;

        bestPair = {
          longExchange,
          shortExchange,
          spread: spread,
          spreadPercent: spread * 100,
          annualizedReturn,
          priceDiffPercent,
        };
      }
    }
  }

  // 確定狀態（Feature 022/036: 使用可配置年化收益門檻）
  // 接近門檻 = 主門檻 × 75%
  const approachingThreshold = opportunityThreshold * APPROACHING_THRESHOLD_RATIO;
  let status: 'opportunity' | 'approaching' | 'normal' = 'normal';
  if (bestPair) {
    const annualizedReturn = bestPair.annualizedReturn;
    if (annualizedReturn >= opportunityThreshold) {
      status = 'opportunity';
    } else if (annualizedReturn >= approachingThreshold) {
      status = 'approaching';
    }
  }

  return {
    ...rate,
    bestPair,
    status,
  };
}

/**
 * 批量重新計算所有費率的最佳套利對
 *
 * Feature 036: 新增可配置年化收益門檻參數
 *
 * @param rates 費率陣列
 * @param timeBasis 目標時間基準
 * @param opportunityThreshold 可選的年化收益門檻（預設 800%）
 * @returns 更新後的費率陣列
 */
export function recalculateAllBestPairs(
  rates: MarketRate[],
  timeBasis: TimeBasis,
  opportunityThreshold: number = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
): MarketRate[] {
  return rates.map((rate) => recalculateBestPair(rate, timeBasis, opportunityThreshold));
}

// ============================================================================
// 價差回本週期指標 (Feature 025)
// ============================================================================

/**
 * 格式化回本計算公式說明
 *
 * @param priceDiff 價差百分比
 * @param rateSpread 費率差百分比
 * @param periods 回本次數
 * @param status 回本狀態
 * @returns 格式化的公式說明
 */
function formatPaybackFormula(
  priceDiff: number | null,
  rateSpread: number,
  periods: number | undefined,
  status: PaybackResult['status']
): string {
  if (status === 'favorable') {
    return '價差有利表示建倉即有正報酬，無需等待資費收取';
  }

  if (status === 'no_data') {
    return '無價格數據，無法計算回本次數';
  }

  if (status === 'impossible') {
    return '費率差為零，無法透過收取資費來回本';
  }

  if (status === 'payback_needed' && periods !== undefined && priceDiff !== null) {
    const absPriceDiff = Math.abs(priceDiff).toFixed(2);
    const formattedSpread = typeof rateSpread === 'number' ? rateSpread.toFixed(2) : String(rateSpread);
    const formattedPeriods = periods.toFixed(1);
    return `回本次數 = |價差| ÷ 費率差 = ${absPriceDiff}% ÷ ${formattedSpread}% = ${formattedPeriods} 次`;
  }

  if (status === 'too_many' && periods !== undefined && priceDiff !== null) {
    const absPriceDiff = Math.abs(priceDiff).toFixed(2);
    const formattedSpread = typeof rateSpread === 'number' ? rateSpread.toFixed(2) : String(rateSpread);
    return `回本次數 = ${absPriceDiff}% ÷ ${formattedSpread}% = ${Math.floor(periods)} 次`;
  }

  return '無法計算回本資訊';
}

/**
 * 計算價差回本次數
 *
 * 此函數判斷套利機會的價差方向，並計算需要多少次資金費率結算才能回本。
 *
 * Feature 025: 價差回本週期指標
 *
 * @param priceDiffPercent 價差百分比（來自 BestArbitragePair.priceDiffPercent）
 *   - 正值：價差有利（做空價 > 做多價）
 *   - 負值：價差不利（做空價 < 做多價）
 *   - null：無價格數據
 *
 * @param spreadPercent 費率差異百分比（來自 BestArbitragePair.spreadPercent）
 *   - 必須為正數
 *   - 若為 0，表示無法回本
 *
 * @param timeBasis 時間基準（小時）
 *   - 可能值：1 | 4 | 8 | 24
 *   - 用於計算預估回本時間
 *
 * @returns PaybackResult - 計算結果物件
 *
 * @example
 * // 情境 1：價差不利，需回本
 * calculatePaybackPeriods(-0.15, 0.05, 8)
 * // => { status: 'payback_needed', periods: 3.0, displayText: '⚠️ 需 3.0 次資費回本', ... }
 *
 * // 情境 2：價差有利
 * calculatePaybackPeriods(0.10, 0.03, 8)
 * // => { status: 'favorable', displayText: '✓ 價差有利', color: 'green', ... }
 *
 * // 情境 3：無價格數據
 * calculatePaybackPeriods(null, 0.05, 8)
 * // => { status: 'no_data', displayText: 'N/A（無價格數據）', color: 'gray', ... }
 */
export function calculatePaybackPeriods(
  priceDiffPercent: number | null,
  spreadPercent: number,
  timeBasis: TimeBasis
): PaybackResult {
  // Edge Case 1: 無價格數據（null 或 NaN）
  if (
    priceDiffPercent === null ||
    priceDiffPercent === undefined ||
    Number.isNaN(priceDiffPercent)
  ) {
    return {
      status: 'no_data',
      displayText: 'N/A（無價格數據）',
      color: 'gray',
    };
  }

  // Edge Case 2: 價差有利（>=0）
  if (priceDiffPercent >= 0) {
    return {
      status: 'favorable',
      displayText: '✓ 價差有利',
      color: 'green',
      details: {
        priceDiff: priceDiffPercent,
        rateSpread: spreadPercent,
        formula: formatPaybackFormula(priceDiffPercent, spreadPercent, undefined, 'favorable'),
      },
    };
  }

  // Edge Case 3: 費率差為零或負數（無法回本）
  const effectiveSpread = Math.abs(spreadPercent);
  if (effectiveSpread === 0 || spreadPercent < 0) {
    return {
      status: 'impossible',
      displayText: '無法回本（費率差為零）',
      color: 'red',
      details: {
        priceDiff: priceDiffPercent,
        rateSpread: spreadPercent,
        formula: formatPaybackFormula(priceDiffPercent, spreadPercent, undefined, 'impossible'),
      },
    };
  }

  // 計算回本次數
  const absPriceDiff = Math.abs(priceDiffPercent);
  const periods = parseFloat((absPriceDiff / effectiveSpread).toFixed(1));
  const estimatedHours = parseFloat((periods * timeBasis).toFixed(1));

  // Edge Case 4: 回本次數過多（> 100）
  if (periods > 100) {
    return {
      status: 'too_many',
      periods,
      estimatedHours,
      displayText: `❌ 回本次數過多 (${Math.floor(periods)}+ 次)`,
      color: 'red',
      details: {
        priceDiff: priceDiffPercent,
        rateSpread: spreadPercent,
        formula: formatPaybackFormula(priceDiffPercent, spreadPercent, periods, 'too_many'),
        warning: '⚠️ 注意：回本次數過多，費率可能在持倉期間波動，風險較高',
      },
    };
  }

  // 正常情況：需要回本（1-100 次）
  return {
    status: 'payback_needed',
    periods,
    estimatedHours,
    displayText: `⚠️ 需 ${periods.toFixed(1)} 次資費回本`,
    color: 'orange',
    details: {
      priceDiff: priceDiffPercent,
      rateSpread: spreadPercent,
      formula: formatPaybackFormula(priceDiffPercent, spreadPercent, periods, 'payback_needed'),
    },
  };
}
