/**
 * Funding Fee Adapter Interface
 *
 * 資金費率查詢適配器介面：定義各交易所資金費率查詢的統一介面
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type { FundingFeeEntry } from '../../../types/trading';

/**
 * 查詢資金費率的參數
 */
export interface FetchFundingFeesParams {
  /** 交易對符號（內部格式：BTCUSDT） */
  symbol: string;
  /** 查詢起始時間 */
  startTime: Date;
  /** 查詢結束時間 */
  endTime: Date;
}

/**
 * 資金費率查詢適配器介面
 *
 * 每個交易所實作此介面，負責：
 * 1. symbol 格式轉換（BTCUSDT → 交易所格式）
 * 2. 呼叫交易所 API
 * 3. 解析回應為 FundingFeeEntry[]
 * 4. 時間範圍過濾
 */
export interface FundingFeeAdapter {
  /** 交易所名稱 */
  readonly exchangeName: string;

  /**
   * 查詢指定交易對的資金費率歷史
   *
   * @throws Error — API 呼叫失敗時直接 throw，由 orchestrator catch
   */
  fetchFundingFees(params: FetchFundingFeesParams): Promise<FundingFeeEntry[]>;
}

/**
 * 轉換內部 symbol 格式為 CCXT 格式
 * e.g., BTCUSDT -> BTC/USDT:USDT
 */
export function convertToCcxtSymbol(symbol: string): string {
  const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];

  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}:${quote}`;
    }
  }

  return symbol;
}

/**
 * 解析 symbol 為 base 和 quote
 * 支援 BTCUSDT、BTC/USDT、BTC-USDT 等格式
 */
export function parseSymbolParts(symbol: string): { base: string; quote: string } {
  const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];

  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return {
        base: symbol.slice(0, -quote.length),
        quote,
      };
    }
  }

  return { base: symbol, quote: 'USDT' };
}
