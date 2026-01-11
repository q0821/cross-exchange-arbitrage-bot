/**
 * Exchange URL Configuration Constants
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Centralized management of exchange URL templates and symbol formatting rules
 */

import type {
  ExchangeUrlConfig,
  ExchangeConfigMap,
  SupportedExchange,
} from '@/types/exchange-links';

/**
 * Exchange URL configurations
 *
 * Defines URL templates and symbol formatting logic for each supported exchange
 */
export const EXCHANGE_CONFIGS: ExchangeConfigMap = {
  binance: {
    exchange: 'binance',
    displayName: 'Binance',
    urlTemplate: 'https://www.binance.com/zh-TC/futures/{symbol}',
    formatSymbol: (symbol: string): string => {
      // BTC/USDT → BTCUSDT
      return symbol.replace('/', '');
    },
  },
  okx: {
    exchange: 'okx',
    displayName: 'OKX',
    urlTemplate: 'https://www.okx.com/zh-hant/trade-swap/{symbol}',
    formatSymbol: (symbol: string): string => {
      // BTC/USDT → BTC-USDT-SWAP
      return symbol.replace('/', '-') + '-SWAP';
    },
  },
  mexc: {
    exchange: 'mexc',
    displayName: 'MEXC',
    urlTemplate: 'https://futures.mexc.com/zh-TW/exchange/{symbol}',
    formatSymbol: (symbol: string): string => {
      // BTC/USDT → BTC_USDT
      return symbol.replace('/', '_');
    },
  },
  gateio: {
    exchange: 'gateio',
    displayName: 'Gate.io',
    urlTemplate: 'https://www.gate.io/zh-tw/futures_trade/USDT/{symbol}',
    formatSymbol: (symbol: string): string => {
      // BTC/USDT → BTC_USDT
      return symbol.replace('/', '_');
    },
  },
  bingx: {
    exchange: 'bingx',
    displayName: 'BingX',
    urlTemplate: 'https://bingx.com/zh-tc/futures/forward/{symbol}',
    formatSymbol: (symbol: string): string => {
      // BTC/USDT → BTCUSDT
      return symbol.replace('/', '');
    },
  },
};

/**
 * Get exchange configuration by name
 *
 * @param exchange - Exchange identifier
 * @returns Exchange configuration or undefined if not found
 */
export function getExchangeConfig(
  exchange: string
): ExchangeUrlConfig | undefined {
  return EXCHANGE_CONFIGS[exchange as SupportedExchange];
}

/**
 * 交易所不支援的交易對清單
 *
 * 這些交易對在特定交易所的 Futures 市場不存在，
 * 用於過濾以避免產生大量無效的 API 請求和警告日誌。
 *
 * 最後更新：2026-01-11
 * 來源：backend-log-monitor 自動偵測
 */
export const EXCHANGE_UNSUPPORTED_SYMBOLS: Record<SupportedExchange, string[]> = {
  binance: [
    // Binance 支援大多數交易對，目前無已知不支援的
  ],
  okx: [
    'PAXGUSDT',   // 黃金代幣
    'XMRUSDT',    // 隱私幣
    'ARCUSDT',
    'ALCHUSDT',
    'FETUSDT',
    'KITEUSDT',
    'TAKEUSDT',
    'FFUSDT',
    'BTCDOMUSDT', // BTC Dominance 指數
    'CAKEUSDT',
    'ZEREBROUSDT',
    'FOLKSUSDT',
    'UBUSDT',
    'ICNTUSDT',
    'FORMUSDT',
    'XPINUSDT',
    'RIVERUSDT',
    'VETUSDT',
    'HUMAUSDT',
    'JUPUSDT',
    'PENGUUSDT',
    'SOLVUSDT',
    'TIAUSDT',
    'FARTCOINUSDT',
    'ALGOUSDT',
    'ETHFIUSDT',
  ],
  mexc: [
    'PUMPUSDT',
    'FILUSDT',
    'TRUMPUSDT',
    'MONUSDT',
    'TONUSDT',
    'ARCUSDT',
    'BTCDOMUSDT',
    'WIFUSDT',
  ],
  gateio: [
    'BTCDOMUSDT',
    'ZENUSDT',
  ],
  bingx: [
    'TRUMPUSDT',
    'MONUSDT',
    'TONUSDT',
    'ARCUSDT',
    'ALCHUSDT',
    'BTCDOMUSDT',
    'LIGHTUSDT',
    'ZEREBROUSDT',
    'OMUSDT',
    'METUSDT',
  ],
};

/**
 * 檢查交易對是否在指定交易所受支援
 *
 * @param exchange - 交易所名稱
 * @param symbol - 交易對符號（如 BTCUSDT）
 * @returns true 表示支援，false 表示不支援
 */
export function isSymbolSupported(
  exchange: SupportedExchange,
  symbol: string
): boolean {
  const unsupportedList = EXCHANGE_UNSUPPORTED_SYMBOLS[exchange];
  if (!unsupportedList) return true;
  return !unsupportedList.includes(symbol);
}

/**
 * 過濾出指定交易所支援的交易對
 *
 * @param exchange - 交易所名稱
 * @param symbols - 交易對陣列
 * @returns 過濾後支援的交易對陣列
 */
export function filterSupportedSymbols(
  exchange: SupportedExchange,
  symbols: string[]
): string[] {
  const unsupportedList = EXCHANGE_UNSUPPORTED_SYMBOLS[exchange];
  if (!unsupportedList || unsupportedList.length === 0) return symbols;
  return symbols.filter((symbol) => !unsupportedList.includes(symbol));
}

/**
 * 取得所有交易所都支援的交易對
 *
 * @param symbols - 交易對陣列
 * @param exchanges - 要檢查的交易所列表（預設全部）
 * @returns 所有指定交易所都支援的交易對
 */
export function getUniversallySupportedSymbols(
  symbols: string[],
  exchanges: SupportedExchange[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx']
): string[] {
  return symbols.filter((symbol) =>
    exchanges.every((exchange) => isSymbolSupported(exchange, symbol))
  );
}
