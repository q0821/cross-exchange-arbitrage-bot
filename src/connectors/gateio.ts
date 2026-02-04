import ccxt from 'ccxt';
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
import { createCcxtExchange } from '../lib/ccxt-factory.js';
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
import type { PositionChanged, BalanceChanged } from '../types/internal-events.js';

export class GateioConnector extends BaseExchangeConnector {
  private client: ccxt.Exchange | null = null;
  private intervalCache: FundingIntervalCache;

  // WebSocket 相關屬性
  private wsCallbacks: Map<string, (data: FundingRateReceived) => void> = new Map();
  private wsPositionCallbacks: Map<string, (data: PositionChanged) => void> = new Map();
  private wsBalanceCallbacks: Map<string, (data: BalanceChanged) => void> = new Map();
  private wsWatchLoops: Map<string, { running: boolean; abortController: AbortController }> = new Map();
  private isWsDestroyed = false;

  constructor(isTestnet: boolean = false) {
    super('gateio', isTestnet);
    // 使用全域單例，讓 WebSocket 客戶端也能存取快取中的 fundingInterval
    this.intervalCache = FundingIntervalCache.getInstance();
  }

  async connect(): Promise<void> {
    try {
      const { apiKey, apiSecret, testnet } = apiKeys.gateio;

      if (!apiKey || !apiSecret) {
        throw new ExchangeConnectionError('gateio', {
          message: 'Missing Gate.io API credentials',
        });
      }


      this.client = createCcxtExchange('gateio', {
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          ...(testnet && { sandboxMode: true }),
        },
      });

      // 測試連線
      await this.testConnection();

      this.connected = true;
      logger.info({ testnet }, 'Gate.io connector connected');
      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to connect to Gate.io');
      throw new ExchangeConnectionError('gateio', { originalError: err.message });
    }
  }

  async disconnect(): Promise<void> {
    // 清理 WebSocket 資源
    this.isWsDestroyed = true;
    for (const loop of this.wsWatchLoops.values()) {
      loop.running = false;
      loop.abortController.abort();
    }
    this.wsWatchLoops.clear();
    this.wsCallbacks.clear();
    this.wsPositionCallbacks.clear();
    this.wsBalanceCallbacks.clear();

    // 關閉 CCXT WebSocket
    if (this.client && 'close' in this.client) {
      try {
        await (this.client as unknown as { close: () => Promise<void> }).close();
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Error closing CCXT WebSocket');
      }
    }

    this.client = null;
    this.connected = false;
    this.wsConnected = false;

    logger.info('Gate.io connector disconnected');
    this.emit('disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new ExchangeConnectionError('gateio');
    }

    try {
      await this.client.fetchTime();
    } catch (error) {
      throw new ExchangeConnectionError('gateio', {
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
        const interval = await this.getFundingInterval(symbol);

        // 重新計算 nextFundingTime（CCXT 對 4h/1h 週期返回錯誤的結算時間）
        const nextFundingTime = this.calculateNextFundingTime(interval);

        return {
          exchange: 'gateio',
          symbol: this.fromCcxtSymbol(fundingRate.symbol),
          fundingRate: fundingRate.fundingRate || 0,
          nextFundingTime,
          markPrice: fundingRate.markPrice,
          indexPrice: fundingRate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: interval,
        } as FundingRateData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getFundingRate');
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
          this.getFundingInterval(this.fromCcxtSymbol(rate.symbol))
        );
        const intervals = await Promise.all(intervalPromises);

        return ratesArray.map((rate, index) => {
          const interval = intervals[index] ?? 8;
          // 重新計算 nextFundingTime（CCXT 對 4h/1h 週期返回錯誤的結算時間）
          const nextFundingTime = this.calculateNextFundingTime(interval);

          return {
            exchange: 'gateio',
            symbol: this.fromCcxtSymbol(rate.symbol),
            fundingRate: rate.fundingRate || 0,
            nextFundingTime,
            markPrice: rate.markPrice,
            indexPrice: rate.indexPrice,
            recordedAt: new Date(),
            fundingInterval: interval,
          };
        }) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getFundingRates');
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
      const cached = this.intervalCache.get('gateio', symbol);
      if (cached !== null) {
        logger.debug({ symbol, interval: cached, source: 'cache' }, 'Interval retrieved from cache');
        return cached;
      }

      // 2. 測試 CCXT 是否暴露 funding_interval 欄位
      const ccxtSymbol = this.toCcxtSymbol(symbol);
      const fundingRate = await this.client!.fetchFundingRate(ccxtSymbol);

      // 3. 檢查 CCXT info 中是否有 funding_interval 欄位 (秒)
      // 注意：Gate.io API 回傳的 funding_interval 是字串型別
      const fundingIntervalRaw = (fundingRate as any).info?.funding_interval;

      if (fundingIntervalRaw) {
        // 轉換為數字（可能是字串或數字）
        const fundingIntervalSeconds =
          typeof fundingIntervalRaw === 'string'
            ? parseInt(fundingIntervalRaw, 10)
            : fundingIntervalRaw;

        if (!isNaN(fundingIntervalSeconds) && fundingIntervalSeconds > 0) {
          // CCXT 成功暴露 funding_interval 欄位，轉換為小時
          const intervalHours = fundingIntervalSeconds / 3600;
          this.intervalCache.set('gateio', symbol, intervalHours, 'native-api');
          logger.info(
            { symbol, interval: intervalHours, source: 'api' },
            'Funding interval fetched from Gate.io API'
          );
          return intervalHours;
        }
      }

      // 4. CCXT 未暴露欄位，使用預設值
      logger.warn({ symbol }, 'CCXT did not expose funding_interval field, using default 8h');
      this.intervalCache.set('gateio', symbol, 8, 'default');
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
          exchange: 'gateio',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        } as PriceData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getPrice');
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const tickers = await this.client!.fetchTickers(ccxtSymbols);

        return (Object.values(tickers) as ccxt.Ticker[]).map((ticker) => ({
          exchange: 'gateio',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        })) as PriceData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getPrices');
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
          throw new Error(`Symbol ${symbol} not found on Gate.io`);
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
    }, 'gateio', 'getSymbolInfo');
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
        const totalEquityUSD = balance.total['USDT'] as number || 0;
        const availableBalanceUSD = balance.free['USDT'] as number || 0;

        return {
          exchange: 'gateio',
          balances,
          totalEquityUSD,
          availableBalanceUSD,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getBalance');
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
          exchange: 'gateio',
          positions: formattedPositions,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'getPositions');
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
    }, 'gateio', 'getPosition');
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
    }, 'gateio', 'createOrder');
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        await this.client!.cancelOrder(orderId, ccxtSymbol);
        logger.info({ exchange: 'gateio', symbol, orderId }, 'Order cancelled');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'gateio', 'cancelOrder');
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
    }, 'gateio', 'getOrder');
  }

  /**
   * 訂閱 WebSocket 數據
   * Feature: 052-specify-scripts-bash
   * Task: T017 - Gate.io 資金費率訂閱 via CCXT watchFundingRate
   * Task: T042 - Gate.io 持倉監控 via CCXT watchPositions
   */
  async subscribeWS(subscription: WSSubscription): Promise<void> {
    this.ensureConnected();

    const { type, symbol, callback, onError } = subscription;

    // 支援 fundingRate 和 positionUpdate 類型
    if (type === 'positionUpdate') {
      // T042: 持倉更新訂閱
      const subscriptionKey = 'positionUpdate:all';

      // 檢查是否已經訂閱
      if (this.wsWatchLoops.has(subscriptionKey)) {
        logger.warn('Already subscribed to Gate.io position updates');
        return;
      }

      // 保存回調函數
      if (callback) {
        this.wsPositionCallbacks.set(subscriptionKey, callback as (data: PositionChanged) => void);
      }

      logger.info('Subscribing to Gate.io position updates via CCXT watchPositions');

      // 創建 watch loop
      const abortController = new AbortController();
      const loopState = { running: true, abortController };
      this.wsWatchLoops.set(subscriptionKey, loopState);

      // 啟動 watch loop（非阻塞）
      this.startPositionWatchLoop(subscriptionKey, onError).catch((error) => {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Gate.io position watch loop failed');
      });

      this.wsConnected = true;
      this.emit('wsConnected');
      return;
    }

    if (type === 'balanceUpdate') {
      // T071: 餘額更新訂閱
      const subscriptionKey = 'balanceUpdate:all';

      // 檢查是否已經訂閱
      if (this.wsWatchLoops.has(subscriptionKey)) {
        logger.warn('Already subscribed to Gate.io balance updates');
        return;
      }

      // 保存回調函數
      if (callback) {
        this.wsBalanceCallbacks.set(subscriptionKey, callback as (data: BalanceChanged) => void);
      }

      logger.info('Subscribing to Gate.io balance updates via CCXT watchBalance');

      // 創建 watch loop
      const abortController = new AbortController();
      const loopState = { running: true, abortController };
      this.wsWatchLoops.set(subscriptionKey, loopState);

      // 啟動 watch loop（非阻塞）
      this.startBalanceWatchLoop(subscriptionKey, onError).catch((error) => {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Gate.io balance watch loop failed');
      });

      this.wsConnected = true;
      this.emit('wsConnected');
      return;
    }

    if (type !== 'fundingRate') {
      logger.warn({ type }, 'Gate.io WebSocket subscription type not supported yet');
      return;
    }

    if (!symbol) {
      throw new Error('Symbol is required for fundingRate subscription');
    }

    const ccxtSymbol = this.toCcxtSymbol(symbol);
    const subscriptionKey = `fundingRate:${symbol}`;

    // 檢查是否已經訂閱
    if (this.wsWatchLoops.has(subscriptionKey)) {
      logger.warn({ symbol }, 'Already subscribed to Gate.io funding rate');
      return;
    }

    // 保存回調函數
    if (callback) {
      this.wsCallbacks.set(subscriptionKey, callback as (data: FundingRateReceived) => void);
    }

    logger.info({ symbol, ccxtSymbol }, 'Subscribing to Gate.io funding rate via CCXT watchFundingRate');

    // 創建 watch loop
    const abortController = new AbortController();
    const loopState = { running: true, abortController };
    this.wsWatchLoops.set(subscriptionKey, loopState);

    // 啟動 watch loop（非阻塞）
    this.startFundingRateWatchLoop(subscriptionKey, ccxtSymbol, symbol, onError).catch((error) => {
      logger.error({ error: error instanceof Error ? error.message : String(error), symbol }, 'Gate.io funding rate watch loop failed');
    });

    this.wsConnected = true;
    this.emit('wsConnected');
  }

  /**
   * 啟動資金費率 watch loop
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
        // CCXT 4.x 支援 watchFundingRate 方法
        type CcxtProClient = ccxt.Exchange & {
          watchFundingRate: (symbol: string) => Promise<ccxt.FundingRate>;
        };
        const proClient = this.client as CcxtProClient;
        if (!proClient || !('watchFundingRate' in proClient)) {
          throw new Error('CCXT Pro watchFundingRate not available for Gate.io');
        }

        const fundingRate = await proClient.watchFundingRate(ccxtSymbol);

        // 解析 CCXT 格式
        const parseResult = parseCcxtFundingRate(fundingRate);
        if (!parseResult.success) {
          logger.warn({ error: parseResult.error.message, symbol }, 'Failed to parse Gate.io funding rate');
          continue;
        }

        // 獲取資金費率週期（從快取或 API）
        const fundingInterval = await this.getFundingInterval(symbol);

        // 轉換為內部格式
        const data: FundingRateReceived = {
          exchange: 'gateio',
          symbol,
          fundingRate: new Decimal(parseResult.data.fundingRate),
          nextFundingTime: parseResult.data.fundingTimestamp
            ? new Date(parseResult.data.fundingTimestamp)
            : new Date(),
          markPrice: parseResult.data.markPrice ? new Decimal(parseResult.data.markPrice) : undefined,
          indexPrice: parseResult.data.indexPrice ? new Decimal(parseResult.data.indexPrice) : undefined,
          fundingInterval,
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
        if (this.isWsDestroyed || !loopState.running) {
          break;
        }

        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err.message, symbol }, 'Error in Gate.io funding rate watch loop');

        if (onError) {
          onError(err);
        }

        // 錯誤後等待一段時間再重試
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    logger.info({ symbol }, 'Gate.io funding rate watch loop stopped');
  }

  /**
   * 啟動持倉 watch loop
   * Feature: 052-specify-scripts-bash
   * Task: T042 - Gate.io 持倉監控 via CCXT watchPositions
   */
  private async startPositionWatchLoop(
    subscriptionKey: string,
    onError?: (error: Error) => void
  ): Promise<void> {
    const loopState = this.wsWatchLoops.get(subscriptionKey);
    if (!loopState) return;

    while (loopState.running && !this.isWsDestroyed) {
      try {
        // 使用 CCXT Pro 的 watchPositions
        type CcxtProClient = ccxt.Exchange & {
          watchPositions: (symbols?: string[]) => Promise<ccxt.Position[]>;
        };
        const proClient = this.client as CcxtProClient;
        if (!proClient || !('watchPositions' in proClient)) {
          throw new Error('CCXT Pro watchPositions not available for Gate.io');
        }

        // 監聽所有持倉變更
        const positions = await proClient.watchPositions();

        // 處理每個持倉
        for (const pos of positions) {
          const contracts = parseFloat(pos.contracts?.toString() || '0');
          if (contracts === 0 && !pos.entryPrice) {
            // 跳過空持倉（除非是剛關閉的持倉）
            continue;
          }

          // 轉換為內部格式
          const data: PositionChanged = {
            exchange: 'gateio',
            symbol: this.fromCcxtSymbol(pos.symbol),
            side: pos.side === 'long' ? 'LONG' : 'SHORT',
            size: new Decimal(contracts),
            entryPrice: new Decimal(pos.entryPrice || 0),
            markPrice: new Decimal(pos.markPrice || 0),
            unrealizedPnl: new Decimal(pos.unrealizedPnl || 0),
            leverage: pos.leverage,
            liquidationPrice: pos.liquidationPrice ? new Decimal(pos.liquidationPrice) : undefined,
            margin: pos.initialMargin ? new Decimal(pos.initialMargin) : undefined,
            source: 'websocket',
            receivedAt: new Date(),
          };

          // 調用回調
          const callback = this.wsPositionCallbacks.get(subscriptionKey);
          if (callback) {
            callback(data);
          }

          // 發送事件
          this.emit('positionUpdate', data);
        }

      } catch (error) {
        if (this.isWsDestroyed || !loopState.running) {
          break;
        }

        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err.message }, 'Error in Gate.io position watch loop');

        if (onError) {
          onError(err);
        }

        // 錯誤後等待一段時間再重試
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    logger.info('Gate.io position watch loop stopped');
  }

  /**
   * 啟動餘額 watch loop
   * Feature: 052-specify-scripts-bash
   * Task: T071 - Gate.io 餘額監控 via CCXT watchBalance
   */
  private async startBalanceWatchLoop(
    subscriptionKey: string,
    onError?: (error: Error) => void
  ): Promise<void> {
    const loopState = this.wsWatchLoops.get(subscriptionKey);
    if (!loopState) return;

    while (loopState.running && !this.isWsDestroyed) {
      try {
        // 使用 CCXT Pro 的 watchBalance
        type CcxtProClient = ccxt.Exchange & {
          watchBalance: (params?: object) => Promise<ccxt.Balances>;
        };
        const proClient = this.client as CcxtProClient;
        if (!proClient || !('watchBalance' in proClient)) {
          throw new Error('CCXT Pro watchBalance not available for Gate.io');
        }

        // 監聽餘額變更
        const balances = await proClient.watchBalance();
        const balancesAny = balances as unknown as Record<string, unknown>;

        // 處理每個資產的餘額
        for (const [asset, balance] of Object.entries(balancesAny)) {
          if (asset === 'info' || asset === 'timestamp' || asset === 'datetime' || asset === 'free' || asset === 'used' || asset === 'total') continue;

          const balanceData = balance as { free?: number; used?: number; total?: number };
          if (typeof balanceData !== 'object' || balanceData === null) continue;

          const walletBalance = balanceData.total || 0;
          const availableBalance = balanceData.free || 0;

          const data: BalanceChanged = {
            exchange: 'gateio',
            asset,
            walletBalance: new Decimal(walletBalance),
            availableBalance: new Decimal(availableBalance),
            balanceChange: new Decimal(0), // Gate.io 不直接提供變更量
            changeReason: 'UNKNOWN',
            source: 'websocket',
            receivedAt: new Date(),
          };

          // 調用回調
          const callback = this.wsBalanceCallbacks.get(subscriptionKey);
          if (callback) {
            callback(data);
          }

          // 發送事件
          this.emit('balanceUpdate', data);
        }

      } catch (error) {
        if (this.isWsDestroyed || !loopState.running) {
          break;
        }

        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err.message }, 'Error in Gate.io balance watch loop');

        if (onError) {
          onError(err);
        }

        // 錯誤後等待一段時間再重試
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    logger.info('Gate.io balance watch loop stopped');
  }

  /**
   * 取消訂閱 WebSocket 數據
   * Feature: 052-specify-scripts-bash
   * Task: T017 - Gate.io 資金費率取消訂閱
   * Task: T042 - Gate.io 持倉監控取消訂閱
   * Task: T071 - Gate.io 餘額監控取消訂閱
   */
  async unsubscribeWS(type: WSSubscriptionType, symbol?: string): Promise<void> {
    // T042: 支援 positionUpdate 取消訂閱
    if (type === 'positionUpdate') {
      const subscriptionKey = 'positionUpdate:all';
      const loopState = this.wsWatchLoops.get(subscriptionKey);
      if (loopState) {
        loopState.running = false;
        loopState.abortController.abort();
        this.wsWatchLoops.delete(subscriptionKey);
      }
      this.wsPositionCallbacks.delete(subscriptionKey);
      logger.info('Unsubscribed from Gate.io position updates');

      // 檢查是否還有活躍的 WebSocket 連線
      if (this.wsWatchLoops.size === 0) {
        this.wsConnected = false;
        this.emit('wsDisconnected');
      }
      return;
    }

    // T071: 支援 balanceUpdate 取消訂閱
    if (type === 'balanceUpdate') {
      const subscriptionKey = 'balanceUpdate:all';
      const loopState = this.wsWatchLoops.get(subscriptionKey);
      if (loopState) {
        loopState.running = false;
        loopState.abortController.abort();
        this.wsWatchLoops.delete(subscriptionKey);
      }
      this.wsBalanceCallbacks.delete(subscriptionKey);
      logger.info('Unsubscribed from Gate.io balance updates');

      // 檢查是否還有活躍的 WebSocket 連線
      if (this.wsWatchLoops.size === 0) {
        this.wsConnected = false;
        this.emit('wsDisconnected');
      }
      return;
    }

    if (type !== 'fundingRate') {
      logger.warn({ type }, 'Gate.io WebSocket unsubscription type not supported yet');
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
      logger.info({ symbol }, 'Unsubscribed from Gate.io funding rate');
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
      logger.info('Unsubscribed from all Gate.io funding rates');
    }

    // 檢查是否還有活躍的 WebSocket 連線
    if (this.wsWatchLoops.size === 0) {
      this.wsConnected = false;
      this.emit('wsDisconnected');
    }
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

  /**
   * 計算下次結算時間
   *
   * 根據不同的 fundingInterval 計算結算時間點：
   * - 1h: 每小時整點（00:00, 01:00, 02:00, ...）
   * - 4h: UTC 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
   * - 8h: UTC 00:00, 08:00, 16:00
   *
   * 注意：CCXT 的 fundingTimestamp 對 4h/1h 週期返回錯誤的值，
   * 因此需要自行計算正確的下次結算時間。
   *
   * @param fundingIntervalHours 結算週期（小時），預設 8
   */
  private calculateNextFundingTime(fundingIntervalHours: number = 8): Date {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    // 計算當前時間在週期內的位置
    const currentTimeInHours = utcHours + utcMinutes / 60;
    const nextSettlementMultiple = Math.ceil(currentTimeInHours / fundingIntervalHours);
    let nextSettlementHour = nextSettlementMultiple * fundingIntervalHours;

    // 如果剛好在結算時間點上，跳到下一個週期
    if (currentTimeInHours === nextSettlementHour) {
      nextSettlementHour += fundingIntervalHours;
    }

    const nextFunding = new Date(now);
    nextFunding.setUTCMinutes(0, 0, 0);

    // 處理跨日情況
    if (nextSettlementHour >= 24) {
      const daysToAdd = Math.floor(nextSettlementHour / 24);
      nextFunding.setUTCDate(nextFunding.getUTCDate() + daysToAdd);
      nextSettlementHour = nextSettlementHour % 24;
    }

    nextFunding.setUTCHours(nextSettlementHour);

    return nextFunding;
  }

  private handleApiError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 速率限制錯誤
      if (message.includes('rate limit') || message.includes('429')) {
        return new ExchangeRateLimitError('gateio', { originalError: error.message });
      }

      // CCXT 錯誤
      if (error instanceof ccxt.NetworkError) {
        return new ExchangeConnectionError('gateio', { originalError: error.message });
      }

      if (error instanceof ccxt.ExchangeError) {
        return new ExchangeApiError('gateio', 'API_ERROR', error.message);
      }

      return error;
    }

    return new ExchangeApiError('gateio', 'UNKNOWN', String(error));
  }
}
