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
import axios from 'axios';
import Decimal from 'decimal.js';
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
import { parseCcxtFundingRate } from '../lib/schemas/websocket-messages.js';
import type { FundingRateReceived } from '../types/websocket-events.js';

export class BingxConnector extends BaseExchangeConnector {
  private client: ccxt.Exchange | null = null;
  private intervalCache: FundingIntervalCache;

  // WebSocket 相關屬性 (Feature 052: T064)
  private wsCallbacks: Map<string, (data: FundingRateReceived) => void> = new Map();
  private wsWatchLoops: Map<string, { running: boolean; abortController: AbortController }> = new Map();
  private isWsDestroyed = false;

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
   * 從資金費率歷史 API 計算間隔
   *
   * @param symbol 交易對符號 (如 'BTCUSDT')
   * @param _fundingRate 可選的 CCXT funding rate response (未使用，保留相容性)
   * @returns 間隔值(小時)
   */
  async getFundingInterval(symbol: string, _fundingRate?: ccxt.FundingRate): Promise<number> {
    try {
      // 1. 檢查快取
      const cached = this.intervalCache.get('bingx', symbol);
      if (cached !== null) {
        return cached;
      }

      // 2. 呼叫 BingX 原生 API 取得資金費率歷史並計算間隔
      const interval = await this.fetchIntervalFromHistory(symbol);
      if (interval) {
        this.intervalCache.set('bingx', symbol, interval, 'native-api');
        logger.info({ symbol, interval, source: 'native-api' }, 'Funding interval calculated from BingX history');
        return interval;
      }

      // 3. 無法取得，使用預設值
      this.intervalCache.set('bingx', symbol, 8, 'default');
      return 8;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn({ symbol, error: err.message }, 'Failed to fetch funding interval, using default 8h');
      return 8;
    }
  }

  /**
   * 從 BingX 資金費率歷史 API 計算間隔
   *
   * @param symbol 交易對符號 (如 'BTCUSDT')
   * @returns 間隔值(小時)，失敗返回 null
   */
  private async fetchIntervalFromHistory(symbol: string): Promise<number | null> {
    try {
      // 轉換符號格式: BTCUSDT -> BTC-USDT
      const bingxSymbol = this.toBingxSymbol(symbol);

      const response = await axios.get('https://open-api.bingx.com/openApi/swap/v2/quote/fundingRate', {
        params: { symbol: bingxSymbol, limit: 2 },
        timeout: 5000,
      });

      if (response.data.code === 0 && response.data.data?.length >= 2) {
        const history = response.data.data;
        const current = history[0];
        const previous = history[1];

        const diffMs = current.fundingTime - previous.fundingTime;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));

        // BingX 支援 1h、4h、8h
        if ([1, 4, 8].includes(diffHours)) {
          return diffHours;
        }

        logger.warn({ symbol, diffHours }, 'Unexpected funding interval from BingX');
      }

      return null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug({ symbol, error: err.message }, 'Failed to fetch funding history from BingX');
      return null;
    }
  }

  /**
   * 轉換符號格式為 BingX API 格式
   * BTCUSDT -> BTC-USDT
   */
  private toBingxSymbol(symbol: string): string {
    // 處理已經是 BTC-USDT 格式的情況
    if (symbol.includes('-')) {
      return symbol;
    }
    // BTCUSDT -> BTC-USDT
    const base = symbol.replace('USDT', '');
    return `${base}-USDT`;
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

        // 計算總權益和可用餘額 (使用 USDT 計價)
        const totalEquityUSD = (balance.total['USDT'] as number) || 0;
        const availableBalanceUSD = (balance.free['USDT'] as number) || 0;

        return {
          exchange: 'bingx',
          balances,
          totalEquityUSD,
          availableBalanceUSD,
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

  /**
   * 訂閱 WebSocket 數據
   * Feature: 052-specify-scripts-bash
   * Task: T064 - BingX 資金費率訂閱 via CCXT watchFundingRate
   */
  async subscribeWS(subscription: WSSubscription): Promise<void> {
    this.ensureConnected();

    const { type, symbol, callback, onError } = subscription;

    if (type !== 'fundingRate') {
      logger.warn({ type }, 'BingX WebSocket subscription type not supported yet');
      return;
    }

    if (!symbol) {
      throw new Error('Symbol is required for fundingRate subscription');
    }

    const ccxtSymbol = this.toCcxtSymbol(symbol);
    const subscriptionKey = `fundingRate:${symbol}`;

    // 檢查是否已經訂閱
    if (this.wsWatchLoops.has(subscriptionKey)) {
      logger.warn({ symbol }, 'Already subscribed to BingX funding rate');
      return;
    }

    // 保存回調函數
    if (callback) {
      this.wsCallbacks.set(subscriptionKey, callback as (data: FundingRateReceived) => void);
    }

    logger.info({ symbol, ccxtSymbol }, 'Subscribing to BingX funding rate via CCXT watchFundingRate');

    // 創建 watch loop
    const abortController = new AbortController();
    const loopState = { running: true, abortController };
    this.wsWatchLoops.set(subscriptionKey, loopState);

    // 啟動 watch loop（非阻塞）
    this.startFundingRateWatchLoop(subscriptionKey, ccxtSymbol, symbol, onError).catch((error) => {
      logger.error({ error: error instanceof Error ? error.message : String(error), symbol }, 'BingX funding rate watch loop failed');
    });

    this.wsConnected = true;
    this.emit('wsConnected');
  }

  /**
   * 啟動資金費率 watch loop
   * Feature: 052-specify-scripts-bash
   * Task: T064
   */
  private async startFundingRateWatchLoop(
    subscriptionKey: string,
    ccxtSymbol: string,
    symbol: string,
    onError?: (error: Error) => void
  ): Promise<void> {
    const loopState = this.wsWatchLoops.get(subscriptionKey);
    if (!loopState) return;

    while (loopState.running && !this.isWsDestroyed) {
      try {
        // 使用 CCXT Pro 的 watchFundingRate
        type CcxtProClient = ccxt.Exchange & {
          watchFundingRate: (symbol: string) => Promise<ccxt.FundingRate>;
        };
        const proClient = this.client as CcxtProClient;

        if (typeof proClient.watchFundingRate !== 'function') {
          logger.warn({ ccxtSymbol }, 'BingX CCXT client does not support watchFundingRate, using fallback');
          // Fallback: 使用 REST API 輪詢
          await this.fallbackFundingRatePoll(subscriptionKey, symbol);
          return;
        }

        const fundingRate = await proClient.watchFundingRate(ccxtSymbol);

        // 解析 CCXT 格式
        const parseResult = parseCcxtFundingRate(fundingRate);
        if (!parseResult.success) {
          logger.warn({ symbol }, 'Failed to parse BingX funding rate');
          continue;
        }

        // 轉換為內部格式
        const data: FundingRateReceived = {
          exchange: 'bingx',
          symbol,
          fundingRate: new Decimal(parseResult.data.fundingRate),
          nextFundingTime: parseResult.data.fundingTimestamp
            ? new Date(parseResult.data.fundingTimestamp)
            : new Date(),
          markPrice: parseResult.data.markPrice ? new Decimal(parseResult.data.markPrice) : undefined,
          indexPrice: parseResult.data.indexPrice ? new Decimal(parseResult.data.indexPrice) : undefined,
          source: 'websocket',
          receivedAt: new Date(),
        };

        // 調用回調
        const callback = this.wsCallbacks.get(subscriptionKey);
        if (callback) {
          callback(data);
        }

        // 發送事件
        this.emit('fundingRate', data);
      } catch (error) {
        if (!loopState.running || this.isWsDestroyed) break;

        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err.message, symbol }, 'BingX watchFundingRate error');

        if (onError) {
          onError(err);
        }

        // 等待後重試
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    logger.info({ symbol }, 'BingX funding rate watch loop stopped');
  }

  /**
   * Fallback: 使用 REST API 輪詢資金費率
   * Feature: 052-specify-scripts-bash
   * Task: T064
   */
  private async fallbackFundingRatePoll(
    subscriptionKey: string,
    symbol: string
  ): Promise<void> {
    const loopState = this.wsWatchLoops.get(subscriptionKey);
    if (!loopState) return;

    while (loopState.running && !this.isWsDestroyed) {
      try {
        const fundingRateData = await this.getFundingRate(symbol);

        // 轉換為 FundingRateReceived 格式
        const data: FundingRateReceived = {
          exchange: 'bingx',
          symbol,
          fundingRate: new Decimal(fundingRateData.fundingRate),
          nextFundingTime: fundingRateData.nextFundingTime,
          markPrice: fundingRateData.markPrice ? new Decimal(fundingRateData.markPrice) : undefined,
          indexPrice: fundingRateData.indexPrice ? new Decimal(fundingRateData.indexPrice) : undefined,
          source: 'rest',
          receivedAt: new Date(),
        };

        const callback = this.wsCallbacks.get(subscriptionKey);
        if (callback) {
          callback(data);
        }

        // 發送事件
        this.emit('fundingRate', data);

        // REST 輪詢間隔 5 秒
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        if (!loopState.running || this.isWsDestroyed) break;

        logger.error({
          error: error instanceof Error ? error.message : String(error),
          symbol,
        }, 'BingX fallback funding rate poll error');

        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * 取消訂閱 WebSocket 數據
   * Feature: 052-specify-scripts-bash
   * Task: T064 - BingX 資金費率取消訂閱
   */
  async unsubscribeWS(type: WSSubscriptionType, symbol?: string): Promise<void> {
    if (type !== 'fundingRate') {
      logger.warn({ type }, 'BingX WebSocket unsubscription type not supported yet');
      return;
    }

    if (symbol) {
      // 取消單一符號訂閱
      const subscriptionKey = `fundingRate:${symbol}`;
      const loopState = this.wsWatchLoops.get(subscriptionKey);
      if (loopState) {
        loopState.running = false;
        loopState.abortController.abort();
        this.wsWatchLoops.delete(subscriptionKey);
      }
      this.wsCallbacks.delete(subscriptionKey);
      logger.info({ symbol }, 'Unsubscribed from BingX funding rate');
    } else {
      // 取消所有 fundingRate 訂閱
      for (const [key, loopState] of this.wsWatchLoops) {
        if (key.startsWith('fundingRate:')) {
          loopState.running = false;
          loopState.abortController.abort();
          this.wsWatchLoops.delete(key);
          this.wsCallbacks.delete(key);
        }
      }
      logger.info('Unsubscribed from all BingX funding rates');
    }

    // 檢查是否還有活躍的 WebSocket 連線
    if (this.wsWatchLoops.size === 0) {
      this.wsConnected = false;
      this.emit('wsDisconnected');
    }
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
