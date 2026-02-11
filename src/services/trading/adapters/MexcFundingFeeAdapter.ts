/**
 * MEXC Funding Fee Adapter
 *
 * 使用 CCXT 泛用 fetchFundingHistory 查詢資金費率歷史
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../../lib/logger';
import type { FundingFeeEntry } from '../../../types/trading';
import type { FundingFeeAdapter, FetchFundingFeesParams } from './FundingFeeAdapter';
import { convertToCcxtSymbol } from './FundingFeeAdapter';

export class MexcFundingFeeAdapter implements FundingFeeAdapter {
  readonly exchangeName = 'mexc';

  constructor(private readonly ccxtExchange: ccxt.Exchange) {}

  async fetchFundingFees(params: FetchFundingFeesParams): Promise<FundingFeeEntry[]> {
    const { symbol, startTime, endTime } = params;
    const ccxtSymbol = convertToCcxtSymbol(symbol);
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    logger.info(
      { exchange: this.exchangeName, symbol, ccxtSymbol, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      'Querying funding fee history via CCXT',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = await (this.ccxtExchange as any).fetchFundingHistory(
      ccxtSymbol,
      startMs,
      undefined,
      { until: endMs },
    );

    const entries: FundingFeeEntry[] = [];
    for (const entry of history) {
      const entryTimestamp = entry.timestamp;
      if (entryTimestamp < startMs || entryTimestamp > endMs) {
        continue;
      }

      entries.push({
        timestamp: entry.timestamp,
        datetime: entry.datetime,
        amount: new Decimal(entry.amount || 0),
        symbol: entry.symbol,
        id: entry.id || String(entry.timestamp),
      });
    }

    logger.info(
      { exchange: this.exchangeName, symbol, entriesCount: entries.length },
      'Funding fee query completed',
    );

    return entries;
  }
}
