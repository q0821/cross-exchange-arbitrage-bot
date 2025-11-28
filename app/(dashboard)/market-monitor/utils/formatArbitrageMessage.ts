import { MarketRate, ExchangeName, TimeBasis } from '../types';
import { calculatePaybackPeriods } from './rateCalculations';

/**
 * 交易所顯示名稱映射表
 */
const EXCHANGE_DISPLAY_NAMES: Record<ExchangeName, string> = {
  binance: 'BINANCE',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'GATE'
};

/**
 * T006: 將交易對符號格式化為顯示格式
 *
 * @param symbol - 交易對符號（如 "BTCUSDT"）
 * @returns 格式化後的顯示名稱（如 "BTC/USDT"）
 *
 * @example
 * formatSymbolDisplay("BTCUSDT") // "BTC/USDT"
 * formatSymbolDisplay("ETHUSDT") // "ETH/USDT"
 */
export function formatSymbolDisplay(symbol: string): string {
  if (symbol.endsWith('USDT')) {
    const base = symbol.slice(0, -4);
    return `${base}/USDT`;
  }
  return symbol; // Fallback: 直接返回原始符號
}

/**
 * T007: 獲取交易所的顯示名稱
 *
 * @param exchange - ExchangeName 類型
 * @returns 大寫的顯示名稱
 *
 * @example
 * getExchangeDisplayName('binance') // 'BINANCE'
 * getExchangeDisplayName('gateio')  // 'GATE'
 */
export function getExchangeDisplayName(exchange: ExchangeName): string {
  return EXCHANGE_DISPLAY_NAMES[exchange] || exchange.toUpperCase();
}

/**
 * 格式化年化收益為範圍估值（±10%）
 *
 * @param annualizedReturn - 年化收益百分比（如 800 表示 800%）
 * @returns 格式化字串（如 "約 720-880%"）
 *
 * @example
 * formatAnnualizedReturn(800)  // => "約 720-880%"
 * formatAnnualizedReturn(0)    // => "約 0%"
 */
function formatAnnualizedReturn(annualizedReturn: number): string {
  // 處理零值
  if (annualizedReturn === 0) {
    return '約 0%';
  }

  // 計算 ±10% 範圍
  const min = Math.round(annualizedReturn * 0.9);
  const max = Math.round(annualizedReturn * 1.1);

  return `約 ${min}-${max}%`;
}

/**
 * 格式化單次費率收益並附加時間基準說明
 *
 * @param spreadPercent - 費率差異百分比（如 0.73 表示 0.73%）
 * @param timeBasis - 時間基準（1, 4, 8, 24 小時）
 * @returns 格式化字串（如 "約 0.73%（每 8 小時結算一次）"）
 *
 * @example
 * formatSingleFundingReturn(0.73, 8)  // => "約 0.73%（每 8 小時結算一次）"
 * formatSingleFundingReturn(0.25, 4)  // => "約 0.25%（每 4 小時結算一次）"
 */
function formatSingleFundingReturn(
  spreadPercent: number,
  timeBasis: TimeBasis
): string {
  return `約 ${spreadPercent.toFixed(2)}%（每 ${timeBasis} 小時結算一次）`;
}

/**
 * 格式化價格偏差並附帶有利/不利說明
 *
 * @param priceDiffPercent - 價格差異百分比（如 0.15 表示 0.15%，可為 null）
 * @returns 格式化字串，包含正負號、數值和風險說明
 *
 * @example
 * formatPriceDiffWithExplanation(0.15)
 * // => "+0.15%（✓ 做空方價格較高，有利平倉）"
 *
 * formatPriceDiffWithExplanation(-0.10)
 * // => "-0.10%（✗ 做多方價格較高，不利平倉）"
 *
 * formatPriceDiffWithExplanation(null)
 * // => "N/A（無價格數據）"
 */
function formatPriceDiffWithExplanation(
  priceDiffPercent: number | null
): string {
  // 處理 null 值
  if (priceDiffPercent === null) {
    return 'N/A（無價格數據）';
  }

  // 格式化數值（2 位小數）
  const sign = priceDiffPercent >= 0 ? '+' : '';
  const value = `${sign}${priceDiffPercent.toFixed(2)}%`;

  // 根據正負值決定說明
  if (priceDiffPercent >= 0) {
    return `${value}（✓ 做空方價格較高，有利平倉）`;
  } else {
    return `${value}（✗ 做多方價格較高，不利平倉）`;
  }
}

/**
 * Feature 025 (US4): 格式化價差回本資訊
 *
 * @param priceDiffPercent - 價格差異百分比
 * @param spreadPercent - 費率差異百分比
 * @param timeBasis - 時間基準（小時）
 * @returns 格式化的回本資訊字串
 *
 * @example
 * formatPaybackInfo(-0.15, 0.05, 8)
 * // => "⏱️ 價差回本：需收取 3.0 次資費（約 24 小時）"
 *
 * formatPaybackInfo(0.15, 0.03, 8)
 * // => "✓ 價差回本：價差有利，建倉即有正報酬"
 *
 * formatPaybackInfo(-1.5, 0.01, 8)
 * // => "❌ 價差回本：回本次數過多，不建議建倉"
 */
function formatPaybackInfo(
  priceDiffPercent: number | null,
  spreadPercent: number,
  timeBasis: TimeBasis
): string {
  const payback = calculatePaybackPeriods(priceDiffPercent, spreadPercent, timeBasis);

  switch (payback.status) {
    case 'favorable':
      return '✓ 價差回本：價差有利，建倉即有正報酬';

    case 'payback_needed': {
      const hours = payback.estimatedHours || 0;
      let timeDisplay: string;

      if (hours < 24) {
        timeDisplay = `約 ${hours.toFixed(1)} 小時`;
      } else {
        const days = hours / 24;
        timeDisplay = `約 ${days.toFixed(1)} 天`;
      }

      return `⏱️ 價差回本：需收取 ${payback.periods?.toFixed(1)} 次資費（${timeDisplay}）`;
    }

    case 'too_many':
    case 'impossible':
      return '❌ 價差回本：回本次數過多，不建議建倉';

    case 'no_data':
    default:
      return '⏱️ 價差回本：無價格數據，無法計算';
  }
}

/**
 * 將 MarketRate 數據格式化為完整的套利資訊文字
 *
 * @param rate - MarketRate 物件，包含交易對和套利配對資訊
 * @param timeBasis - 時間基準（1, 4, 8, 24 小時），預設 8
 * @returns 格式化的文字字串，可直接複製到剪貼板
 * @throws Error 當 bestPair 為 null 時拋出異常
 *
 * @example
 * const message = formatArbitrageMessage(rate, 8);
 * await navigator.clipboard.writeText(message);
 */
export function formatArbitrageMessage(
  rate: MarketRate,
  timeBasis: TimeBasis = 8
): string {
  // 驗證必要數據
  if (!rate || !rate.bestPair) {
    throw new Error('Invalid rate data or missing best pair');
  }

  const { symbol, bestPair } = rate;
  const { longExchange, shortExchange, priceDiffPercent, spreadPercent, annualizedReturn } = bestPair;

  // 格式化各個欄位
  const symbolDisplay = formatSymbolDisplay(symbol);
  const longExchangeDisplay = getExchangeDisplayName(longExchange);
  const shortExchangeDisplay = getExchangeDisplayName(shortExchange);

  // User Story 1: 年化收益範圍
  const annualizedReturnDisplay = formatAnnualizedReturn(annualizedReturn);

  // User Story 2: 單次費率收益和時間基準
  const singleReturnDisplay = formatSingleFundingReturn(spreadPercent, timeBasis);

  // User Story 3: 價格偏差說明
  const priceDiffDisplay = formatPriceDiffWithExplanation(priceDiffPercent);

  // Feature 025 (US4): 價差回本資訊
  const paybackInfoDisplay = formatPaybackInfo(priceDiffPercent, spreadPercent, timeBasis);

  // 組裝完整訊息（User Story 4: 術語改善）
  const message = `=======
【套套摳訊】

📌
${symbolDisplay}
做多：${longExchangeDisplay}（交易所）
做空：${shortExchangeDisplay}（交易所）

📈 收益評估：
 • 預估年化收益：${annualizedReturnDisplay}（資金費率價差）
 • 單次費率收益：${singleReturnDisplay}
 • 價格偏差：${priceDiffDisplay}
 • ${paybackInfoDisplay}

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======`;

  return message;
}
