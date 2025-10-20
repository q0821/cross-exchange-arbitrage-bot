import { Spot } from '@binance/connector';
import axios from 'axios';
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

export class BinanceConnector extends BaseExchangeConnector {
  private client: InstanceType<typeof Spot> | null = null;
  private futuresBaseURL: string = '';
  private wsClient: unknown = null;

  constructor(isTestnet: boolean = false) {
    super('binance', isTestnet);
  }

  async connect(): Promise<void> {
    try {
      const { apiKey, apiSecret, testnet } = apiKeys.binance;

      if (!apiKey || !apiSecret) {
        throw new ExchangeConnectionError('binance', {
          message: 'Missing Binance API credentials',
        });
      }

      const spotBaseURL = testnet
        ? 'https://testnet.binance.vision'
        : 'https://api.binance.com';

      this.futuresBaseURL = testnet
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com';

      // 初始化現貨客戶端 (用於價格查詢)
      this.client = new Spot(apiKey, apiSecret, { baseURL: spotBaseURL });

      // 測試連線
      await this.testConnection();

      this.connected = true;
      logger.info({ testnet }, 'Binance connector connected');
      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to connect to Binance');
      throw new ExchangeConnectionError('binance', { originalError: err.message });
    }
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      // TODO: 實作 WebSocket 斷線邏輯
    }

    this.client = null;
    this.connected = false;
    this.wsConnected = false;

    logger.info('Binance connector disconnected');
    this.emit('disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new ExchangeConnectionError('binance');
    }

    try {
      await this.client.time();
    } catch (error) {
      throw new ExchangeConnectionError('binance', {
        message: 'Connection test failed',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRateData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        // 使用 Binance Futures API 的 premiumIndex endpoint
        const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/premiumIndex`, {
          params: { symbol },
        });

        const data = response.data;

        return {
          exchange: 'binance',
          symbol: data.symbol,
          fundingRate: parseFloat(data.lastFundingRate),
          nextFundingTime: new Date(data.nextFundingTime),
          markPrice: data.markPrice ? parseFloat(data.markPrice) : undefined,
          indexPrice: data.indexPrice ? parseFloat(data.indexPrice) : undefined,
          recordedAt: new Date(),
        } as FundingRateData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getFundingRate');
  }

  async getFundingRates(symbols: string[]): Promise<FundingRateData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        // 不帶 symbol 參數會返回所有交易對
        const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/premiumIndex`);
        const allData = Array.isArray(response.data) ? response.data : [response.data];

        // 過濾指定的交易對
        const filtered = symbols.length > 0
          ? allData.filter((item: { symbol: string }) => symbols.includes(item.symbol))
          : allData;

        return filtered.map((data: {
          symbol: string;
          lastFundingRate: string;
          nextFundingTime: number;
          markPrice?: string;
          indexPrice?: string;
        }) => ({
          exchange: 'binance',
          symbol: data.symbol,
          fundingRate: parseFloat(data.lastFundingRate),
          nextFundingTime: new Date(data.nextFundingTime),
          markPrice: data.markPrice ? parseFloat(data.markPrice) : undefined,
          indexPrice: data.indexPrice ? parseFloat(data.indexPrice) : undefined,
          recordedAt: new Date(),
        })) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getFundingRates');
  }

  async getPrice(symbol: string): Promise<PriceData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await this.client!.tickerPrice(symbol);
        const data = response.data;

        return {
          exchange: 'binance',
          symbol: data.symbol,
          price: parseFloat(data.price),
          timestamp: new Date(),
        } as PriceData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getPrice');
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await this.client!.tickerPrice();
        const allData = Array.isArray(response.data) ? response.data : [response.data];

        const filtered = symbols.length > 0
          ? allData.filter((item: { symbol: string }) => symbols.includes(item.symbol))
          : allData;

        return filtered.map((data: { symbol: string; price: string }) => ({
          exchange: 'binance',
          symbol: data.symbol,
          price: parseFloat(data.price),
          timestamp: new Date(),
        })) as PriceData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getPrices');
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
        const response = await this.client!.exchangeInfo();
        const symbolData = response.data.symbols.find((s: unknown) => (s as { symbol: string }).symbol === symbol);

        if (!symbolData) {
          throw new Error(`Symbol ${symbol} not found on Binance`);
        }

        const info: SymbolInfo = {
          symbol: symbolData.symbol,
          baseAsset: symbolData.baseAsset,
          quoteAsset: symbolData.quoteAsset,
          minQuantity: parseFloat(symbolData.filters.find((f: { filterType: string }) => f.filterType === 'LOT_SIZE')?.minQty || '0'),
          maxQuantity: parseFloat(symbolData.filters.find((f: { filterType: string }) => f.filterType === 'LOT_SIZE')?.maxQty || '0'),
          minNotional: parseFloat(symbolData.filters.find((f: { filterType: string }) => f.filterType === 'MIN_NOTIONAL')?.notional || '0'),
          pricePrecision: symbolData.pricePrecision || 8,
          quantityPrecision: symbolData.quantityPrecision || 8,
          tickSize: parseFloat(symbolData.filters.find((f: { filterType: string }) => f.filterType === 'PRICE_FILTER')?.tickSize || '0'),
          stepSize: parseFloat(symbolData.filters.find((f: { filterType: string }) => f.filterType === 'LOT_SIZE')?.stepSize || '0'),
          isActive: symbolData.status === 'TRADING',
        };

        this.cacheSymbolInfo(symbol, info);
        return info;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getSymbolInfo');
  }

  async getBalance(): Promise<AccountBalance> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await this.client!.account();
        const balances = response.data.balances.map((b: unknown) => ({
          asset: (b as { asset: string }).asset,
          free: parseFloat((b as { free: string }).free),
          locked: parseFloat((b as { locked: string }).locked),
          total: parseFloat((b as { free: string }).free) + parseFloat((b as { locked: string }).locked),
        }));

        // TODO: 計算總權益 (需要根據價格轉換為 USD)
        const totalEquityUSD = 0;

        return {
          exchange: 'binance',
          balances,
          totalEquityUSD,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getBalance');
  }

  async getPositions(): Promise<PositionInfo> {
    this.ensureConnected();

    // TODO: 實作期貨持倉查詢
    return {
      exchange: 'binance',
      positions: [],
      timestamp: new Date(),
    };
  }

  async getPosition(_symbol: string): Promise<Position | null> {
    this.ensureConnected();

    // TODO: 實作單一持倉查詢
    return null;
  }

  async createOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        // 格式化訂單參數
        const side = order.side === 'LONG' ? 'BUY' : 'SELL';
        const type = order.type;

        const params: Record<string, unknown> = {
          symbol: order.symbol,
          side,
          type,
          quantity: order.quantity,
        };

        if (order.price && type === 'LIMIT') {
          params.price = order.price;
          params.timeInForce = 'GTC';
        }

        if (order.clientOrderId) {
          params.newClientOrderId = order.clientOrderId;
        }

        const response = await this.client!.newOrder(
          order.symbol,
          side,
          type,
          params
        );

        const data = response.data;

        return {
          orderId: data.orderId.toString(),
          clientOrderId: data.clientOrderId,
          symbol: data.symbol,
          side: order.side,
          type: order.type,
          status: this.mapOrderStatus(data.status),
          quantity: parseFloat(data.origQty),
          filledQuantity: parseFloat(data.executedQty),
          price: data.price ? parseFloat(data.price) : undefined,
          averagePrice: parseFloat(data.cummulativeQuoteQty) / parseFloat(data.executedQty) || 0,
          fee: 0, // TODO: 從交易記錄中取得手續費
          feeCurrency: 'USDT',
          timestamp: new Date(data.transactTime),
        } as OrderResponse;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'createOrder');
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        await this.client!.cancelOrder(symbol, { orderId: parseInt(orderId) });
        logger.info({ exchange: 'binance', symbol, orderId }, 'Order cancelled');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'cancelOrder');
  }

  async getOrder(symbol: string, orderId: string): Promise<OrderResponse> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await this.client!.getOrder(symbol, { orderId: parseInt(orderId) });
        const data = response.data;

        const side: OrderSide = data.side === 'BUY' ? 'LONG' : 'SHORT';

        return {
          orderId: data.orderId.toString(),
          clientOrderId: data.clientOrderId,
          symbol: data.symbol,
          side,
          type: data.type as 'MARKET' | 'LIMIT',
          status: this.mapOrderStatus(data.status),
          quantity: parseFloat(data.origQty),
          filledQuantity: parseFloat(data.executedQty),
          price: data.price ? parseFloat(data.price) : undefined,
          averagePrice: parseFloat(data.cummulativeQuoteQty) / parseFloat(data.executedQty) || 0,
          fee: 0,
          feeCurrency: 'USDT',
          timestamp: new Date(data.time),
        } as OrderResponse;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getOrder');
  }

  async subscribeWS(_subscription: WSSubscription): Promise<void> {
    // TODO: 實作 WebSocket 訂閱
    logger.warn('WebSocket subscription not yet implemented for Binance');
  }

  async unsubscribeWS(_type: WSSubscriptionType, _symbol?: string): Promise<void> {
    // TODO: 實作 WebSocket 取消訂閱
    logger.warn('WebSocket unsubscription not yet implemented for Binance');
  }

  // 輔助方法
  private mapOrderStatus(status: string): 'FILLED' | 'PARTIAL' | 'CANCELED' | 'FAILED' | 'PENDING' {
    switch (status) {
      case 'FILLED':
        return 'FILLED';
      case 'PARTIALLY_FILLED':
        return 'PARTIAL';
      case 'CANCELED':
      case 'EXPIRED':
      case 'REJECTED':
        return 'CANCELED';
      case 'NEW':
      case 'PENDING_CANCEL':
        return 'PENDING';
      default:
        return 'FAILED';
    }
  }

  private handleApiError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 速率限制錯誤
      if (message.includes('rate limit') || message.includes('429')) {
        return new ExchangeRateLimitError('binance', { originalError: error.message });
      }

      // API 錯誤
      if (message.includes('api')) {
        return new ExchangeApiError('binance', 'UNKNOWN', error.message);
      }

      return error;
    }

    return new ExchangeApiError('binance', 'UNKNOWN', String(error));
  }
}
