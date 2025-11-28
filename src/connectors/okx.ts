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

export class OKXConnector extends BaseExchangeConnector {
  private client: ccxt.Exchange | null = null;
  private intervalCache: FundingIntervalCache;

  // T068-T069: Define validation constants
  private static readonly VALID_INTERVALS = [1, 4, 8];
  private static readonly TOLERANCE = 0.5; // hours

  constructor(isTestnet: boolean = false) {
    super('okx', isTestnet);
    this.intervalCache = new FundingIntervalCache();
  }

  async connect(): Promise<void> {
    try {
      const { apiKey, apiSecret, passphrase, testnet } = apiKeys.okx;

      if (!apiKey || !apiSecret || !passphrase) {
        throw new ExchangeConnectionError('okx', {
          message: 'Missing OKX API credentials',
        });
      }

      this.client = new ccxt.okx({
        apiKey,
        secret: apiSecret,
        password: passphrase,
        enableRateLimit: true,
        options: {
          defaultType: 'swap', // 使用永續合約
          ...(testnet && { sandboxMode: true }),
        },
      });

      // 測試連線
      await this.testConnection();

      this.connected = true;
      logger.info({ testnet }, 'OKX connector connected');
      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, 'Failed to connect to OKX');
      throw new ExchangeConnectionError('okx', { originalError: err.message });
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
    this.wsConnected = false;

    logger.info('OKX connector disconnected');
    this.emit('disconnected');
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new ExchangeConnectionError('okx');
    }

    try {
      await this.client.fetchTime();
    } catch (error) {
      throw new ExchangeConnectionError('okx', {
        message: 'Connection test failed',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate and round interval to nearest standard value
   * Feature: 024-fix-okx-funding-normalization (User Story 4)
   * Returns validated interval or null if invalid
   */
  private validateAndRoundInterval(
    symbol: string,
    rawInterval: number
  ): { interval: number; rounded: boolean; deviation: number } | null {
    // T070: Validate positive number
    if (rawInterval <= 0 || !isFinite(rawInterval)) {
      logger.warn(
        { symbol, rawInterval },
        'Invalid interval: must be positive and finite'
      );
      return null;
    }

    // T071: Find closest standard interval
    let closestInterval: number = OKXConnector.VALID_INTERVALS[0]!;
    let minDistance = Math.abs(rawInterval - closestInterval);

    for (const validInterval of OKXConnector.VALID_INTERVALS) {
      const distance = Math.abs(rawInterval - validInterval);
      if (distance < minDistance) {
        minDistance = distance;
        closestInterval = validInterval;
      }
    }

    // T072: Calculate deviation
    const deviation = Math.abs(rawInterval - closestInterval);
    const rounded = deviation > 0.01; // Consider rounded if deviation > 0.01h

    // T073: Log warning when deviation > tolerance
    if (deviation > OKXConnector.TOLERANCE) {
      logger.warn(
        {
          symbol,
          originalInterval: rawInterval,
          roundedInterval: closestInterval,
          deviation,
          tolerance: OKXConnector.TOLERANCE,
        },
        'Large deviation detected: interval rounded to nearest standard value'
      );
    } else if (rounded) {
      // Log info for smaller deviations
      logger.info(
        {
          symbol,
          originalInterval: rawInterval,
          roundedInterval: closestInterval,
          deviation,
        },
        'Interval rounded to nearest standard value'
      );
    }

    // T074: Return validation result
    return {
      interval: closestInterval,
      rounded,
      deviation,
    };
  }

  /**
   * Get funding interval from OKX Native API with retry logic
   * Feature: 024-fix-okx-funding-normalization (User Story 3)
   * Implements exponential backoff for rate limit errors
   */
  private async getFundingIntervalFromNativeAPIWithRetry(
    symbol: string,
    maxRetries: number = 2
  ): Promise<number | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.getFundingIntervalFromNativeAPI(symbol);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Only retry on rate limit errors
        if (err.message === 'RATE_LIMIT' && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delayMs = Math.pow(2, attempt) * 1000;
          logger.warn(
            { symbol, attempt: attempt + 1, maxRetries: maxRetries + 1, delayMs },
            'Native API rate limit hit, retrying after delay'
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // For other errors or final retry exhausted, return null
        return null;
      }
    }

    logger.warn(
      { symbol, maxRetries: maxRetries + 1 },
      'Native API retry exhausted, giving up'
    );
    return null;
  }

  /**
   * Get funding interval from OKX Native API as fallback
   * Feature: 024-fix-okx-funding-normalization (User Story 3)
   * Called when CCXT fails to provide valid timestamps
   */
  private async getFundingIntervalFromNativeAPI(symbol: string): Promise<number | null> {
    try {
      // T048: Convert symbol format (BTCUSDT -> BTC-USDT-SWAP)
      const instId = this.toOkxInstId(symbol);

      const axios = require('axios');
      const baseUrl = this.isTestnet ? 'https://www.okx.com' : 'https://www.okx.com';

      // T049, T053: Implement axios GET request with timeout
      const response = await axios.get(`${baseUrl}/api/v5/public/funding-rate`, {
        params: { instId },
        timeout: 5000,
      });

      const data = response.data;

      // T052: Handle OKX API errors
      if (data.code === '51001') {
        logger.warn(
          { symbol, instId, errorCode: data.code },
          'Native API: Invalid instId - instrument does not exist'
        );
        return null;
      }

      if (data.code === '50011') {
        // Rate limit error - will be handled by retry logic
        throw new Error('RATE_LIMIT');
      }

      if (data.code === '50013') {
        logger.warn(
          { symbol, instId, errorCode: data.code },
          'Native API: System busy, please try again later'
        );
        return null;
      }

      // Validate response format
      if (data.code !== '0' || !Array.isArray(data.data) || data.data.length === 0) {
        logger.warn(
          { symbol, instId, responseCode: data.code },
          'Native API: Invalid response format'
        );
        return null;
      }

      // T050: Extract fundingTime and nextFundingTime
      const rateData = data.data[0];
      const fundingTimeStr = rateData.fundingTime;
      const nextFundingTimeStr = rateData.nextFundingTime;

      if (!fundingTimeStr || !nextFundingTimeStr) {
        logger.warn(
          { symbol, instId, rateData },
          'Native API: Missing fundingTime or nextFundingTime'
        );
        return null;
      }

      // T051: Parse timestamps and calculate interval
      const fundingTime = parseInt(fundingTimeStr, 10);
      const nextFundingTime = parseInt(nextFundingTimeStr, 10);

      if (isNaN(fundingTime) || isNaN(nextFundingTime) || nextFundingTime <= fundingTime) {
        logger.warn(
          { symbol, instId, fundingTime, nextFundingTime },
          'Native API: Invalid timestamps'
        );
        return null;
      }

      const intervalMs = nextFundingTime - fundingTime;
      const rawIntervalHours = intervalMs / (60 * 60 * 1000);

      // T076: Integrate validateAndRoundInterval() into Native API path
      const validationResult = this.validateAndRoundInterval(symbol, rawIntervalHours);

      if (!validationResult) {
        logger.warn(
          { symbol, instId, rawIntervalHours },
          'Native API: Calculated interval is invalid'
        );
        return null;
      }

      const intervalHours = validationResult.interval;

      logger.info(
        {
          symbol,
          instId,
          interval: intervalHours,
          source: 'native-api',
          fundingTime: new Date(fundingTime).toISOString(),
          nextFundingTime: new Date(nextFundingTime).toISOString(),
          ...(validationResult.rounded && {
            originalInterval: rawIntervalHours,
            rounded: true,
            deviation: validationResult.deviation,
          }),
        },
        'Funding interval retrieved from Native API'
      );

      return intervalHours;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // T057: Handle rate limit with retry signal
      if (err.message === 'RATE_LIMIT') {
        throw err; // Re-throw to trigger retry logic
      }

      // T053: Handle network timeout
      if (err.message.includes('timeout')) {
        logger.warn(
          { symbol, error: err.message },
          'Native API: Request timeout'
        );
        return null;
      }

      logger.warn(
        { symbol, error: err.message },
        'Native API: Failed to fetch funding interval'
      );
      return null;
    }
  }

  /**
   * Get funding interval for a symbol by calculating from timestamps
   * Feature: 017-funding-rate-intervals
   * Strategy: Calculate interval from (nextFundingTime - fundingTime) / 3600000
   */
  async getFundingInterval(symbol: string): Promise<number> {
    this.ensureConnected();

    try {
      // 1. Check cache first
      const cached = this.intervalCache.get('okx', symbol);
      if (cached !== null) {
        logger.debug({ symbol, interval: cached, source: 'cache' }, 'Funding interval retrieved from cache');
        return cached;
      }

      // 2. Fetch funding rate to get timestamps
      const ccxtSymbol = this.toCcxtSymbol(symbol);
      const fundingRate = await this.client!.fetchFundingRate(ccxtSymbol);

      // 3. Extract fundingTime and nextFundingTime from info object
      const info = (fundingRate as any).info;
      const fundingTimeStr = info?.fundingTime;
      const nextFundingTimeStr = info?.nextFundingTime;

      // T031-T033: Enhanced warning when fundingTime/nextFundingTime missing
      if (!fundingTimeStr || !nextFundingTimeStr) {
        logger.warn(
          {
            symbol,
            availableFields: Object.keys(info || {}),
            fundingTimePresent: !!fundingTimeStr,
            nextFundingTimePresent: !!nextFundingTimeStr,
          },
          'CCXT did not expose fundingTime or nextFundingTime fields, falling back to Native API'
        );

        // T054-T055: Fallback to Native API
        const nativeInterval = await this.getFundingIntervalFromNativeAPIWithRetry(symbol);
        if (nativeInterval !== null) {
          // T056: Cache Native API result
          this.intervalCache.set('okx', symbol, nativeInterval, 'native-api');
          return nativeInterval;
        }

        // If Native API also fails, use default
        logger.warn({ symbol }, 'Native API also failed, using default 8h');
        this.intervalCache.set('okx', symbol, 8, 'default');
        return 8;
      }

      // 4. Parse timestamps (OKX returns milliseconds as strings)
      const fundingTime = parseInt(fundingTimeStr, 10);
      const nextFundingTime = parseInt(nextFundingTimeStr, 10);

      // 5. T034-T035: Enhanced validation with detailed error logging
      if (isNaN(fundingTime) || isNaN(nextFundingTime)) {
        logger.warn(
          {
            symbol,
            fundingTime,
            nextFundingTime,
            fundingTimeRaw: fundingTimeStr,
            nextFundingTimeRaw: nextFundingTimeStr,
            parsedCorrectly: {
              fundingTime: !isNaN(fundingTime),
              nextFundingTime: !isNaN(nextFundingTime),
            },
          },
          'Invalid timestamps detected (NaN after parsing), using default 8h'
        );
        this.intervalCache.set('okx', symbol, 8, 'default');
        return 8;
      }

      if (nextFundingTime <= fundingTime) {
        logger.warn(
          {
            symbol,
            fundingTime,
            nextFundingTime,
            fundingTimeISO: new Date(fundingTime).toISOString(),
            nextFundingTimeISO: new Date(nextFundingTime).toISOString(),
            difference: nextFundingTime - fundingTime,
          },
          'Invalid timestamps detected (nextFundingTime <= fundingTime), using default 8h'
        );
        this.intervalCache.set('okx', symbol, 8, 'default');
        return 8;
      }

      // 6. Calculate interval in hours (raw calculation before validation)
      const intervalMs = nextFundingTime - fundingTime;
      const rawIntervalHours = intervalMs / (60 * 60 * 1000);

      // T075: Integrate validateAndRoundInterval() into CCXT path
      const validationResult = this.validateAndRoundInterval(symbol, rawIntervalHours);

      if (!validationResult) {
        // T036-T037: Enhanced warning for non-positive intervals
        logger.warn(
          {
            symbol,
            rawIntervalHours,
            intervalMs,
            fundingTime,
            nextFundingTime,
            fundingTimeISO: new Date(fundingTime).toISOString(),
            nextFundingTimeISO: new Date(nextFundingTime).toISOString(),
          },
          'Calculated interval is invalid, using default 8h'
        );
        this.intervalCache.set('okx', symbol, 8, 'default');
        return 8;
      }

      // Use validated interval
      const intervalHours = validationResult.interval;

      // 7. Cache and return
      this.intervalCache.set('okx', symbol, intervalHours, 'calculated');

      // T019-T021, T077: Add detailed logging when successfully calculating interval
      logger.info(
        {
          symbol,
          interval: intervalHours,
          source: 'calculated',
          fundingTime: new Date(fundingTime).toISOString(),
          nextFundingTime: new Date(nextFundingTime).toISOString(),
          intervalMs,
          ...(validationResult.rounded && {
            originalInterval: rawIntervalHours,
            rounded: true,
            deviation: validationResult.deviation,
          }),
        },
        'Funding interval calculated from OKX timestamps'
      );
      return intervalHours;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        { symbol, error: err.message },
        'Failed to calculate funding interval, using default 8h'
      );
      return 8;
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRateData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const fundingRate = await this.client!.fetchFundingRate(ccxtSymbol);

        // Get dynamic funding interval
        const interval = await this.getFundingInterval(symbol);

        return {
          exchange: 'okx',
          symbol: this.fromCcxtSymbol(fundingRate.symbol),
          fundingRate: fundingRate.fundingRate || 0,
          nextFundingTime: new Date(fundingRate.fundingTimestamp || Date.now()),
          markPrice: fundingRate.markPrice,
          indexPrice: fundingRate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: interval,
        } as FundingRateData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getFundingRate');
  }

  /**
   * 使用 OKX Native API 獲取資金費率（用於驗證）
   * Feature: 004-fix-okx-add-price-display (T017)
   * Endpoint: /api/v5/public/funding-rate
   */
  async getFundingRateNative(symbol: string): Promise<{
    fundingRate: number;
    nextFundingRate?: number;
    fundingTime?: Date;
  }> {
    // OKX API 需要 instId 格式: BTC-USDT-SWAP
    const instId = this.toOkxInstId(symbol);

    const axios = require('axios');
    const baseUrl = this.isTestnet
      ? 'https://www.okx.com'  // OKX 測試網 URL
      : 'https://www.okx.com';

    try {
      const response = await axios.get(`${baseUrl}/api/v5/public/funding-rate`, {
        params: {
          instId,
        },
        timeout: 5000,
      });

      const data = response.data;

      // 驗證回應格式
      if (data.code !== '0' || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error(`Invalid OKX API response: ${JSON.stringify(data)}`);
      }

      const rateData = data.data[0];

      return {
        fundingRate: parseFloat(rateData.fundingRate),
        nextFundingRate: rateData.nextFundingRate ? parseFloat(rateData.nextFundingRate) : undefined,
        fundingTime: rateData.fundingTime ? new Date(parseInt(rateData.fundingTime)) : undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, symbol, instId }, 'Failed to fetch OKX funding rate via Native API');
      throw err;
    }
  }

  /**
   * 轉換為 OKX instId 格式
   * BTCUSDT -> BTC-USDT-SWAP
   */
  private toOkxInstId(symbol: string): string {
    const base = symbol.replace('USDT', '');
    return `${base}-USDT-SWAP`;
  }

  async getFundingRates(symbols: string[]): Promise<FundingRateData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const fundingRates = await this.client!.fetchFundingRates(ccxtSymbols);

        // Fetch intervals for all symbols in parallel
        const ratesArray = Object.values(fundingRates) as ccxt.FundingRate[];
        const intervals = await Promise.all(
          ratesArray.map((rate) => this.getFundingInterval(this.fromCcxtSymbol(rate.symbol)))
        );

        return ratesArray.map((rate, index) => ({
          exchange: 'okx',
          symbol: this.fromCcxtSymbol(rate.symbol),
          fundingRate: rate.fundingRate || 0,
          nextFundingTime: new Date(rate.fundingTimestamp || Date.now()),
          markPrice: rate.markPrice,
          indexPrice: rate.indexPrice,
          recordedAt: new Date(),
          fundingInterval: intervals[index],
        })) as FundingRateData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getFundingRates');
  }

  async getPrice(symbol: string): Promise<PriceData> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        const ticker = await this.client!.fetchTicker(ccxtSymbol);

        return {
          exchange: 'okx',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        } as PriceData;
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getPrice');
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbols = symbols.map((s) => this.toCcxtSymbol(s));
        const tickers = await this.client!.fetchTickers(ccxtSymbols);

        return (Object.values(tickers) as ccxt.Ticker[]).map((ticker) => ({
          exchange: 'okx',
          symbol: this.fromCcxtSymbol(ticker.symbol),
          price: ticker.last || 0,
          timestamp: new Date(ticker.timestamp || Date.now()),
        })) as PriceData[];
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getPrices');
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
          throw new Error(`Symbol ${symbol} not found on OKX`);
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
    }, 'okx', 'getSymbolInfo');
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
          exchange: 'okx',
          balances,
          totalEquityUSD,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getBalance');
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
          exchange: 'okx',
          positions: formattedPositions,
          timestamp: new Date(),
        };
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'getPositions');
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
    }, 'okx', 'getPosition');
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
    }, 'okx', 'createOrder');
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.ensureConnected();

    return retryApiCall(async () => {
      try {
        const ccxtSymbol = this.toCcxtSymbol(symbol);
        await this.client!.cancelOrder(orderId, ccxtSymbol);
        logger.info({ exchange: 'okx', symbol, orderId }, 'Order cancelled');
      } catch (error) {
        throw this.handleApiError(error);
      }
    }, 'okx', 'cancelOrder');
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
    }, 'okx', 'getOrder');
  }

  async subscribeWS(_subscription: WSSubscription): Promise<void> {
    // TODO: 實作 WebSocket 訂閱
    logger.warn('WebSocket subscription not yet implemented for OKX');
  }

  async unsubscribeWS(_type: WSSubscriptionType, _symbol?: string): Promise<void> {
    // TODO: 實作 WebSocket 取消訂閱
    logger.warn('WebSocket unsubscription not yet implemented for OKX');
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
        return new ExchangeRateLimitError('okx', { originalError: error.message });
      }

      // CCXT 錯誤
      if (error instanceof ccxt.NetworkError) {
        return new ExchangeConnectionError('okx', { originalError: error.message });
      }

      if (error instanceof ccxt.ExchangeError) {
        return new ExchangeApiError('okx', 'API_ERROR', error.message);
      }

      return error;
    }

    return new ExchangeApiError('okx', 'UNKNOWN', String(error));
  }
}
