/**
 * FundingRateHistoryService - 資金費率歷史查詢與穩定性分析服務
 *
 * 功能：
 * 1. 查詢各交易所的歷史資金費率
 * 2. 計算費率翻轉次數（正負交替）
 * 3. 判斷費率穩定性並產生警告訊息
 *
 * 支援的交易所：
 * - Binance: GET /fapi/v1/fundingRate
 * - OKX: GET /api/v5/public/funding-rate-history
 * - Gate.io: CCXT fetchFundingRateHistory
 * - BingX: CCXT fetchFundingRateHistory
 * - MEXC: 不支援（無歷史費率 API）
 */

import axios, { AxiosInstance } from 'axios';
import ccxt from 'ccxt';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../../lib/logger';
import { createCcxtExchange } from '../../lib/ccxt-factory';
import type { ExchangeName } from '../../connectors/types';

/** 單筆歷史資金費率記錄 */
export interface FundingRateHistory {
  exchange: ExchangeName;
  symbol: string;
  fundingRate: number;
  fundingTime: Date;
}

/** 費率穩定性分析結果 */
export interface RateStabilityResult {
  exchange: ExchangeName;
  symbol: string;
  /** 是否穩定（翻轉次數 < 閾值） */
  isStable: boolean;
  /** 過去 24h 翻轉次數 */
  flipCount: number;
  /** 方向一致性 (0-100%)，表示費率保持同一方向的比例 */
  directionConsistency: number;
  /** 歷史費率資料 */
  history: FundingRateHistory[];
  /** 警告訊息（不穩定時產生） */
  warning?: string;
  /** 是否支援查詢 */
  supported: boolean;
  /** 不支援時的原因 */
  unsupportedReason?: string;
}

/** 穩定性閾值配置 */
export interface StabilityConfig {
  /** 查詢時間範圍（小時），預設 24 */
  hoursToCheck: number;
  /** 翻轉次數閾值，超過此值視為不穩定，預設 2 */
  flipThreshold: number;
}

const DEFAULT_CONFIG: StabilityConfig = {
  hoursToCheck: 24,
  flipThreshold: 2,
};

/**
 * 計算費率翻轉次數
 * 翻轉定義：費率從正變負或從負變正（零值不計入）
 *
 * @param history 歷史費率資料（需按時間升序排列）
 * @returns 翻轉次數
 */
export function calculateFlipCount(history: FundingRateHistory[]): number {
  if (history.length < 2) {
    return 0;
  }

  let flips = 0;
  let lastNonZeroSign: number | null = null;

  for (const record of history) {
    const currentSign = Math.sign(record.fundingRate);

    // 忽略零值
    if (currentSign === 0) {
      continue;
    }

    // 初始化第一個非零值
    if (lastNonZeroSign === null) {
      lastNonZeroSign = currentSign;
      continue;
    }

    // 檢查是否翻轉（正負交替）
    if (currentSign !== lastNonZeroSign) {
      flips++;
      lastNonZeroSign = currentSign;
    }
  }

  return flips;
}

/**
 * 計算方向一致性
 * 表示費率保持同一方向（正或負）的比例
 *
 * @param history 歷史費率資料
 * @returns 一致性百分比 (0-100)
 */
export function calculateDirectionConsistency(history: FundingRateHistory[]): number {
  if (history.length === 0) {
    return 100;
  }

  // 過濾掉零值
  const nonZeroRates = history.filter((h) => h.fundingRate !== 0);

  if (nonZeroRates.length === 0) {
    return 100; // 全部為零視為穩定
  }

  const positiveCount = nonZeroRates.filter((h) => h.fundingRate > 0).length;
  const negativeCount = nonZeroRates.filter((h) => h.fundingRate < 0).length;

  // 取較多的方向比例
  const majorityCount = Math.max(positiveCount, negativeCount);
  return Math.round((majorityCount / nonZeroRates.length) * 100);
}

/**
 * FundingRateHistoryService
 * 資金費率歷史查詢與穩定性分析服務
 */
export class FundingRateHistoryService {
  private config: StabilityConfig;

  // Binance Futures API Base URL
  private readonly binanceBaseUrl = 'https://fapi.binance.com';
  // OKX Public API Base URL
  private readonly okxBaseUrl = 'https://www.okx.com';

  // CCXT 交易所實例快取
  private ccxtInstances: Map<ExchangeName, ccxt.Exchange> = new Map();

  // Axios 實例（含條件式 proxy 配置）
  private axiosInstance: AxiosInstance;

  constructor(config: Partial<StabilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 建立 axios 實例（條件式 proxy 配置）
    const proxyUrl = process.env.PROXY_URL;

    // ✅ 只有在有設定 PROXY_URL 時才使用 proxy
    // ✅ 沒有 PROXY_URL 時，行為與原本完全相同（直接連線）
    if (proxyUrl) {
      const agent = new HttpsProxyAgent(proxyUrl);
      this.axiosInstance = axios.create({
        timeout: 30000,
        httpAgent: agent,
        httpsAgent: agent,
      });
      logger.debug({ proxyUrl: proxyUrl.replace(/\/\/.*@/, '//<credentials>@') }, 'FundingRateHistoryService using proxy');
    } else {
      this.axiosInstance = axios.create({
        timeout: 30000,
      });
    }
  }

  /**
   * 取得 CCXT 交易所實例
   */
  private getCcxtExchange(exchange: ExchangeName): ccxt.Exchange {
    const cached = this.ccxtInstances.get(exchange);
    if (cached) {
      return cached;
    }

    let instance: ccxt.Exchange;


    switch (exchange) {
      case 'gateio':
        instance = createCcxtExchange('gateio', {
          options: { defaultType: 'swap' },
        });
        break;
      case 'bingx':
        instance = createCcxtExchange('bingx', {
          options: { defaultType: 'swap' },
        });
        break;
      default:
        throw new Error(`CCXT instance not needed for ${exchange}`);
    }

    this.ccxtInstances.set(exchange, instance);
    return instance;
  }

  /**
   * 查詢單一交易所的歷史資金費率
   *
   * @param exchange 交易所名稱
   * @param symbol 交易對（如 BTCUSDT）
   * @param hours 查詢時間範圍（小時），預設 24
   * @returns 歷史費率資料
   */
  async getHistory(
    exchange: ExchangeName,
    symbol: string,
    hours: number = this.config.hoursToCheck
  ): Promise<FundingRateHistory[]> {
    switch (exchange) {
      case 'binance':
        return this.getBinanceHistory(symbol, hours);
      case 'okx':
        return this.getOkxHistory(symbol, hours);
      case 'gateio':
        return this.getGateioHistory(symbol, hours);
      case 'bingx':
        return this.getBingxHistory(symbol, hours);
      case 'mexc':
        // MEXC 不支援歷史費率查詢
        return [];
      default:
        logger.warn({ exchange, symbol }, 'Unknown exchange for funding rate history');
        return [];
    }
  }

  /**
   * 查詢 Binance 歷史資金費率
   * API: GET /fapi/v1/fundingRate
   */
  private async getBinanceHistory(
    symbol: string,
    hours: number
  ): Promise<FundingRateHistory[]> {
    try {
      const endTime = Date.now();
      const startTime = endTime - hours * 60 * 60 * 1000;

      // Binance API 一次最多返回 1000 筆，8h 間隔的話 24h 只有 3 筆
      const response = await this.axiosInstance.get(`${this.binanceBaseUrl}/fapi/v1/fundingRate`, {
        params: {
          symbol,
          startTime,
          endTime,
          limit: 100,
        },
      });

      const data = response.data as Array<{
        symbol: string;
        fundingRate: string;
        fundingTime: number;
      }>;

      // 按時間升序排列
      const history: FundingRateHistory[] = data
        .map((item) => ({
          exchange: 'binance' as ExchangeName,
          symbol: item.symbol,
          fundingRate: parseFloat(item.fundingRate),
          fundingTime: new Date(item.fundingTime),
        }))
        .sort((a, b) => a.fundingTime.getTime() - b.fundingTime.getTime());

      logger.debug(
        { exchange: 'binance', symbol, hours, count: history.length },
        'Fetched Binance funding rate history'
      );

      return history;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { exchange: 'binance', symbol, error: message },
        'Failed to fetch Binance funding rate history'
      );
      return [];
    }
  }

  /**
   * 查詢 OKX 歷史資金費率
   * API: GET /api/v5/public/funding-rate-history
   */
  private async getOkxHistory(
    symbol: string,
    hours: number
  ): Promise<FundingRateHistory[]> {
    try {
      // OKX 使用 instId 格式：BTC-USDT-SWAP
      const instId = this.convertToOkxSymbol(symbol);

      const response = await this.axiosInstance.get(`${this.okxBaseUrl}/api/v5/public/funding-rate-history`, {
        params: {
          instId,
          limit: 100,
        },
      });

      const data = response.data?.data as Array<{
        instId: string;
        fundingRate: string;
        fundingTime: string;
      }> | undefined;

      if (!data || !Array.isArray(data)) {
        return [];
      }

      const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

      // 按時間升序排列並過濾時間範圍
      const history: FundingRateHistory[] = data
        .map((item) => ({
          exchange: 'okx' as ExchangeName,
          symbol,
          fundingRate: parseFloat(item.fundingRate),
          fundingTime: new Date(parseInt(item.fundingTime)),
        }))
        .filter((h) => h.fundingTime.getTime() >= cutoffTime)
        .sort((a, b) => a.fundingTime.getTime() - b.fundingTime.getTime());

      logger.debug(
        { exchange: 'okx', symbol, hours, count: history.length },
        'Fetched OKX funding rate history'
      );

      return history;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { exchange: 'okx', symbol, error: message },
        'Failed to fetch OKX funding rate history'
      );
      return [];
    }
  }

  /**
   * 查詢 Gate.io 歷史資金費率（使用 CCXT）
   */
  private async getGateioHistory(
    symbol: string,
    hours: number
  ): Promise<FundingRateHistory[]> {
    try {
      const exchange = this.getCcxtExchange('gateio');
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);

      const since = Date.now() - hours * 60 * 60 * 1000;

      // 使用 any 斷言調用 fetchFundingRateHistory（不在 CCXT 基礎型別中）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fundingRates = await (exchange as any).fetchFundingRateHistory(ccxtSymbol, since, 100);

      interface FundingRateRecord { fundingRate?: number; timestamp?: number }
      const history: FundingRateHistory[] = (fundingRates as FundingRateRecord[])
        .map((rate) => ({
          exchange: 'gateio' as ExchangeName,
          symbol,
          fundingRate: rate.fundingRate || 0,
          fundingTime: new Date(rate.timestamp || Date.now()),
        }))
        .sort((a, b) => a.fundingTime.getTime() - b.fundingTime.getTime());

      logger.debug(
        { exchange: 'gateio', symbol, hours, count: history.length },
        'Fetched Gate.io funding rate history'
      );

      return history;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { exchange: 'gateio', symbol, error: message },
        'Failed to fetch Gate.io funding rate history'
      );
      return [];
    }
  }

  /**
   * 查詢 BingX 歷史資金費率（使用 CCXT）
   */
  private async getBingxHistory(
    symbol: string,
    hours: number
  ): Promise<FundingRateHistory[]> {
    try {
      const exchange = this.getCcxtExchange('bingx');
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);

      const since = Date.now() - hours * 60 * 60 * 1000;

      // 使用 any 斷言調用 fetchFundingRateHistory（不在 CCXT 基礎型別中）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fundingRates = await (exchange as any).fetchFundingRateHistory(ccxtSymbol, since, 100);

      interface FundingRateRecord { fundingRate?: number; timestamp?: number }
      const history: FundingRateHistory[] = (fundingRates as FundingRateRecord[])
        .map((rate) => ({
          exchange: 'bingx' as ExchangeName,
          symbol,
          fundingRate: rate.fundingRate || 0,
          fundingTime: new Date(rate.timestamp || Date.now()),
        }))
        .sort((a, b) => a.fundingTime.getTime() - b.fundingTime.getTime());

      logger.debug(
        { exchange: 'bingx', symbol, hours, count: history.length },
        'Fetched BingX funding rate history'
      );

      return history;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { exchange: 'bingx', symbol, error: message },
        'Failed to fetch BingX funding rate history'
      );
      return [];
    }
  }

  /**
   * 檢查單一交易所的費率穩定性
   *
   * @param exchange 交易所名稱
   * @param symbol 交易對
   * @returns 穩定性分析結果
   */
  async checkStability(
    exchange: ExchangeName,
    symbol: string
  ): Promise<RateStabilityResult> {
    // MEXC 不支援歷史費率查詢
    if (exchange === 'mexc') {
      return {
        exchange,
        symbol,
        isStable: true, // 預設視為穩定（因為無法判斷）
        flipCount: 0,
        directionConsistency: 100,
        history: [],
        supported: false,
        unsupportedReason: 'MEXC 不提供歷史資金費率 API，無法進行穩定性分析',
      };
    }

    // 查詢歷史資料
    const history = await this.getHistory(exchange, symbol, this.config.hoursToCheck);

    // 無法取得歷史資料
    if (history.length === 0) {
      return {
        exchange,
        symbol,
        isStable: true, // 預設視為穩定
        flipCount: 0,
        directionConsistency: 100,
        history: [],
        supported: true,
        warning: '無法取得歷史資金費率資料',
      };
    }

    // 計算翻轉次數和方向一致性
    const flipCount = calculateFlipCount(history);
    const directionConsistency = calculateDirectionConsistency(history);

    // 判斷是否穩定
    const isStable = flipCount < this.config.flipThreshold;

    // 產生警告訊息
    let warning: string | undefined;
    if (!isStable) {
      warning = `過去 ${this.config.hoursToCheck} 小時內費率翻轉 ${flipCount} 次（正負交替），方向一致性 ${directionConsistency}%，可能造成套利虧損`;
    }

    logger.info(
      {
        exchange,
        symbol,
        flipCount,
        directionConsistency,
        isStable,
        historyCount: history.length,
      },
      'Funding rate stability checked'
    );

    return {
      exchange,
      symbol,
      isStable,
      flipCount,
      directionConsistency,
      history,
      warning,
      supported: true,
    };
  }

  /**
   * 批量檢查多個交易所的費率穩定性
   *
   * @param pairs 交易所和交易對的組合
   * @returns 穩定性分析結果陣列
   */
  async checkStabilityBatch(
    pairs: Array<{ exchange: ExchangeName; symbol: string }>
  ): Promise<RateStabilityResult[]> {
    const results = await Promise.all(
      pairs.map((pair) => this.checkStability(pair.exchange, pair.symbol))
    );
    return results;
  }

  /**
   * 轉換為 OKX 交易對格式
   * BTCUSDT -> BTC-USDT-SWAP
   */
  private convertToOkxSymbol(symbol: string): string {
    if (symbol.endsWith('USDT')) {
      const base = symbol.slice(0, -4);
      return `${base}-USDT-SWAP`;
    }
    return symbol;
  }

  /**
   * 轉換為 CCXT 交易對格式
   * BTCUSDT -> BTC/USDT:USDT
   */
  private convertToCcxtSymbol(symbol: string): string {
    if (symbol.endsWith('USDT')) {
      const base = symbol.slice(0, -4);
      return `${base}/USDT:USDT`;
    }
    return symbol;
  }

  /**
   * 清理資源
   */
  destroy(): void {
    this.ccxtInstances.clear();
  }
}

/** 預設服務實例 */
let defaultService: FundingRateHistoryService | null = null;

/**
 * 取得預設服務實例（Singleton）
 */
export function getFundingRateHistoryService(): FundingRateHistoryService {
  if (!defaultService) {
    defaultService = new FundingRateHistoryService();
  }
  return defaultService;
}

export default FundingRateHistoryService;
