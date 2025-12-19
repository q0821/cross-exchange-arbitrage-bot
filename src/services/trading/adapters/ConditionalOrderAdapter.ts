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
 * 轉換交易對符號格式
 * 將 CCXT 格式 (BTC/USDT) 轉換為交易所格式
 */
export function convertSymbolForExchange(
  symbol: string,
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc',
): string {
  // 移除 '/'
  const baseQuote = symbol.replace('/', '');

  switch (exchange) {
    case 'binance':
    case 'mexc':
      // Binance/MEXC: BTCUSDT
      return baseQuote;
    case 'okx':
      // OKX: BTC-USDT-SWAP
      return `${symbol.replace('/', '-')}-SWAP`;
    case 'gateio':
      // Gate.io: BTC_USDT
      return symbol.replace('/', '_');
    default:
      return baseQuote;
  }
}
