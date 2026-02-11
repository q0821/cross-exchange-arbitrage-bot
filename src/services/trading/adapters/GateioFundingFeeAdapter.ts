/**
 * Gate.io Funding Fee Adapter
 *
 * 使用 Gate.io 原生 API privateFuturesGetSettleAccountBook 查詢資金費率歷史
 *
 * Gate.io API 特性：
 * - 返回帳戶級別的所有 symbol 結算記錄
 * - CCXT fetchFundingHistory 會用 symbol 過濾結果，導致查詢其他 symbol 時返回空
 * - 因此需要不帶 symbol 查詢，然後手動過濾目標 symbol
 *
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../../lib/logger';
import type { FundingFeeEntry } from '../../../types/trading';
import type { FundingFeeAdapter, FetchFundingFeesParams } from './FundingFeeAdapter';
import { parseSymbolParts } from './FundingFeeAdapter';

interface GateioAccountBookEntry {
  text?: string;
  contract?: string;
  change?: string;
  time?: string;
  id?: string;
}

export class GateioFundingFeeAdapter implements FundingFeeAdapter {
  readonly exchangeName = 'gateio';

  constructor(private readonly ccxtExchange: ccxt.Exchange) {}

  async fetchFundingFees(params: FetchFundingFeesParams): Promise<FundingFeeEntry[]> {
    const { symbol, startTime, endTime } = params;
    const gateioSymbol = this.toGateioSymbol(symbol);
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    logger.info(
      { symbol, gateioSymbol, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      '[Gate.io] Querying funding fee history via native API',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResponse: GateioAccountBookEntry[] = await (this.ccxtExchange as any).privateFuturesGetSettleAccountBook({
      settle: 'usdt',
      type: 'fund',
      from: Math.floor(startMs / 1000),
      to: Math.floor(endMs / 1000),
      limit: 1000,
    });

    logger.debug(
      { totalRecords: rawResponse?.length || 0 },
      '[Gate.io] Raw API response received',
    );

    const entries: FundingFeeEntry[] = [];
    for (const entry of rawResponse || []) {
      // 過濾：只保留匹配的 symbol（text 欄位格式為 BTC_USDT）
      const entrySymbol = entry.text || entry.contract || '';
      if (entrySymbol !== gateioSymbol) {
        continue;
      }

      const timestamp = parseInt(entry.time || '0', 10) * 1000;
      if (timestamp < startMs || timestamp > endMs) {
        continue;
      }

      const amount = new Decimal(entry.change || 0);
      entries.push({
        timestamp,
        datetime: new Date(timestamp).toISOString(),
        amount,
        symbol: entrySymbol,
        id: entry.id || String(timestamp),
      });
    }

    logger.info(
      { exchange: this.exchangeName, symbol, gateioSymbol, totalRecords: rawResponse?.length || 0, matchedRecords: entries.length },
      '[Gate.io] Funding fee query completed',
    );

    return entries;
  }

  /** 轉換 BTCUSDT → BTC_USDT */
  private toGateioSymbol(symbol: string): string {
    const { base, quote } = parseSymbolParts(symbol);
    return `${base}_${quote}`;
  }
}
