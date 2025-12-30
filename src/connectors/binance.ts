import { Spot } from '@binance/connector';
import axios from 'axios';
import pLimit from 'p-limit';
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
import {
  OpenInterestRecord,
  OpenInterestUSD,
  TradingPairRanking,
  validateOpenInterestRecords,
} from '../types/open-interest.js';
import { apiKeys } from '../lib/config.js';
import { exchangeLogger as logger } from '../lib/logger.js';
import {
  ExchangeApiError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
} from '../lib/errors.js';
import { retryApiCall } from '../lib/retry.js';
import { FundingIntervalCache } from '../lib/FundingIntervalCache.js';

export class BinanceConnector extends BaseExchangeConnector {
  private client: InstanceType<typeof Spot> | null = null;
  private futuresBaseURL: string = '';
  private wsClient: unknown = null;
  private intervalCache: FundingIntervalCache;

  constructor(isTestnet: boolean = false) {
    super('binance', isTestnet);
    this.intervalCache = new FundingIntervalCache();
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

        // 🆕 獲取動態間隔
        const interval = await this.getFundingInterval(symbol);

        return {
          exchange: 'binance',
          symbol: data.symbol,
          fundingRate: parseFloat(data.lastFundingRate),
          nextFundingTime: new Date(data.nextFundingTime),
          markPrice: data.markPrice ? parseFloat(data.markPrice) : undefined,
          indexPrice: data.indexPrice ? parseFloat(data.indexPrice) : undefined,
          recordedAt: new Date(),
          fundingInterval: interval, // 🆕 使用動態間隔
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

        // 🆕 批量獲取間隔值
        const intervalPromises = filtered.map((data: { symbol: string }) =>
          this.getFundingInterval(data.symbol)
        );
        const intervals = await Promise.all(intervalPromises);

        return filtered.map((data: {
          symbol: string;
          lastFundingRate: string;
          nextFundingTime: number;
          markPrice?: string;
          indexPrice?: string;
        }, index: number) => ({
          exchange: 'binance',
          symbol: data.symbol,
          fundingRate: parseFloat(data.lastFundingRate),
          nextFundingTime: new Date(data.nextFundingTime),
          markPrice: data.markPrice ? parseFloat(data.markPrice) : undefined,
          indexPrice: data.indexPrice ? parseFloat(data.indexPrice) : undefined,
          recordedAt: new Date(),
          fundingInterval: intervals[index], // 🆕 使用動態間隔
        })) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getFundingRates');
  }

  /**
   * 獲取單一交易對的資金費率間隔(小時)
   * @param symbol 交易對符號 (如 'BTCUSDT')
   * @returns 間隔值(小時: 4 或 8)
   */
  async getFundingInterval(symbol: string): Promise<number> {
    this.ensureConnected();

    try {
      // 1. 檢查快取
      const cached = this.intervalCache.get('binance', symbol);
      if (cached !== null) {
        logger.debug({ symbol, interval: cached, source: 'cache' }, 'Interval retrieved from cache');
        return cached;
      }

      // 2. 呼叫 Binance API /fapi/v1/fundingInfo
      const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/fundingInfo`, {
        params: { symbol },
      });

      // 3. 處理 API 回傳（可能是陣列或單一物件）
      const dataArray = Array.isArray(response.data) ? response.data : [response.data];

      // 4. 尋找對應的 symbol
      const symbolData = dataArray.find((item: { symbol?: string }) => item.symbol === symbol);

      if (!symbolData) {
        logger.warn({ symbol, arrayLength: dataArray.length }, 'Symbol not found in fundingInfo response, using default 8h');
        return 8;
      }

      // 5. 解析 fundingIntervalHours 欄位
      const interval = symbolData.fundingIntervalHours || 8; // 預設 8h

      // 6. 驗證間隔值（支援 1/4/8 小時）
      if (interval !== 1 && interval !== 4 && interval !== 8) {
        logger.warn({ symbol, interval }, 'Non-standard funding interval detected');
      }

      // 7. 快取並返回
      this.intervalCache.set('binance', symbol, interval, 'native-api');
      logger.info({ symbol, interval, source: 'native-api' }, 'Funding interval fetched from Binance API');

      return interval;
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

        // CLI 監控用簡化實作，完整 USD 計算見 UserConnectorFactory.BinanceUserConnector
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

    // CLI 監控用簡化實作，完整持倉查詢見 UserConnectorFactory.BinanceUserConnector
    return {
      exchange: 'binance',
      positions: [],
      timestamp: new Date(),
    };
  }

  async getPosition(_symbol: string): Promise<Position | null> {
    this.ensureConnected();

    // CLI 監控用簡化實作，此方法目前未被使用
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
          fee: 0, // 下單回應不含手續費，實際費用由 Trade 模型記錄
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

  // ============================================================================
  // Open Interest Methods (Feature 010)
  // ============================================================================

  /**
   * 獲取所有 USDT 永續合約交易對
   * @returns Array of USDT perpetual symbols
   */
  async getUSDTPerpetualSymbols(): Promise<string[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/exchangeInfo`);
        const symbols = response.data.symbols
          .filter((s: { symbol: string; quoteAsset: string; contractType: string; status: string }) =>
            s.quoteAsset === 'USDT' &&
            s.contractType === 'PERPETUAL' &&
            s.status === 'TRADING'
          )
          .map((s: { symbol: string }) => s.symbol);

        logger.debug({ count: symbols.length }, 'Fetched USDT perpetual symbols from Binance');
        return symbols;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getUSDTPerpetualSymbols');
  }

  /**
   * 獲取單一交易對的 Open Interest
   * @param symbol Trading pair symbol (e.g., "BTCUSDT")
   * @returns Open Interest data
   */
  async getOpenInterestForSymbol(symbol: string): Promise<OpenInterestRecord> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/openInterest`, {
          params: { symbol },
        });

        const data = response.data;
        const record: OpenInterestRecord = {
          symbol: data.symbol,
          openInterest: data.openInterest,
          time: data.time,
        };

        // Validate using Zod schema
        validateOpenInterestRecords([record]);

        return record;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getOpenInterestForSymbol');
  }

  /**
   * 獲取多個交易對的標記價格（批量）
   * @param symbols Array of symbols (empty array = all symbols)
   * @returns Map of symbol to mark price
   */
  async getMarkPrices(symbols?: string[]): Promise<Map<string, number>> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const response = await axios.get(`${this.futuresBaseURL}/fapi/v1/premiumIndex`);
        const allData = Array.isArray(response.data) ? response.data : [response.data];

        const filtered = symbols && symbols.length > 0
          ? allData.filter((item: { symbol: string }) => symbols.includes(item.symbol))
          : allData;

        const priceMap = new Map<string, number>();
        filtered.forEach((item: { symbol: string; markPrice: string }) => {
          priceMap.set(item.symbol, parseFloat(item.markPrice));
        });

        logger.debug({ count: priceMap.size }, 'Fetched mark prices from Binance');
        return priceMap;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'binance', 'getMarkPrices');
  }

  /**
   * 獲取所有 USDT 永續合約的 Open Interest（轉換為 USD 價值）
   * 使用 p-limit 控制並發請求數量，避免觸發速率限制
   * @returns Array of Open Interest data in USD
   */
  async getAllOpenInterest(): Promise<OpenInterestUSD[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        // 1. 獲取所有 USDT 永續合約交易對
        const symbols = await this.getUSDTPerpetualSymbols();
        logger.info({ totalSymbols: symbols.length }, 'Fetching Open Interest for all USDT perpetuals');

        // 2. 並發獲取所有交易對的 OI 資料和標記價格
        // Note: Binance 沒有批量 OI 端點，需要逐個獲取
        const [oiDataMap, markPrices] = await Promise.all([
          this.getBatchOpenInterest(symbols),
          this.getMarkPrices(symbols),
        ]);

        // 3. 計算 OI USD 價值
        const results: OpenInterestUSD[] = [];
        for (const [symbol, oiContracts] of oiDataMap.entries()) {
          const markPrice = markPrices.get(symbol);
          if (!markPrice) {
            logger.warn({ symbol }, 'Mark price not found, skipping symbol');
            continue;
          }

          results.push({
            symbol,
            openInterestUSD: oiContracts * markPrice,
            openInterestContracts: oiContracts,
            markPrice,
            timestamp: Date.now(),
          });
        }

        logger.info({
          totalSymbols: results.length,
          topSymbol: results[0]?.symbol,
          topOI: results[0]?.openInterestUSD,
        }, 'Successfully fetched all Open Interest data');

        return results;
      } catch (error) {
        logger.error({ error }, 'Failed to fetch all Open Interest');
        throw this.handleApiError(error);
      }
    }, 'binance', 'getAllOpenInterest');
  }

  /**
   * 批量獲取 Open Interest（使用並發控制）
   * @param symbols Array of symbols
   * @returns Map of symbol to OI contracts
   */
  private async getBatchOpenInterest(symbols: string[]): Promise<Map<string, number>> {
    const limit = pLimit(10); // 限制並發數為 10
    const oiMap = new Map<string, number>();

    const tasks = symbols.map(symbol =>
      limit(async () => {
        try {
          const record = await this.getOpenInterestForSymbol(symbol);
          oiMap.set(symbol, parseFloat(record.openInterest));
        } catch (error) {
          logger.warn({ symbol, error }, 'Failed to fetch OI for symbol, skipping');
        }
      })
    );

    await Promise.all(tasks);
    return oiMap;
  }

  /**
   * 獲取 Open Interest 排名前 N 的交易對
   * @param topN Number of top symbols to return
   * @param minOI Optional minimum OI threshold in USD
   * @returns Trading pair ranking with top N symbols
   */
  async getTopSymbolsByOI(topN: number = 50, minOI?: number): Promise<TradingPairRanking> {
    this.ensureConnected();

    logger.info({ topN, minOI }, 'Fetching top symbols by Open Interest');

    try {
      // 1. 獲取所有 OI 資料
      const allOI = await this.getAllOpenInterest();

      // 2. 過濾掉低於最小 OI 門檻的交易對
      let filtered = allOI;
      if (minOI !== undefined && minOI > 0) {
        filtered = allOI.filter(oi => oi.openInterestUSD >= minOI);
        logger.debug({
          original: allOI.length,
          filtered: filtered.length,
          minOI,
        }, 'Filtered symbols by minimum OI');
      }

      // 3. 按 OI 降序排序
      const sorted = filtered.sort((a, b) => b.openInterestUSD - a.openInterestUSD);

      // 4. 取前 N 個
      const topSymbols = sorted.slice(0, topN);

      const ranking: TradingPairRanking = {
        rankings: topSymbols,
        totalSymbols: allOI.length,
        topN,
        generatedAt: Date.now(),
      };

      logger.info({
        totalSymbols: ranking.totalSymbols,
        selectedSymbols: topSymbols.length,
        topSymbol: topSymbols[0]?.symbol,
        topOI: topSymbols[0]?.openInterestUSD,
      }, 'Generated trading pair ranking by OI');

      return ranking;
    } catch (error) {
      logger.error({ error, topN, minOI }, 'Failed to get top symbols by OI');
      throw error;
    }
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
