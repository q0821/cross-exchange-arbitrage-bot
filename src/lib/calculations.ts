/**
 * 年化收益計算輔助函數
 *
 * Feature 022: 年化收益門檻套利機會偵測
 */

import { DAYS_PER_YEAR, HOURS_PER_DAY } from './constants';

/**
 * 計算年化收益
 *
 * 公式：annualizedReturn = spread × 365 × (24 / timeBasis) × 100
 *
 * @param spread 標準化利差（小數形式，如 0.005 表示 0.5%）
 * @param timeBasis 時間基準（小時），如 1, 4, 8, 24
 * @returns 年化收益百分比（如 800 表示 800%）
 *
 * @example
 * // 8 小時基準，利差 0.5%
 * calculateAnnualizedReturn(0.005, 8) // => 547.5
 *
 * // 1 小時基準，利差 0.0625%
 * calculateAnnualizedReturn(0.000625, 1) // => 547.5
 */
export function calculateAnnualizedReturn(
  spread: number,
  timeBasis: number
): number {
  // 每年結算次數 = 365 天 × (24 小時 / 時間基準)
  const settlementsPerYear = DAYS_PER_YEAR * (HOURS_PER_DAY / timeBasis);

  // 年化收益 = 利差 × 結算次數 × 100（轉換為百分比）
  return spread * settlementsPerYear * 100;
}

/**
 * 從利差百分比計算年化收益
 *
 * @param spreadPercent 利差百分比（如 0.5 表示 0.5%）
 * @param timeBasis 時間基準（小時）
 * @returns 年化收益百分比
 *
 * @example
 * // 8 小時基準，利差 0.5%
 * calculateAnnualizedReturnFromPercent(0.5, 8) // => 547.5
 */
export function calculateAnnualizedReturnFromPercent(
  spreadPercent: number,
  timeBasis: number
): number {
  // 將百分比轉換為小數
  const spread = spreadPercent / 100;
  return calculateAnnualizedReturn(spread, timeBasis);
}

/**
 * 判斷是否為套利機會（基於年化收益門檻）
 *
 * @param annualizedReturn 年化收益百分比
 * @param threshold 門檻（年化收益百分比，預設 800）
 * @returns 是否達到門檻
 *
 * @example
 * isOpportunityByAnnualized(850, 800) // => true
 * isOpportunityByAnnualized(700, 800) // => false
 * isOpportunityByAnnualized(800, 800) // => true（邊界條件使用 >=）
 */
export function isOpportunityByAnnualized(
  annualizedReturn: number,
  threshold: number
): boolean {
  return annualizedReturn >= threshold;
}

/**
 * 判斷是否為「接近機會」（年化收益在接近門檻與主門檻之間）
 *
 * @param annualizedReturn 年化收益百分比
 * @param opportunityThreshold 機會門檻（年化收益百分比，如 800）
 * @param approachingThreshold 接近門檻（年化收益百分比，如 600）
 * @returns 是否為接近機會
 *
 * @example
 * isApproachingOpportunity(700, 800, 600) // => true
 * isApproachingOpportunity(500, 800, 600) // => false
 * isApproachingOpportunity(850, 800, 600) // => false（已是機會）
 */
export function isApproachingOpportunity(
  annualizedReturn: number,
  opportunityThreshold: number,
  approachingThreshold: number
): boolean {
  return (
    annualizedReturn >= approachingThreshold &&
    annualizedReturn < opportunityThreshold
  );
}

/**
 * 確定交易對的套利狀態
 *
 * @param annualizedReturn 年化收益百分比
 * @param opportunityThreshold 機會門檻（年化收益百分比）
 * @param approachingThreshold 接近門檻（年化收益百分比）
 * @returns 套利狀態：'opportunity' | 'approaching' | 'normal'
 *
 * @example
 * determineOpportunityStatus(850, 800, 600) // => 'opportunity'
 * determineOpportunityStatus(700, 800, 600) // => 'approaching'
 * determineOpportunityStatus(500, 800, 600) // => 'normal'
 */
export function determineOpportunityStatus(
  annualizedReturn: number,
  opportunityThreshold: number,
  approachingThreshold: number
): 'opportunity' | 'approaching' | 'normal' {
  if (isOpportunityByAnnualized(annualizedReturn, opportunityThreshold)) {
    return 'opportunity';
  }
  if (
    isApproachingOpportunity(
      annualizedReturn,
      opportunityThreshold,
      approachingThreshold
    )
  ) {
    return 'approaching';
  }
  return 'normal';
}
