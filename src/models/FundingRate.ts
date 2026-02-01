import { z } from 'zod';
import { netProfitCalculator } from '../services/calculation/NetProfitCalculator';
import type { TimeBasis } from '../lib/validation/fundingRateSchemas';
import { logger } from '../lib/logger';
import { MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF } from '../lib/cost-constants';

/**
 * 資金費率資料模型
 * 用於儲存和驗證從交易所獲取的資金費率資訊
 *
 * Feature 012: 整合 NetProfitCalculator 計算淨收益
 * Feature 019: 支援基於時間基準的標準化費率計算
 */

// Zod 驗證 Schema
export const FundingRateSchema = z.object({
  exchange: z.enum(['binance', 'okx', 'mexc', 'gateio', 'bingx']),
  symbol: z.string().min(1),
  fundingRate: z.number(),
  nextFundingTime: z.date(),
  markPrice: z.number().optional(),
  indexPrice: z.number().optional(),
  recordedAt: z.date(),
});

// TypeScript 型別定義
export type FundingRate = z.infer<typeof FundingRateSchema>;
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';

// 資金費率記錄類別
export class FundingRateRecord implements FundingRate {
  exchange: ExchangeName;
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
 * 單一交易所的資金費率和價格數據
 *
 * Feature 012: 支援多版本標準化費率
 */
export interface ExchangeRateData {
  rate: FundingRateRecord;
  price?: number;
  // Feature 012: 多版本標準化費率（前端根據 timeBasis 選擇顯示）
  normalized?: {
    '1h'?: number;   // 標準化為 1 小時基準的費率
    '4h'?: number;   // 標準化為 4 小時基準的費率
    '8h'?: number;   // 標準化為 8 小時基準的費率
    '24h'?: number;  // 標準化為 24 小時基準的費率
  };
  originalFundingInterval?: number; // 原始資金費率週期（小時數）
}

/**
 * Helper function: 取得基於時間基準的標準化費率
 * Feature 019: 修復時間基準切換功能
 *
 * @param data 交易所費率資料
 * @param timeBasis 目標時間基準（1, 4, 8, 24 小時）
 * @returns 標準化後的費率或原始費率（如果無法標準化）
 */
function getNormalizedRate(data: ExchangeRateData, timeBasis: TimeBasis): number {
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
  const normalized = data.normalized?.[timeBasisKey];
  const originalInterval = data.originalFundingInterval;

  // 規則 1: 優先使用標準化值（如果存在且需要標準化）
  if (
    normalized !== undefined &&
    normalized !== null &&
    originalInterval &&
    originalInterval !== timeBasis
  ) {
    return normalized;
  }

  // 規則 2: 如果原始週期等於目標時間基準，直接使用原始費率
  if (originalInterval === timeBasis) {
    return data.rate.fundingRate;
  }

  // 規則 3: 降級處理 - 即時計算標準化值
  if (originalInterval && originalInterval !== timeBasis) {
    const originalRate = data.rate.fundingRate;
    // 標準化公式：rate_new = rate_original * (interval_target / interval_original)
    return originalRate * (timeBasis / originalInterval);
  }

  // 規則 4: 最後降級 - 返回原始費率並記錄警告
  logger.warn({
    msg: 'Missing normalization data, using original rate',
    timeBasis,
    originalInterval,
    symbol: data.rate.symbol,
  });
  return data.rate.fundingRate;
}

/**
 * 最佳套利對資訊
 */
export interface BestArbitragePair {
  longExchange: ExchangeName;   // 做多的交易所
  shortExchange: ExchangeName;  // 做空的交易所
  spreadPercent: number;         // 利差百分比
  spreadAnnualized: number;      // 年化利差百分比
  priceDiffPercent?: number;     // 價差百分比
  netReturn?: number;            // Feature 012: 淨收益百分比（扣除所有成本）
  isPriceDirectionCorrect?: boolean; // Feature 057: 價差方向是否正確（空方 >= 多方，或在 0.05% 容忍範圍內）
}

/**
 * 資金費率配對（多交易所版本）
 * 用於比較多個交易所的資金費率，並標示最佳套利對
 */
export interface FundingRatePair {
  symbol: string;
  // 所有交易所的數據
  exchanges: Map<ExchangeName, ExchangeRateData>;
  // 最佳套利對（從所有交易所中計算得出）
  bestPair?: BestArbitragePair;
  recordedAt: Date;

  // ===== 向後兼容屬性（已棄用，僅供過渡期使用）=====
  /** @deprecated 使用 exchanges.get('binance') */
  binance?: FundingRateRecord;
  /** @deprecated 使用 exchanges.get('okx') */
  okx?: FundingRateRecord;
  /** @deprecated 使用 bestPair.spreadPercent */
  spreadPercent?: number;
  /** @deprecated 使用 bestPair.spreadAnnualized */
  spreadAnnualized?: number;
  /** @deprecated 使用 exchanges.get('binance')?.price */
  binancePrice?: number;
  /** @deprecated 使用 exchanges.get('okx')?.price */
  okxPrice?: number;
  /** @deprecated 使用 bestPair.priceDiffPercent */
  priceDiffPercent?: number;
}

/**
 * 建立多交易所資金費率配對
 * @param symbol 交易對符號
 * @param exchangesData Map of exchange data (exchange name -> { rate, price })
 * @param timeBasis 時間基準（預設 8 小時）- Feature 019: 支援時間基準切換
 * @returns FundingRatePair with best arbitrage pair calculated
 */
export function createMultiExchangeFundingRatePair(
  symbol: string,
  exchangesData: Map<ExchangeName, ExchangeRateData>,
  timeBasis: TimeBasis = 8
): FundingRatePair {
  // 驗證所有 symbol 一致
  for (const [exchange, data] of exchangesData.entries()) {
    if (data.rate.symbol !== symbol) {
      throw new Error(`Symbol mismatch for ${exchange}: expected ${symbol}, got ${data.rate.symbol}`);
    }
  }

  // 計算所有交易所兩兩之間的利差，找出最佳套利對
  let bestPair: BestArbitragePair | undefined;
  let maxSpread = 0;

  const exchanges = Array.from(exchangesData.keys());
  for (let i = 0; i < exchanges.length; i++) {
    for (let j = i + 1; j < exchanges.length; j++) {
      const exchange1 = exchanges[i] as ExchangeName;
      const exchange2 = exchanges[j] as ExchangeName;
      const data1 = exchangesData.get(exchange1)!;
      const data2 = exchangesData.get(exchange2)!;

      // Feature 019: 使用標準化費率計算利差
      const rate1 = getNormalizedRate(data1, timeBasis);
      const rate2 = getNormalizedRate(data2, timeBasis);
      const spread = Math.abs(rate1 - rate2);

      if (spread > maxSpread) {
        maxSpread = spread;

        // 確定做多和做空的交易所
        // 費率高的交易所做空（支付資金費率），費率低的交易所做多（收取資金費率）
        const longExchange: ExchangeName = rate1 > rate2 ? exchange2 : exchange1;
        const shortExchange: ExchangeName = rate1 > rate2 ? exchange1 : exchange2;

        // 計算價差百分比
        let priceDiffPercent: number | undefined;
        const price1 = data1.price;
        const price2 = data2.price;
        if (price1 && price2) {
          const avgPrice = (price1 + price2) / 2;
          // 價差方向：做空的交易所價格 - 做多的交易所價格
          const shortPrice = shortExchange === exchange1 ? price1 : price2;
          const longPrice = shortExchange === exchange1 ? price2 : price1;
          priceDiffPercent = ((shortPrice - longPrice) / avgPrice) * 100;
        }

        // Feature 012: Calculate net return using NetProfitCalculator
        let netReturn: number | undefined;
        try {
          const longRate = (longExchange === exchange1 ? rate1 : rate2).toString();
          const shortRate = (shortExchange === exchange1 ? rate1 : rate2).toString();

          const netProfitResult = netProfitCalculator.calculate(
            symbol,
            longExchange,
            shortExchange,
            longRate,
            shortRate
          );

          // Convert to percentage for consistency with other fields
          netReturn = parseFloat(netProfitResult.netProfit.mul(100).toFixed(4));
        } catch (error) {
          // If calculation fails, netReturn remains undefined
          logger.warn({ error }, 'Failed to calculate net return');
        }

        // Feature 057: 計算 isPriceDirectionCorrect
        // 規則：空方價格 >= 多方價格，或在 0.05% 容忍範圍內
        let isPriceDirectionCorrect: boolean | undefined;
        if (price1 && price2) {
          const shortPrice = shortExchange === exchange1 ? price1 : price2;
          const longPrice = shortExchange === exchange1 ? price2 : price1;
          const priceDiffRate = (shortPrice - longPrice) / shortPrice;

          if (priceDiffRate >= 0) {
            // 價差有利（做空交易所價格較高）
            isPriceDirectionCorrect = true;
          } else if (Math.abs(priceDiffRate) <= MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF) {
            // 價差略微不利，但在可接受範圍內
            isPriceDirectionCorrect = true;
          } else {
            // 價差明顯不利
            isPriceDirectionCorrect = false;
          }
        }
        // 如果沒有價格數據，isPriceDirectionCorrect 保持 undefined

        bestPair = {
          longExchange,
          shortExchange,
          spreadPercent: spread * 100,
          spreadAnnualized: spread * 365 * (24 / timeBasis) * 100,
          priceDiffPercent,
          netReturn,
          isPriceDirectionCorrect,
        };
      }
    }
  }

  // 建立向後兼容的屬性（如果 binance 和 okx 都存在）
  const binanceData = exchangesData.get('binance');
  const okxData = exchangesData.get('okx');

  return {
    symbol,
    exchanges: exchangesData,
    bestPair,
    recordedAt: new Date(),
    // 向後兼容
    binance: binanceData?.rate,
    okx: okxData?.rate,
    binancePrice: binanceData?.price,
    okxPrice: okxData?.price,
    spreadPercent: bestPair?.spreadPercent,
    spreadAnnualized: bestPair?.spreadAnnualized,
    priceDiffPercent: bestPair?.priceDiffPercent,
  };
}

/**
 * 建立資金費率配對（向後兼容函數）
 * @deprecated 使用 createMultiExchangeFundingRatePair 替代
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

  const exchangesData = new Map<ExchangeName, ExchangeRateData>();
  exchangesData.set('binance', { rate: binance, price: binancePrice });
  exchangesData.set('okx', { rate: okx, price: okxPrice });

  return createMultiExchangeFundingRatePair(binance.symbol, exchangesData);
}

/**
 * 記憶體儲存（暫時用，待資料庫建立後移除）
 *
 * 優化說明 (Validated Coalescing 模式)：
 * - 只保留每個 exchange:symbol 的最新一筆記錄
 * - 使用 timestamp 驗證，確保只有較新的資料才會覆蓋舊資料
 * - 減少記憶體使用量約 90%（從 25,000+ 物件降至 250 物件）
 */
export class FundingRateStore {
  /** 只保留最新一筆記錄（key: `${exchange}:${symbol}`） */
  private rates: Map<string, FundingRateRecord> = new Map();

  /**
   * 儲存資金費率記錄
   * 使用 Validated Coalescing：只有 timestamp 較新時才更新
   */
  save(rate: FundingRateRecord): void {
    const key = `${rate.exchange}:${rate.symbol}`;
    const existing = this.rates.get(key);

    // Validated: 只有更新的資料才覆蓋
    if (!existing || rate.recordedAt.getTime() > existing.recordedAt.getTime()) {
      this.rates.set(key, rate);
    }
  }

  /**
   * 取得最新的資金費率
   */
  getLatest(exchange: string, symbol: string): FundingRateRecord | undefined {
    const key = `${exchange}:${symbol}`;
    return this.rates.get(key);
  }

  /**
   * 取得歷史記錄
   * @deprecated 已簡化為只保留最新值，此方法僅為向後兼容保留
   * @returns 最新一筆記錄（若存在），否則空陣列
   */
  getHistory(exchange: string, symbol: string, _limit = 10): FundingRateRecord[] {
    const key = `${exchange}:${symbol}`;
    const latest = this.rates.get(key);
    return latest ? [latest] : [];
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

  /**
   * 取得目前儲存的記錄數量
   */
  size(): number {
    return this.rates.size;
  }
}
