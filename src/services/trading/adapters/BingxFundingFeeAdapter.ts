/**
 * BingX Funding Fee Adapter
 *
 * 使用 BingX 原生 API /openApi/swap/v2/user/income 查詢資金費率歷史
 * CCXT 不支援 BingX 的 fetchFundingHistory
 *
 * 注意：BingX API 帶 symbol 參數時可能返回 null，
 * 因此改為不帶 symbol 查詢所有記錄，再在結果中過濾
 *
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../../lib/logger';
import type { FundingFeeEntry } from '../../../types/trading';
import type { FundingFeeAdapter, FetchFundingFeesParams } from './FundingFeeAdapter';
import { parseSymbolParts } from './FundingFeeAdapter';

interface BingxIncomeEntry {
  symbol?: string;
  income?: string | number;
  amount?: string | number;
  time?: string | number;
  timestamp?: string | number;
  tranId?: string;
  id?: string;
}

export class BingxFundingFeeAdapter implements FundingFeeAdapter {
  readonly exchangeName = 'bingx';

  constructor(private readonly ccxtExchange: ccxt.Exchange) {}

  async fetchFundingFees(params: FetchFundingFeesParams): Promise<FundingFeeEntry[]> {
    const { symbol, startTime, endTime } = params;
    const bingxSymbol = this.toBingxSymbol(symbol);

    logger.info(
      { symbol, bingxSymbol, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      '[BingX] Querying funding fee history via native API',
    );

    const data = await this.fetchRawData(startTime, endTime, bingxSymbol);

    const entries: FundingFeeEntry[] = [];
    for (const entry of data) {
      // 過濾：只保留匹配的 symbol
      const entrySymbol = entry.symbol || '';
      if (entrySymbol && entrySymbol !== bingxSymbol) {
        continue;
      }

      const amount = new Decimal(entry.income || entry.amount || 0);
      const timestamp = parseInt(String(entry.time || entry.timestamp), 10);

      if (isNaN(timestamp)) continue;

      entries.push({
        timestamp,
        datetime: new Date(timestamp).toISOString(),
        amount,
        symbol: entrySymbol || bingxSymbol,
        id: entry.tranId || entry.id || String(timestamp),
      });
    }

    logger.info(
      { exchange: this.exchangeName, symbol, bingxSymbol, totalRecords: data.length, matchedRecords: entries.length },
      '[BingX] Funding fee query completed',
    );

    return entries;
  }

  /** 嘗試多種 API 端點，3-method fallback */
  private async fetchRawData(
    startTime: Date,
    endTime: Date,
    bingxSymbol: string,
  ): Promise<BingxIncomeEntry[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exchange = this.ccxtExchange as any;

    // 方法 1: swapV2PrivateGetUserIncome
    try {
      const response = await exchange.swapV2PrivateGetUserIncome({
        incomeType: 'FUNDING_FEE',
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        limit: 1000,
      });

      logger.debug(
        { response: JSON.stringify(response).slice(0, 500) },
        '[BingX] swapV2PrivateGetUserIncome response',
      );

      return response?.data || [];
    } catch (apiError) {
      const msg = apiError instanceof Error ? apiError.message : String(apiError);
      logger.debug({ error: msg }, '[BingX] swapV2PrivateGetUserIncome failed, trying alternative');
    }

    // 方法 2: privateGetSwapV2UserIncome
    try {
      const response2 = await exchange.privateGetSwapV2UserIncome({
        incomeType: 'FUNDING_FEE',
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        limit: 1000,
      });

      logger.debug(
        { response: JSON.stringify(response2).slice(0, 500) },
        '[BingX] privateGetSwapV2UserIncome response',
      );

      return response2?.data || [];
    } catch (apiError2) {
      const msg2 = apiError2 instanceof Error ? apiError2.message : String(apiError2);
      logger.debug({ error: msg2 }, '[BingX] privateGetSwapV2UserIncome also failed');
    }

    // 方法 3: fetchMyTrades fallback
    try {
      const { base, quote } = parseSymbolParts(bingxSymbol.replace(/-/g, ''));
      const ccxtSymbol = `${base}/${quote}:${quote}`;

      const trades = await exchange.fetchMyTrades(
        ccxtSymbol,
        startTime.getTime(),
        undefined,
        { endTime: endTime.getTime() },
      );

      const fundingTrades = trades.filter(
        (t: { type?: string; info?: { tradeType?: string } }) =>
          t.type === 'funding' || t.info?.tradeType === 'FUNDING_FEE',
      );

      const mapped = fundingTrades.map(
        (t: { timestamp: number; amount?: number; cost?: number; id?: string }) => ({
          time: t.timestamp,
          income: t.amount || t.cost || 0,
          symbol: bingxSymbol,
          tranId: t.id,
        }),
      );

      logger.debug({ fundingTradesCount: mapped.length }, '[BingX] Extracted funding from trades');
      return mapped;
    } catch (tradeError) {
      const msg3 = tradeError instanceof Error ? tradeError.message : String(tradeError);
      logger.debug({ error: msg3 }, '[BingX] fetchMyTrades also failed');
      // 所有 3 種方法都失敗，拋出最後的錯誤讓 orchestrator 處理
      throw new Error(`All BingX funding fee API methods failed: ${msg3}`);
    }
  }

  /** 轉換 BTCUSDT → BTC-USDT */
  private toBingxSymbol(symbol: string): string {
    const { base, quote } = parseSymbolParts(symbol);
    return `${base}-${quote}`;
  }
}
