/**
 * Symbol Converter
 *
 * 交易對符號格式轉換工具
 * Feature: 054-native-websocket-clients
 * Task: T007
 *
 * 內部統一格式：BTCUSDT（無分隔符號的大寫格式）
 * 各交易所格式：
 * - OKX: BTC-USDT-SWAP
 * - Gate.io: BTC_USDT
 * - BingX: BTC-USDT
 * - Binance: BTCUSDT（與內部格式相同）
 */

import type { ExchangeName } from '@/connectors/types';

// =============================================================================
// 1. 內部格式 → 交易所格式
// =============================================================================

/**
 * 轉換為 OKX 符號格式
 * @param symbol 內部格式 (e.g., "BTCUSDT")
 * @returns OKX 格式 (e.g., "BTC-USDT-SWAP")
 */
export function toOkxSymbol(symbol: string): string {
  // BTCUSDT → BTC-USDT-SWAP
  const base = symbol.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}

/**
 * 轉換為 Gate.io 符號格式
 * @param symbol 內部格式 (e.g., "BTCUSDT")
 * @returns Gate.io 格式 (e.g., "BTC_USDT")
 */
export function toGateioSymbol(symbol: string): string {
  // BTCUSDT → BTC_USDT
  const base = symbol.replace('USDT', '');
  return `${base}_USDT`;
}

/**
 * 轉換為 BingX 符號格式
 * @param symbol 內部格式 (e.g., "BTCUSDT")
 * @returns BingX 格式 (e.g., "BTC-USDT")
 */
export function toBingxSymbol(symbol: string): string {
  // BTCUSDT → BTC-USDT
  const base = symbol.replace('USDT', '');
  return `${base}-USDT`;
}

/**
 * 轉換為 Binance 符號格式（與內部格式相同）
 * @param symbol 內部格式 (e.g., "BTCUSDT")
 * @returns Binance 格式 (e.g., "BTCUSDT")
 */
export function toBinanceSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

/**
 * 根據交易所名稱轉換符號格式
 * @param symbol 內部格式
 * @param exchange 交易所名稱
 * @returns 對應交易所格式的符號
 */
export function toExchangeSymbol(symbol: string, exchange: ExchangeName): string {
  switch (exchange) {
    case 'okx':
      return toOkxSymbol(symbol);
    case 'gateio':
      return toGateioSymbol(symbol);
    case 'bingx':
      return toBingxSymbol(symbol);
    case 'binance':
      return toBinanceSymbol(symbol);
    case 'mexc':
      // MEXC 使用與 Binance 相同格式
      return symbol.toUpperCase();
    default:
      return symbol.toUpperCase();
  }
}

// =============================================================================
// 2. 交易所格式 → 內部格式
// =============================================================================

/**
 * 從 OKX 符號格式轉換為內部格式
 * @param instId OKX 格式 (e.g., "BTC-USDT-SWAP")
 * @returns 內部格式 (e.g., "BTCUSDT")
 */
export function fromOkxSymbol(instId: string): string {
  // BTC-USDT-SWAP → BTCUSDT
  return instId.replace('-SWAP', '').replace(/-/g, '');
}

/**
 * 從 Gate.io 符號格式轉換為內部格式
 * @param contract Gate.io 格式 (e.g., "BTC_USDT")
 * @returns 內部格式 (e.g., "BTCUSDT")
 */
export function fromGateioSymbol(contract: string): string {
  // BTC_USDT → BTCUSDT
  return contract.replace(/_/g, '');
}

/**
 * 從 BingX 符號格式轉換為內部格式
 * @param symbol BingX 格式 (e.g., "BTC-USDT")
 * @returns 內部格式 (e.g., "BTCUSDT")
 */
export function fromBingxSymbol(symbol: string): string {
  // BTC-USDT → BTCUSDT
  return symbol.replace(/-/g, '');
}

/**
 * 從 Binance 符號格式轉換為內部格式（格式相同，確保大寫）
 * @param symbol Binance 格式 (e.g., "BTCUSDT" or "btcusdt")
 * @returns 內部格式 (e.g., "BTCUSDT")
 */
export function fromBinanceSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

/**
 * 從交易所格式轉換為內部格式
 * @param symbol 交易所格式的符號
 * @param exchange 交易所名稱
 * @returns 內部格式符號
 */
export function fromExchangeSymbol(symbol: string, exchange: ExchangeName): string {
  switch (exchange) {
    case 'okx':
      return fromOkxSymbol(symbol);
    case 'gateio':
      return fromGateioSymbol(symbol);
    case 'bingx':
      return fromBingxSymbol(symbol);
    case 'binance':
      return fromBinanceSymbol(symbol);
    case 'mexc':
      return symbol.toUpperCase();
    default:
      return symbol.toUpperCase();
  }
}

// =============================================================================
// 3. 驗證和輔助函式
// =============================================================================

/**
 * 驗證內部符號格式是否正確
 * @param symbol 符號字串
 * @returns 是否為有效的內部格式
 */
export function isValidInternalSymbol(symbol: string): boolean {
  // 內部格式：全大寫字母 + USDT
  return /^[A-Z]+USDT$/.test(symbol);
}

/**
 * 標準化符號為內部格式（嘗試自動判斷來源格式）
 * @param symbol 任意格式的符號
 * @returns 內部格式符號
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';

  // 已經是內部格式
  if (isValidInternalSymbol(symbol)) {
    return symbol;
  }

  const upperSymbol = symbol.toUpperCase();

  // OKX 格式：含有 -SWAP
  if (upperSymbol.includes('-SWAP')) {
    return fromOkxSymbol(upperSymbol);
  }

  // Gate.io 格式：含有底線
  if (upperSymbol.includes('_')) {
    return fromGateioSymbol(upperSymbol);
  }

  // BingX 格式：含有連字號但不含 SWAP
  if (upperSymbol.includes('-')) {
    return fromBingxSymbol(upperSymbol);
  }

  // 假設已是 Binance/MEXC 格式
  return fromBinanceSymbol(upperSymbol);
}

/**
 * 批量轉換符號為交易所格式
 * @param symbols 內部格式符號陣列
 * @param exchange 目標交易所
 * @returns 交易所格式符號陣列
 */
export function toExchangeSymbols(symbols: string[], exchange: ExchangeName): string[] {
  return symbols.map((symbol) => toExchangeSymbol(symbol, exchange));
}

/**
 * 批量從交易所格式轉換為內部格式
 * @param symbols 交易所格式符號陣列
 * @param exchange 來源交易所
 * @returns 內部格式符號陣列
 */
export function fromExchangeSymbols(symbols: string[], exchange: ExchangeName): string[] {
  return symbols.map((symbol) => fromExchangeSymbol(symbol, exchange));
}
