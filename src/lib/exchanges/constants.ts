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
