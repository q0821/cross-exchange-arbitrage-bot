/**
 * 通知服務工具函式
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */

/**
 * 交易所永續合約交易 URL 對應表
 * 與 src/lib/exchanges/constants.ts 保持一致
 *
 * 注意：symbol 格式為 BTCUSDT（無斜線）
 */
const EXCHANGE_URL_TEMPLATES: Record<string, (symbol: string) => string> = {
  binance: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.binance.com/zh-TC/futures/${symbol}`;
  },
  okx: (symbol) => {
    // BTCUSDT → BTC-USDT-SWAP
    const base = symbol.replace('USDT', '');
    return `https://www.okx.com/zh-hant/trade-swap/${base}-USDT-SWAP`;
  },
  mexc: (symbol) => {
    // BTCUSDT → BTC_USDT
    const base = symbol.replace('USDT', '');
    return `https://futures.mexc.com/zh-TW/exchange/${base}_USDT`;
  },
  gate: (symbol) => {
    // BTCUSDT → BTC_USDT
    const base = symbol.replace('USDT', '');
    return `https://www.gate.io/zh-tw/futures_trade/USDT/${base}_USDT`;
  },
  gateio: (symbol) => {
    // BTCUSDT → BTC_USDT（與 gate 相同）
    const base = symbol.replace('USDT', '');
    return `https://www.gate.io/zh-tw/futures_trade/USDT/${base}_USDT`;
  },
  bybit: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.bybit.com/trade/usdt/${symbol}`;
  },
  bitget: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.bitget.com/futures/usdt/${symbol}`;
  },
  htx: (symbol) => {
    // BTCUSDT → BTC-USDT
    const base = symbol.replace('USDT', '');
    return `https://www.htx.com/futures/linear_swap/exchange#contract_code=${base}-USDT&type=cross`;
  },
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
 * 格式化價格（固定小數位）
 * @param price 價格
 * @param decimals 小數位數
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return `$${price.toFixed(decimals)}`;
}

/**
 * 智能格式化價格（根據價格大小動態調整小數位）
 * - 價格 >= 1：2 位小數（如 $100.00）
 * - 價格 >= 0.01：4 位小數（如 $0.0900）
 * - 價格 < 0.01：6 位小數（如 $0.000123）
 *
 * @param price 價格
 */
export function formatPriceSmart(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}
