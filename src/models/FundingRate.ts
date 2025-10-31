import { z } from 'zod';

/**
 * 資金費率資料模型
 * 用於儲存和驗證從交易所獲取的資金費率資訊
 */

// Zod 驗證 Schema
export const FundingRateSchema = z.object({
  exchange: z.enum(['binance', 'okx']),
  symbol: z.string().min(1),
  fundingRate: z.number(),
  nextFundingTime: z.date(),
  markPrice: z.number().optional(),
  indexPrice: z.number().optional(),
  recordedAt: z.date(),
});

// TypeScript 型別定義
export type FundingRate = z.infer<typeof FundingRateSchema>;

// 資金費率記錄類別
export class FundingRateRecord implements FundingRate {
  exchange: 'binance' | 'okx';
  symbol: string;
  fundingRate: number;
  nextFundingTime: Date;
  markPrice?: number;
  indexPrice?: number;
  recordedAt: Date;

  constructor(data: FundingRate) {
    // 使用 Zod 驗證輸入資料
    const validated = FundingRateSchema.parse(data);

    this.exchange = validated.exchange;
    this.symbol = validated.symbol;
    this.fundingRate = validated.fundingRate;
    this.nextFundingTime = validated.nextFundingTime;
    this.markPrice = validated.markPrice;
    this.indexPrice = validated.indexPrice;
    this.recordedAt = validated.recordedAt;
  }

  /**
   * 取得資金費率百分比（格式化為易讀字串）
   */
  getFundingRatePercent(): string {
    return (this.fundingRate * 100).toFixed(4) + '%';
  }

  /**
   * 取得年化資金費率（假設每 8 小時收取一次）
   */
  getAnnualizedRate(): number {
    // 365 天 * 3 次/天 (每 8 小時)
    return this.fundingRate * 365 * 3;
  }

  /**
   * 判斷資金費率是正向還是負向
   */
  isPositive(): boolean {
    return this.fundingRate > 0;
  }

  /**
   * 計算距離下次結算的剩餘時間（毫秒）
   */
  getTimeUntilNextFunding(): number {
    return this.nextFundingTime.getTime() - Date.now();
  }

  /**
   * 轉換為純物件（用於 JSON 序列化）
   */
  toJSON(): Record<string, unknown> {
    return {
      exchange: this.exchange,
      symbol: this.symbol,
      fundingRate: this.fundingRate,
      fundingRatePercent: this.getFundingRatePercent(),
      annualizedRate: this.getAnnualizedRate(),
      nextFundingTime: this.nextFundingTime.toISOString(),
      markPrice: this.markPrice,
      indexPrice: this.indexPrice,
      recordedAt: this.recordedAt.toISOString(),
    };
  }

  /**
   * 轉換為易讀字串
   */
  toString(): string {
    return `[${this.exchange.toUpperCase()}] ${this.symbol}: ${this.getFundingRatePercent()} (next: ${this.nextFundingTime.toLocaleString()})`;
  }
}

/**
 * 資金費率配對
 * 用於比較兩個交易所的資金費率
 */
export interface FundingRatePair {
  symbol: string;
  binance: FundingRateRecord;
  okx: FundingRateRecord;
  spreadPercent: number;
  spreadAnnualized: number;
  recordedAt: Date;
  // 價格數據（用於價差檢查）
  binancePrice?: number;
  okxPrice?: number;
  priceDiffPercent?: number; // 價差百分比
}

/**
 * 建立資金費率配對
 */
export function createFundingRatePair(
  binance: FundingRateRecord,
  okx: FundingRateRecord,
  binancePrice?: number,
  okxPrice?: number
): FundingRatePair {
  if (binance.symbol !== okx.symbol) {
    throw new Error(`Symbol mismatch: ${binance.symbol} vs ${okx.symbol}`);
  }

  const spread = Math.abs(binance.fundingRate - okx.fundingRate);
  const spreadAnnualized = spread * 365 * 3;

  // 計算價差百分比
  let priceDiffPercent: number | undefined;
  if (binancePrice && okxPrice) {
    const avgPrice = (binancePrice + okxPrice) / 2;
    priceDiffPercent = ((binancePrice - okxPrice) / avgPrice) * 100;
  }

  return {
    symbol: binance.symbol,
    binance,
    okx,
    spreadPercent: spread * 100,
    spreadAnnualized: spreadAnnualized * 100,
    recordedAt: new Date(),
    binancePrice,
    okxPrice,
    priceDiffPercent,
  };
}

/**
 * 記憶體儲存（暫時用，待資料庫建立後移除）
 */
export class FundingRateStore {
  private rates: Map<string, FundingRateRecord[]> = new Map();
  private maxRecordsPerSymbol = 100;

  /**
   * 儲存資金費率記錄
   */
  save(rate: FundingRateRecord): void {
    const key = `${rate.exchange}:${rate.symbol}`;
    const records = this.rates.get(key) || [];

    records.push(rate);

    // 保留最近的 N 筆記錄
    if (records.length > this.maxRecordsPerSymbol) {
      records.shift();
    }

    this.rates.set(key, records);
  }

  /**
   * 取得最新的資金費率
   */
  getLatest(exchange: string, symbol: string): FundingRateRecord | undefined {
    const key = `${exchange}:${symbol}`;
    const records = this.rates.get(key);
    return records?.[records.length - 1];
  }

  /**
   * 取得歷史記錄
   */
  getHistory(exchange: string, symbol: string, limit = 10): FundingRateRecord[] {
    const key = `${exchange}:${symbol}`;
    const records = this.rates.get(key) || [];
    return records.slice(-limit);
  }

  /**
   * 清除所有記錄
   */
  clear(): void {
    this.rates.clear();
  }

  /**
   * 取得所有已追蹤的交易對
   */
  getTrackedSymbols(): string[] {
    const symbols = new Set<string>();
    for (const key of this.rates.keys()) {
      const parts = key.split(':');
      if (parts[1]) {
        symbols.add(parts[1]);
      }
    }
    return Array.from(symbols);
  }
}
