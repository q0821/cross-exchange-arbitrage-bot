/**
 * 通知服務工具函式
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */

/**
 * 交易所永續合約交易 URL 對應表
 */
const EXCHANGE_URL_TEMPLATES: Record<string, (symbol: string) => string> = {
  binance: (symbol) =>
    `https://www.binance.com/zh-TW/futures/${symbol.replace('/', '')}`,
  okx: (symbol) =>
    `https://www.okx.com/trade-swap/${symbol.replace('/', '-').toLowerCase()}`,
  bybit: (symbol) =>
    `https://www.bybit.com/trade/usdt/${symbol.replace('/', '')}`,
  gate: (symbol) =>
    `https://www.gate.io/futures_trade/USDT/${symbol.replace('/', '_')}`,
  bitget: (symbol) =>
    `https://www.bitget.com/futures/usdt/${symbol.replace('/', '')}`,
  htx: (symbol) =>
    `https://www.htx.com/futures/linear_swap/exchange#contract_code=${symbol.replace('/', '-')}&type=cross`,
};

/**
 * 產生交易所交易頁面連結
 * @param exchange 交易所名稱（小寫）
 * @param symbol 交易對符號（如 BTC/USDT）
 * @returns 交易頁面 URL
 */
export function generateExchangeUrl(exchange: string, symbol: string): string {
  const exchangeLower = exchange.toLowerCase();
  const urlGenerator = EXCHANGE_URL_TEMPLATES[exchangeLower];

  if (urlGenerator) {
    return urlGenerator(symbol);
  }

  // 預設：返回交易所首頁
  return `https://www.${exchangeLower}.com`;
}

/**
 * 格式化數字為百分比字串
 * @param value 數值（0.01 = 1%）
 * @param decimals 小數位數
 */
export function formatPercent(value: number, decimals: number = 4): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化價格
 * @param price 價格
 * @param decimals 小數位數
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return `$${price.toFixed(decimals)}`;
}
