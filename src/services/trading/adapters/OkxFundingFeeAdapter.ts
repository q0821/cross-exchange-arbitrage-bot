/**
 * OKX Funding Fee Adapter
 *
 * 使用 OKX 原生 API /api/v5/account/bills 查詢資金費率歷史
 *
 * CCXT fetchFundingHistory 對 OKX 有以下問題：
 * 1. 不傳 begin/end 時間參數給 API，僅做 post-filtering
 * 2. instType 大小寫處理不一致可能導致參數未正確設定
 * 3. 使用 bills-archive 而非 bills，可能遺漏最近的結算記錄
 *
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../../lib/logger';
import type { FundingFeeEntry } from '../../../types/trading';
import type { FundingFeeAdapter, FetchFundingFeesParams } from './FundingFeeAdapter';
import { parseSymbolParts } from './FundingFeeAdapter';

interface OkxBillEntry {
  billId?: string;
  instId?: string;
  balChg?: string;
  pnl?: string;
  ts?: string;
  subType?: string;
}

export class OkxFundingFeeAdapter implements FundingFeeAdapter {
  readonly exchangeName = 'okx';

  constructor(private readonly ccxtExchange: ccxt.Exchange) {}

  async fetchFundingFees(params: FetchFundingFeesParams): Promise<FundingFeeEntry[]> {
    const { symbol, startTime, endTime } = params;
    const okxInstId = this.toOkxInstId(symbol);
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    logger.info(
      { symbol, okxInstId, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      '[OKX] Querying funding fee history via native API',
    );

    // type=8 為資金費率
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResponse = await (this.ccxtExchange as any).privateGetAccountBills({
      instType: 'SWAP',
      type: '8',
      instId: okxInstId,
      begin: String(startMs),
      end: String(endMs),
      limit: '100',
    });

    const data: OkxBillEntry[] = rawResponse?.data || [];

    logger.debug(
      { totalRecords: data.length },
      '[OKX] Raw API response received',
    );

    const entries: FundingFeeEntry[] = [];
    for (const entry of data) {
      const timestamp = parseInt(entry.ts || '0', 10);
      if (timestamp < startMs || timestamp > endMs) {
        continue;
      }

      // balChg（餘額變更）是實際的資金費率收支
      const amount = new Decimal(entry.balChg || entry.pnl || 0);
      entries.push({
        timestamp,
        datetime: new Date(timestamp).toISOString(),
        amount,
        symbol: entry.instId || okxInstId,
        id: entry.billId || String(timestamp),
      });
    }

    logger.info(
      { exchange: this.exchangeName, symbol, okxInstId, totalRecords: data.length, matchedRecords: entries.length },
      '[OKX] Funding fee query completed',
    );

    return entries;
  }

  /** 轉換 BTCUSDT → BTC-USDT-SWAP */
  private toOkxInstId(symbol: string): string {
    const { base, quote } = parseSymbolParts(symbol);
    return `${base}-${quote}-SWAP`;
  }
}
