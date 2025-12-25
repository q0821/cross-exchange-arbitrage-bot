/**
 * Conditional Order Adapter Interface
 *
 * 條件單適配器介面：定義各交易所條件單設定的統一介面
 * Feature: 038-specify-scripts-bash
 */

import Decimal from 'decimal.js';
import type { TradeSide, SingleConditionalOrderResult } from '../../../types/trading';

/**
 * 設定停損單參數
 */
export interface SetStopLossOrderParams {
  symbol: string;
  side: TradeSide;
  quantity: Decimal;
  triggerPrice: Decimal;
}

/**
 * 設定停利單參數
 */
export interface SetTakeProfitOrderParams {
  symbol: string;
  side: TradeSide;
  quantity: Decimal;
  triggerPrice: Decimal;
}

/**
 * 條件單適配器介面
 */
export interface ConditionalOrderAdapter {
  /**
   * 交易所名稱
   */
  readonly exchangeName: string;

  /**
   * 設定停損市價單
   * @param params 停損參數
   * @returns 設定結果
   */
  setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult>;

  /**
   * 設定停利市價單
   * @param params 停利參數
   * @returns 設定結果
   */
  setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult>;

  /**
   * 取消條件單
   * @param symbol 交易對
   * @param orderId 訂單 ID
   * @returns 是否成功取消
   */
  cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean>;
}

/**
 * 條件單類型
 */
export type ConditionalOrderType = 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';

/**
 * 獲取平倉方向
 * Long 倉位停損/停利時需要 SELL
 * Short 倉位停損/停利時需要 BUY
 */
export function getClosingSide(positionSide: TradeSide): 'BUY' | 'SELL' {
  return positionSide === 'LONG' ? 'SELL' : 'BUY';
}

/**
 * 解析交易對符號為 base 和 quote
 * 支援 'BTCUSDT', 'BTC/USDT', 'BTC-USDT' 等格式
 */
function parseSymbol(symbol: string): { base: string; quote: string } {
  // 先處理帶分隔符的格式
  if (symbol.includes('/')) {
    const parts = symbol.split('/');
    return { base: parts[0] || symbol, quote: parts[1] || 'USDT' };
  }
  if (symbol.includes('-')) {
    const parts = symbol.split('-');
    // OKX 格式可能是 BTC-USDT-SWAP，取前兩個
    return { base: parts[0] || symbol, quote: parts[1] || 'USDT' };
  }
  if (symbol.includes('_')) {
    const parts = symbol.split('_');
    return { base: parts[0] || symbol, quote: parts[1] || 'USDT' };
  }

  // 處理不帶分隔符的格式 (BTCUSDT)
  // 支援常見的 quote 貨幣
  const quotePatterns = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH'];
  for (const quote of quotePatterns) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return {
        base: symbol.slice(0, -quote.length),
        quote,
      };
    }
  }

  // 無法解析，返回原始值
  return { base: symbol, quote: 'USDT' };
}

/**
 * 轉換交易對符號格式
 * 支援多種輸入格式: 'BTCUSDT', 'BTC/USDT', 'BTC-USDT' 等
 * 轉換為各交易所需要的格式
 */
export function convertSymbolForExchange(
  symbol: string,
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx',
): string {
  const { base, quote } = parseSymbol(symbol);

  switch (exchange) {
    case 'binance':
    case 'mexc':
      // Binance/MEXC: BTCUSDT
      return `${base}${quote}`;
    case 'okx':
      // OKX: BTC-USDT-SWAP
      return `${base}-${quote}-SWAP`;
    case 'gateio':
      // Gate.io: BTC_USDT
      return `${base}_${quote}`;
    case 'bingx':
      // BingX: BTC-USDT (CCXT swap format)
      return `${base}/${quote}:${quote}`;
    default:
      return `${base}${quote}`;
  }
}
