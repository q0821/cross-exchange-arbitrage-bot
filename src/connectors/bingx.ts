/**
 * BingX Exchange Connector
 *
 * Feature: 043-bingx-integration
 * 使用 CCXT 4.x 連接 BingX 永續合約交易所
 *
 * BingX 特點：
 * - 支援 1h、4h、8h 資金費率結算週期
 * - 永續合約符號格式：BTC/USDT:USDT
 * - 支援附加條件單（stopLoss / takeProfit）
 */

import ccxt from 'ccxt';
import { BaseExchangeConnector } from './base.js';
import {
  FundingRateData,
  PriceData,
  OrderRequest,
  OrderResponse,
  AccountBalance,
  PositionInfo,
  Position,
  SymbolInfo,
  WSSubscription,
  WSSubscriptionType,
  OrderSide,
} from './types.js';
import { apiKeys } from '../lib/config.js';
import { exchangeLogger as logger } from '../lib/logger.js';
import {
  ExchangeApiError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
} from '../lib/errors.js';
import { retryApiCall } from '../lib/retry.js';
import { FundingIntervalCache } from '../lib/FundingIntervalCache.js';

export class BingxConnector extends BaseExchangeConnector {
  private client: ccxt.Exchange | null = null;
  private intervalCache: FundingIntervalCache;

  constructor(isTestnet: boolean = false) {
    super('bingx', isTestnet);
    this.intervalCache = new FundingIntervalCache();
  }

  async connect(): Promise<void> {
    try {
      const { apiKey, apiSecret, testnet } = apiKeys.bingx;

      // 建立 CCXT 客戶端（可以沒有 API Key，仍能存取公開 API）
      const config: any = {
        enableRateLimit: true,
        options: {
          defaultType: 'swap', // 使用永續合約
          ...(testnet && { sandboxMode: true }),
        },
      };

      // 如果有 API Key 則加入配置（用於私有 API）
      if (apiKey && apiSecret) {
        config.apiKey = apiKey;
        config.secret = apiSecret;
        logger.info('BingX connector initialized with API credentials');
      } else {
        logger.info('BingX connector initialized without API credentials (public data only)');
      }

      this.client = new (ccxt as any).bingx(config) as ccxt.Exchange;

      // 測試連線
      await this.testConnection();

      this.connected = true;
      logger.info({ testnet, hasApiKey: !!apiKey }, 'BingX connector connected');
      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to connect to BingX');
      throw new ExchangeConnectionError('bingx', { originalError: err.message });
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
    this.wsConnected = false;

    logger.info('BingX connector disconnected');
    this.emit('disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new ExchangeConnectionError('bingx');
    }

    try {
      await this.client.fetchTime();
    } catch (error) {
      throw new ExchangeConnectionError('bingx', {
        message: 'Connection test failed',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRateData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const fundingRate = await this.client!.fetchFundingRate(ccxtSymbol);

        // 獲取動態間隔
        const interval = await this.getFundingInterval(symbol, fundingRate);

        return {
          exchange: 'bingx',
          symbol: this.fromCcxtSymbol(fundingRate.symbol),
          fundingRate: fundingRate.fundingRate || 0,
          nextFundingTime: new Date((fundingRate as ccxt.FundingRate & { nextFundingTimestamp?: number }).nextFundingTimestamp || Date.now()),
          markPrice: fundingRate.markPrice,
          indexPrice: fundingRate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: interval,
        } as FundingRateData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getFundingRate');
  }

  async getFundingRates(symbols: string[]): Promise<FundingRateData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const fundingRates = await this.client!.fetchFundingRates(ccxtSymbols);

        const ratesArray = Object.values(fundingRates) as ccxt.FundingRate[];

        // 批量獲取間隔值
        const intervalPromises = ratesArray.map((rate) =>
          this.getFundingInterval(this.fromCcxtSymbol(rate.symbol), rate)
        );
        const intervals = await Promise.all(intervalPromises);

        return ratesArray.map((rate, index) => ({
          exchange: 'bingx',
          symbol: this.fromCcxtSymbol(rate.symbol),
          fundingRate: rate.fundingRate || 0,
          nextFundingTime: new Date((rate as ccxt.FundingRate & { nextFundingTimestamp?: number }).nextFundingTimestamp || Date.now()),
          markPrice: rate.markPrice,
          indexPrice: rate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: intervals[index],
        })) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getFundingRates');
  }

  /**
   * 獲取單一交易對的資金費率間隔(小時)
   *
   * BingX 支援 1h、4h、8h 三種週期
   * 優先從 CCXT response 的 info 欄位讀取間隔值
   *
   * @param symbol 交易對符號 (如 'BTCUSDT')
   * @param fundingRate 可選的 CCXT funding rate response (用於計算)
   * @returns 間隔值(小時)
   */
  async getFundingInterval(symbol: string, fundingRate?: ccxt.FundingRate): Promise<number> {
    this.ensureConnected();

    try {
      // 1. 檢查快取
      const cached = this.intervalCache.get('bingx', symbol);
      if (cached !== null) {
        logger.debug({ symbol, interval: cached, source: 'cache' }, 'Interval retrieved from cache');
        return cached;
      }

      // 2. 如果有 fundingRate，嘗試從 info 欄位讀取間隔
      if (fundingRate) {
        const interval = this.extractIntervalFromResponse(fundingRate);
        if (interval) {
          this.intervalCache.set('bingx', symbol, interval, 'native-api');
          logger.info({ symbol, interval, source: 'native-api' }, 'Funding interval extracted from BingX API response');
          return interval;
        }
      }

      // 3. 沒有資料則 fetch 新的
      const ccxtSymbol = this.toCcxtSymbol(symbol);
      const newFundingRate = await this.client!.fetchFundingRate(ccxtSymbol);
      const interval = this.extractIntervalFromResponse(newFundingRate);

      if (interval) {
        this.intervalCache.set('bingx', symbol, interval, 'native-api');
        logger.info({ symbol, interval, source: 'native-api' }, 'Funding interval fetched from BingX API');
        return interval;
      }

      // 4. 無法取得，使用預設值
      logger.warn({ symbol }, 'Unable to extract funding interval from BingX API, using default 8h');
      this.intervalCache.set('bingx', symbol, 8, 'default');
      return 8;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn({ symbol, error: err.message }, 'Failed to fetch funding interval, using default 8h');
      return 8;
    }
  }

  /**
   * 從 CCXT funding rate response 提取間隔值
   *
   * BingX API 回傳的 info 欄位可能包含:
   * - fundingIntervalHours: 直接的小時數
   * - fundingInterval: 毫秒數
   * - 或從 nextFundingTime 與當前時間計算
   */
  private extractIntervalFromResponse(fundingRate: ccxt.FundingRate): number | null {
    const info = (fundingRate as any).info;

    // 方法 1: 檢查 info 中的 fundingIntervalHours (直接小時數)
    if (info?.fundingIntervalHours) {
      const hours = parseInt(info.fundingIntervalHours, 10);
      if (!isNaN(hours) && [1, 4, 8].includes(hours)) {
        return hours;
      }
    }

    // 方法 2: 檢查 info 中的 fundingInterval (可能是毫秒)
    if (info?.fundingInterval) {
      const intervalMs = parseInt(info.fundingInterval, 10);
      if (!isNaN(intervalMs) && intervalMs > 0) {
        const hours = Math.round(intervalMs / (1000 * 60 * 60));
        if ([1, 4, 8].includes(hours)) {
          return hours;
        }
      }
    }

    // 方法 3: 從 nextFundingTimestamp 推算
    // BingX 資金費率在固定時間點結算，可根據 nextFundingTime 推算間隔
    const nextTime = (fundingRate as ccxt.FundingRate & { nextFundingTimestamp?: number }).nextFundingTimestamp;
    if (nextTime) {
      const now = Date.now();
      const timeToNext = nextTime - now;

      // 如果距離下次結算時間合理，可推算間隔
      // 1h 間隔: timeToNext 應在 0-1h 內
      // 4h 間隔: timeToNext 應在 0-4h 內
      // 8h 間隔: timeToNext 應在 0-8h 內
      const hoursToNext = timeToNext / (1000 * 60 * 60);

      if (hoursToNext > 0 && hoursToNext <= 1) {
        return 1;
      } else if (hoursToNext > 1 && hoursToNext <= 4) {
        return 4;
      } else if (hoursToNext > 4 && hoursToNext <= 8) {
        return 8;
      }
    }

    return null;
  }

  async getPrice(symbol: string): Promise<PriceData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const ticker = await this.client!.fetchTicker(ccxtSymbol);

        return {
          exchange: 'bingx',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        } as PriceData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getPrice');
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const tickers = await this.client!.fetchTickers(ccxtSymbols);

        return (Object.values(tickers) as ccxt.Ticker[]).map((ticker) => ({
          exchange: 'bingx',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        })) as PriceData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getPrices');
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    // 檢查快取
    const cached = this.getCachedSymbolInfo(symbol);
    if (cached) {
      return cached;
    }

    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const markets = await this.client!.loadMarkets();
        const market = markets[ccxtSymbol];

        if (!market) {
          throw new Error(`Symbol ${symbol} not found on BingX`);
        }

        const info: SymbolInfo = {
          symbol: this.fromCcxtSymbol(market.symbol),
          baseAsset: market.base,
          quoteAsset: market.quote,
          minQuantity: market.limits.amount?.min || 0,
          maxQuantity: market.limits.amount?.max || Number.MAX_SAFE_INTEGER,
          minNotional: market.limits.cost?.min || 0,
          pricePrecision: market.precision.price || 8,
          quantityPrecision: market.precision.amount || 8,
          tickSize: market.precision.price ? Math.pow(10, -market.precision.price) : 0.00000001,
          stepSize: market.precision.amount ? Math.pow(10, -market.precision.amount) : 0.00000001,
          isActive: market.active,
        };

        this.cacheSymbolInfo(symbol, info);
        return info;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getSymbolInfo');
  }

  async getBalance(): Promise<AccountBalance> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const balance = await this.client!.fetchBalance();

        const balances = Object.entries(balance.total)
          .filter(([_, amount]) => (amount as number) > 0)
          .map(([asset, total]) => ({
            asset,
            free: (balance.free[asset] as number) || 0,
            locked: (balance.used[asset] as number) || 0,
            total: total as number,
          }));

        // 計算總權益 (使用 USDT 計價)
        const totalEquityUSD = (balance.total['USDT'] as number) || 0;

        return {
          exchange: 'bingx',
          balances,
          totalEquityUSD,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getBalance');
  }

  async getPositions(): Promise<PositionInfo> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const positions = await this.client!.fetchPositions();

        const formattedPositions: Position[] = positions
          .filter((pos: ccxt.Position) => parseFloat(pos.contracts?.toString() || '0') > 0)
          .map((pos: ccxt.Position) => ({
            symbol: this.fromCcxtSymbol(pos.symbol),
            side: pos.side === 'long' ? 'LONG' : 'SHORT',
            quantity: parseFloat(pos.contracts?.toString() || '0'),
            entryPrice: pos.entryPrice || 0,
            markPrice: pos.markPrice || 0,
            leverage: pos.leverage || 1,
            marginUsed: parseFloat(pos.initialMargin?.toString() || '0'),
            unrealizedPnl: pos.unrealizedPnl || 0,
            liquidationPrice: pos.liquidationPrice,
            timestamp: new Date(pos.timestamp || Date.now()),
          }));

        return {
          exchange: 'bingx',
          positions: formattedPositions,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getPositions');
  }

  async getPosition(symbol: string): Promise<Position | null> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const positions = await this.client!.fetchPositions([ccxtSymbol]);

        const position = positions.find(
          (pos: ccxt.Position) =>
            pos.symbol === ccxtSymbol && parseFloat(pos.contracts?.toString() || '0') > 0
        );

        if (!position) {
          return null;
        }

        return {
          symbol: this.fromCcxtSymbol(position.symbol),
          side: position.side === 'long' ? 'LONG' : 'SHORT',
          quantity: parseFloat(position.contracts?.toString() || '0'),
          entryPrice: position.entryPrice || 0,
          markPrice: position.markPrice || 0,
          leverage: position.leverage || 1,
          marginUsed: parseFloat(position.initialMargin?.toString() || '0'),
          unrealizedPnl: position.unrealizedPnl || 0,
          liquidationPrice: position.liquidationPrice,
          timestamp: new Date(position.timestamp || Date.now()),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getPosition');
  }

  async createOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(order.symbol);
        const side = order.side === 'LONG' ? 'buy' : 'sell';
        const type = order.type.toLowerCase();

        const params: Record<string, unknown> = {};

        if (order.leverage) {
          params.leverage = order.leverage;
        }

        if (order.clientOrderId) {
          params.clientOrderId = order.clientOrderId;
        }

        const ccxtOrder = await this.client!.createOrder(
          ccxtSymbol,
          type,
          side,
          order.quantity,
          order.price,
          params
        );

        return {
          orderId: ccxtOrder.id,
          clientOrderId: ccxtOrder.clientOrderId,
          symbol: this.fromCcxtSymbol(ccxtOrder.symbol),
          side: order.side,
          type: order.type,
          status: this.mapOrderStatus(ccxtOrder.status || 'open'),
          quantity: ccxtOrder.amount,
          filledQuantity: ccxtOrder.filled || 0,
          price: ccxtOrder.price,
          averagePrice: ccxtOrder.average || 0,
          fee: ccxtOrder.fee?.cost || 0,
          feeCurrency: ccxtOrder.fee?.currency || 'USDT',
          timestamp: new Date(ccxtOrder.timestamp || Date.now()),
        } as OrderResponse;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'createOrder');
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        await this.client!.cancelOrder(orderId, ccxtSymbol);
        logger.info({ exchange: 'bingx', symbol, orderId }, 'Order cancelled');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'cancelOrder');
  }

  async getOrder(symbol: string, orderId: string): Promise<OrderResponse> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const order = await this.client!.fetchOrder(orderId, ccxtSymbol);

        const side: OrderSide = order.side === 'buy' ? 'LONG' : 'SHORT';

        return {
          orderId: order.id,
          clientOrderId: order.clientOrderId,
          symbol: this.fromCcxtSymbol(order.symbol),
          side,
          type: order.type?.toUpperCase() as 'MARKET' | 'LIMIT',
          status: this.mapOrderStatus(order.status || 'open'),
          quantity: order.amount,
          filledQuantity: order.filled || 0,
          price: order.price,
          averagePrice: order.average || 0,
          fee: order.fee?.cost || 0,
          feeCurrency: order.fee?.currency || 'USDT',
          timestamp: new Date(order.timestamp || Date.now()),
        } as OrderResponse;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'getOrder');
  }

  /**
   * 設定槓桿倍數
   * @param leverage 槓桿倍數
   * @param symbol 交易對符號
   */
  async setLeverage(leverage: number, symbol: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        // CCXT Exchange 類型可能沒有 setLeverage，但 bingx 有支援
        await (this.client as ccxt.Exchange & { setLeverage: (leverage: number, symbol: string) => Promise<unknown> }).setLeverage(leverage, ccxtSymbol);
        logger.info({ exchange: 'bingx', symbol, leverage }, 'Leverage set');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'setLeverage');
  }

  /**
   * 設定持倉模式
   * @param hedged true=雙向持倉, false=單向持倉
   * @param symbol 交易對符號 (可選)
   */
  async setPositionMode(hedged: boolean, symbol?: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = symbol ? this.toCcxtSymbol(symbol) : undefined;
        // CCXT Exchange 類型可能沒有 setPositionMode，但 bingx 有支援
        await (this.client as ccxt.Exchange & { setPositionMode: (hedged: boolean, symbol?: string) => Promise<unknown> }).setPositionMode(hedged, ccxtSymbol);
        logger.info({ exchange: 'bingx', hedged, symbol }, 'Position mode set');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'bingx', 'setPositionMode');
  }

  async subscribeWS(_subscription: WSSubscription): Promise<void> {
    // TODO: 實作 WebSocket 訂閱
    logger.warn('WebSocket subscription not yet implemented for BingX');
  }

  async unsubscribeWS(_type: WSSubscriptionType, _symbol?: string): Promise<void> {
    // TODO: 實作 WebSocket 取消訂閱
    logger.warn('WebSocket unsubscription not yet implemented for BingX');
  }

  // ============================================================================
  // 輔助方法
  // ============================================================================

  /**
   * 轉換符號格式
   * BTCUSDT -> BTC/USDT:USDT (永續合約格式)
   */
  private toCcxtSymbol(symbol: string): string {
    const base = symbol.replace('USDT', '');
    return `${base}/USDT:USDT`;
  }

  /**
   * 反轉換符號格式
   * BTC/USDT:USDT -> BTCUSDT
   */
  private fromCcxtSymbol(ccxtSymbol: string): string {
    return ccxtSymbol.replace(/\//g, '').replace(':USDT', '');
  }

  private mapOrderStatus(
    status: string
  ): 'FILLED' | 'PARTIAL' | 'CANCELED' | 'FAILED' | 'PENDING' {
    switch (status.toLowerCase()) {
      case 'closed':
      case 'filled':
        return 'FILLED';
      case 'open':
      case 'partially_filled':
        return 'PARTIAL';
      case 'canceled':
      case 'cancelled':
      case 'expired':
        return 'CANCELED';
      case 'rejected':
      case 'failed':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private handleApiError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 速率限制錯誤
      if (message.includes('rate limit') || message.includes('429')) {
        return new ExchangeRateLimitError('bingx', { originalError: error.message });
      }

      // CCXT 錯誤
      if (error instanceof ccxt.NetworkError) {
        return new ExchangeConnectionError('bingx', { originalError: error.message });
      }

      if (error instanceof ccxt.ExchangeError) {
        return new ExchangeApiError('bingx', 'API_ERROR', error.message);
      }

      return error;
    }

    return new ExchangeApiError('bingx', 'UNKNOWN', String(error));
  }
}
