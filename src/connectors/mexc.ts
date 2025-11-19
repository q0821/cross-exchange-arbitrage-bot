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

export class MexcConnector extends BaseExchangeConnector {
  private client: ccxt.Exchange | null = null;
  private intervalCache: FundingIntervalCache;

  constructor(isTestnet: boolean = false) {
    super('mexc', isTestnet);
    this.intervalCache = new FundingIntervalCache();
  }

  async connect(): Promise<void> {
    try {
      const { apiKey, apiSecret, testnet } = apiKeys.mexc;

      if (!apiKey || !apiSecret) {
        throw new ExchangeConnectionError('mexc', {
          message: 'Missing MEXC API credentials',
        });
      }

      this.client = new (ccxt as any).mexc({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          defaultType: 'swap', // 使用永續合約
          ...(testnet && { sandboxMode: true }),
        },
      }) as ccxt.Exchange;

      // 測試連線
      await this.testConnection();

      this.connected = true;
      logger.info({ testnet }, 'MEXC connector connected');
      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to connect to MEXC');
      throw new ExchangeConnectionError('mexc', { originalError: err.message });
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
    this.wsConnected = false;

    logger.info('MEXC connector disconnected');
    this.emit('disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new ExchangeConnectionError('mexc');
    }

    try {
      await this.client.fetchTime();
    } catch (error) {
      throw new ExchangeConnectionError('mexc', {
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

        // 🆕 獲取動態間隔
        const interval = await this.getFundingInterval(symbol);

        return {
          exchange: 'mexc',
          symbol: this.fromCcxtSymbol(fundingRate.symbol),
          fundingRate: fundingRate.fundingRate || 0,
          nextFundingTime: new Date(fundingRate.fundingTimestamp || Date.now()),
          markPrice: fundingRate.markPrice,
          indexPrice: fundingRate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: interval, // 🆕 使用動態間隔
        } as FundingRateData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getFundingRate');
  }

  async getFundingRates(symbols: string[]): Promise<FundingRateData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const fundingRates = await this.client!.fetchFundingRates(ccxtSymbols);

        const ratesArray = Object.values(fundingRates) as ccxt.FundingRate[];

        // 🆕 批量獲取間隔值
        const intervalPromises = ratesArray.map((rate) =>
          this.getFundingInterval(this.fromCcxtSymbol(rate.symbol))
        );
        const intervals = await Promise.all(intervalPromises);

        return ratesArray.map((rate, index) => ({
          exchange: 'mexc',
          symbol: this.fromCcxtSymbol(rate.symbol),
          fundingRate: rate.fundingRate || 0,
          nextFundingTime: new Date(rate.fundingTimestamp || Date.now()),
          markPrice: rate.markPrice,
          indexPrice: rate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: intervals[index], // 🆕 使用動態間隔
        })) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getFundingRates');
  }

  /**
   * 獲取單一交易對的資金費率間隔(小時)
   * @param symbol 交易對符號 (如 'BTCUSDT')
   * @returns 間隔值(小時)
   */
  async getFundingInterval(symbol: string): Promise<number> {
    this.ensureConnected();

    try {
      // 1. 檢查快取
      const cached = this.intervalCache.get('mexc', symbol);
      if (cached !== null) {
        logger.debug({ symbol, interval: cached, source: 'cache' }, 'Interval retrieved from cache');
        return cached;
      }

      // 2. 測試 CCXT 是否暴露 collectCycle 欄位
      const ccxtSymbol = this.toCcxtSymbol(symbol);
      const fundingRate = await this.client!.fetchFundingRate(ccxtSymbol);

      // 3. 檢查 CCXT info 中是否有 collectCycle 欄位
      const collectCycle = (fundingRate as any).info?.collectCycle;

      if (collectCycle && typeof collectCycle === 'number' && collectCycle > 0) {
        // CCXT 成功暴露 collectCycle 欄位
        this.intervalCache.set('mexc', symbol, collectCycle, 'api');
        logger.info({ symbol, interval: collectCycle, source: 'ccxt' }, 'Funding interval fetched from CCXT');
        return collectCycle;
      }

      // 4. CCXT 未暴露欄位，使用預設值
      logger.warn({ symbol }, 'CCXT did not expose collectCycle field, using default 8h');
      this.intervalCache.set('mexc', symbol, 8, 'default');
      return 8;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn({ symbol, error: err.message }, 'Failed to fetch funding interval, using default 8h');
      return 8; // 降級至預設值
    }
  }

  async getPrice(symbol: string): Promise<PriceData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const ticker = await this.client!.fetchTicker(ccxtSymbol);

        return {
          exchange: 'mexc',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        } as PriceData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getPrice');
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const tickers = await this.client!.fetchTickers(ccxtSymbols);

        return (Object.values(tickers) as ccxt.Ticker[]).map((ticker) => ({
          exchange: 'mexc',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        })) as PriceData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getPrices');
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
          throw new Error(`Symbol ${symbol} not found on MEXC`);
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
    }, 'mexc', 'getSymbolInfo');
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
        const totalEquityUSD = balance.total['USDT'] as number || 0;

        return {
          exchange: 'mexc',
          balances,
          totalEquityUSD,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getBalance');
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
          exchange: 'mexc',
          positions: formattedPositions,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'getPositions');
  }

  async getPosition(symbol: string): Promise<Position | null> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const positions = await this.client!.fetchPositions([ccxtSymbol]);

        const position = positions.find(
          (pos: ccxt.Position) => pos.symbol === ccxtSymbol && parseFloat(pos.contracts?.toString() || '0') > 0
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
    }, 'mexc', 'getPosition');
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
    }, 'mexc', 'createOrder');
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        await this.client!.cancelOrder(orderId, ccxtSymbol);
        logger.info({ exchange: 'mexc', symbol, orderId }, 'Order cancelled');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'mexc', 'cancelOrder');
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
    }, 'mexc', 'getOrder');
  }

  async subscribeWS(_subscription: WSSubscription): Promise<void> {
    // TODO: 實作 WebSocket 訂閱
    logger.warn('WebSocket subscription not yet implemented for MEXC');
  }

  async unsubscribeWS(_type: WSSubscriptionType, _symbol?: string): Promise<void> {
    // TODO: 實作 WebSocket 取消訂閱
    logger.warn('WebSocket unsubscription not yet implemented for MEXC');
  }

  // 輔助方法
  private toCcxtSymbol(symbol: string): string {
    // 轉換 BTCUSDT -> BTC/USDT:USDT (永續合約格式)
    const base = symbol.replace('USDT', '');
    return `${base}/USDT:USDT`;
  }

  private fromCcxtSymbol(ccxtSymbol: string): string {
    // 轉換 BTC/USDT:USDT -> BTCUSDT
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
        return new ExchangeRateLimitError('mexc', { originalError: error.message });
      }

      // CCXT 錯誤
      if (error instanceof ccxt.NetworkError) {
        return new ExchangeConnectionError('mexc', { originalError: error.message });
      }

      if (error instanceof ccxt.ExchangeError) {
        return new ExchangeApiError('mexc', 'API_ERROR', error.message);
      }

      return error;
    }

    return new ExchangeApiError('mexc', 'UNKNOWN', String(error));
  }
}
