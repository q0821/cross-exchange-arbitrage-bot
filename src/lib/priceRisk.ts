/**
 * 價差風險判斷工具
 *
 * 用於判斷套利機會的價差風險等級，在 Web 界面和通知系統中顯示相應警告。
 */

/** 價差警告閾值 (0.5%) */
export const PRICE_DIFF_WARNING_THRESHOLD = 0.5;

/** 價差風險等級 */
export type PriceRiskLevel = 'safe' | 'warning' | 'unknown';

/**
 * 判斷價差風險等級
 *
 * @param priceDiffPercent - 價差百分比 (可能為 null/undefined)
 * @returns 風險等級
 *   - 'unknown': 無價差資訊
 *   - 'warning': 價差超過 0.5%
 *   - 'safe': 價差在安全範圍內 (≤ 0.5%)
 */
export function getPriceRiskLevel(
  priceDiffPercent: number | null | undefined
): PriceRiskLevel {
  if (
    priceDiffPercent === null ||
    priceDiffPercent === undefined ||
    isNaN(priceDiffPercent)
  ) {
    return 'unknown';
  }
  if (Math.abs(priceDiffPercent) > PRICE_DIFF_WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'safe';
}

/**
 * 取得風險等級對應的警告訊息
 *
 * @param riskLevel - 風險等級
 * @param priceDiffPercent - 價差百分比 (用於 warning 等級顯示具體數值)
 * @returns 警告訊息物件，包含標題和內容
 */
export function getPriceRiskMessage(
  riskLevel: PriceRiskLevel,
  priceDiffPercent?: number
): { title: string; content: string } | null {
  switch (riskLevel) {
    case 'unknown':
      return {
        title: '風險提示',
        content: '無價差資訊，開倉前請自行確認兩交易所的價差，避免因價差過大導致虧損。',
      };
    case 'warning':
      return {
        title: '價差警告',
        content: `價差 ${Math.abs(priceDiffPercent || 0).toFixed(2)}% 超過 ${PRICE_DIFF_WARNING_THRESHOLD}%，開倉成本較高，請評估是否值得進場。`,
      };
    case 'safe':
    default:
      return null;
  }
}
