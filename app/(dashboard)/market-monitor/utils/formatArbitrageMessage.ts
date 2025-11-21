import { MarketRate, ExchangeName } from '../types';

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
 * T008: 將百分比數值格式化為範圍估值
 *
 * 使用 ±20% 波動範圍，四捨五入到整數百分比
 *
 * @param value - 百分比數值（小數形式，如 0.075 表示 7.5%）
 * @returns 格式化的範圍字串（如 "約 6-9%"）
 *
 * @example
 * formatPercentageRange(0.075) // "約 6-9%"
 * formatPercentageRange(0.03)  // "約 2-4%"
 * formatPercentageRange(0)     // "約 0%"
 * formatPercentageRange(null)  // "N/A"
 */
export function formatPercentageRange(value: number | null): string {
  // 處理無效值
  if (value === null || isNaN(value) || value < 0) {
    return 'N/A';
  }

  // 處理零值
  if (value === 0) {
    return '約 0%';
  }

  // 轉換為百分比
  const valuePercent = value * 100;

  // 計算 ±20% 範圍
  const min = Math.max(0, Math.round(valuePercent * 0.8));
  const max = Math.round(valuePercent * 1.2);

  // 如果 min 和 max 相同，只顯示單一值
  if (min === max) {
    return `約 ${min}%`;
  }

  return `約 ${min}-${max}%`;
}

/**
 * T009: 將 MarketRate 數據格式化為完整的套利資訊文字
 *
 * @param rate - MarketRate 物件，包含交易對和套利配對資訊
 * @returns 格式化的文字字串，可直接複製到剪貼板
 * @throws Error 當 bestPair 為 null 時拋出異常
 *
 * @example
 * const rate: MarketRate = { ... };
 * const message = formatArbitrageMessage(rate);
 * await navigator.clipboard.writeText(message);
 */
export function formatArbitrageMessage(rate: MarketRate): string {
  // 驗證必要數據
  if (!rate || !rate.bestPair) {
    throw new Error('Invalid rate data or missing best pair');
  }

  const { symbol, bestPair } = rate;
  const { longExchange, shortExchange, priceDiffPercent, spreadPercent } = bestPair;

  // 格式化各個欄位
  const symbolDisplay = formatSymbolDisplay(symbol);
  const longExchangeDisplay = getExchangeDisplayName(longExchange);
  const shortExchangeDisplay = getExchangeDisplayName(shortExchange);
  const priceDiffDisplay = formatPercentageRange(priceDiffPercent);
  const spreadDisplay = formatPercentageRange(spreadPercent);

  // 組裝完整訊息
  const message = `=======
【套套摳訊】

📌
${symbolDisplay}
做多：${longExchangeDisplay}（交易所）
做空：${shortExchangeDisplay}（交易所）

📈 目前利潤預估：
 • 目前價差：${priceDiffDisplay}
 • 目前資費差：${spreadDisplay}

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提醒：
 • 資費有時會亂跳，要再注意觀察
=======`;

  return message;
}
