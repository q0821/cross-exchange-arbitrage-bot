/**
 * 費率計算工具函數
 *
 * 根據用戶選擇的時間基準重新計算最佳套利對
 * Feature 019: 修復費率差異根據時間基準動態計算
 * Feature 022: 年化收益門檻套利機會偵測
 */

import type {
  MarketRate,
  ExchangeRateData,
  BestArbitragePair,
  ExchangeName,
  TimeBasis,
} from '../types';

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
 * @param rate 原始市場費率數據
 * @param timeBasis 目標時間基準（1, 4, 8, 24 小時）
 * @returns 更新後的市場費率數據（包含重新計算的 bestPair）
 */
export function recalculateBestPair(
  rate: MarketRate,
  timeBasis: TimeBasis
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

  // 確定狀態（Feature 022: 使用年化收益門檻）
  let status: 'opportunity' | 'approaching' | 'normal' = 'normal';
  if (bestPair) {
    const annualizedReturn = bestPair.annualizedReturn;
    if (annualizedReturn >= DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED) {
      status = 'opportunity';
    } else if (annualizedReturn >= DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED) {
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
 * @param rates 費率陣列
 * @param timeBasis 目標時間基準
 * @returns 更新後的費率陣列
 */
export function recalculateAllBestPairs(
  rates: MarketRate[],
  timeBasis: TimeBasis
): MarketRate[] {
  return rates.map((rate) => recalculateBestPair(rate, timeBasis));
}
