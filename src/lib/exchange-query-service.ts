/**
 * 交易所查詢服務（可重用模組）
 * Feature: 050-sl-tp-trigger-monitor
 *
 * 封裝 CCXT 交易所連接，用於查詢持倉、條件單和訂單歷史
 * 從 src/scripts/trading-validation/ExchangeQueryService.ts 重構
 */

import * as ccxt from 'ccxt';
import { logger } from './logger';

// ===== Type Definitions =====

/** 支援的交易所 */
export type ExchangeName = 'binance' | 'okx' | 'gateio' | 'bingx';

/** 解密後的 API Key */
export interface DecryptedApiKey {
  apiKey: string;
  secret: string;
  passphrase?: string;
}

/** 交易所持倉資訊 */
export interface ExchangePosition {
  symbol: string;
  side: 'long' | 'short';
  contracts: number;
  contractSize: number;
  quantity: number;
  entryPrice: number;
  unrealizedPnl: number;
}

/** 交易所條件單資訊 */
export interface ExchangeConditionalOrder {
  orderId: string;
  type: 'stop_loss' | 'take_profit';
  symbol: string;
  triggerPrice: number;
  contracts: number;
  contractSize: number;
  quantity: number;
  status: 'open' | 'triggered' | 'cancelled';
}

/** 訂單歷史查詢結果 */
export interface OrderHistoryResult {
  orderId: string;
  status: 'TRIGGERED' | 'CANCELED' | 'EXPIRED' | 'UNKNOWN';
  triggerPrice?: number;
  executedAt?: Date;
  rawData?: any;
}

// ===== Utility Functions =====

/**
 * 轉換交易對格式為 CCXT symbol
 */
export function convertToCcxtSymbol(symbol: string): string {
  // BTCUSDT -> BTC/USDT:USDT
  if (!symbol.includes('/')) {
    const base = symbol.replace('USDT', '');
    return `${base}/USDT:USDT`;
  }
  return symbol;
}

/**
 * 重試機制
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError;
}

// ===== ExchangeQueryService =====

/**
 * 交易所查詢服務
 */
export class ExchangeQueryService {
  private exchange: ccxt.Exchange | null = null;
  private exchangeName: ExchangeName;
  private marketsLoaded = false;
  private apiKey: DecryptedApiKey | null = null;
  private isPortfolioMargin = false;

  constructor(exchangeName: ExchangeName) {
    this.exchangeName = exchangeName;
  }

  /**
   * 建立交易所連接
   */
  async connect(apiKey: DecryptedApiKey): Promise<void> {
    this.apiKey = apiKey;
    const exchangeClass = this.getExchangeClass();

    const config: any = {
      apiKey: apiKey.apiKey,
      secret: apiKey.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        adjustForTimeDifference: true,
      },
    };

    // OKX 需要 passphrase
    if (this.exchangeName === 'okx' && apiKey.passphrase) {
      config.password = apiKey.passphrase;
    }

    this.exchange = new exchangeClass(config);

    // Binance 需要檢測是否為 Portfolio Margin 帳戶
    if (this.exchangeName === 'binance') {
      await this.detectBinanceAccountType();
    }
  }

  /**
   * 檢測 Binance 帳戶類型
   */
  private async detectBinanceAccountType(): Promise<void> {
    if (!this.exchange || !this.apiKey) return;

    try {
      await (this.exchange as any).fapiPrivateGetPositionRisk();
      this.isPortfolioMargin = false;
    } catch (error: any) {
      const errorStr = String(error.message || error);
      const isAuthError =
        errorStr.includes('-2015') ||
        errorStr.includes('404') ||
        errorStr.includes('Not Found');

      if (isAuthError) {
        try {
          const papiResponse = await (this.exchange as any).papiGetUmAccount();
          if (papiResponse) {
            this.isPortfolioMargin = true;
            await this.recreateWithPortfolioMargin();
          }
        } catch (papiError) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 重新建立 Binance exchange 並啟用 Portfolio Margin
   */
  private async recreateWithPortfolioMargin(): Promise<void> {
    if (!this.apiKey) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BinanceClass = (ccxt as any).binance;
    this.exchange = new BinanceClass({
      apiKey: this.apiKey.apiKey,
      secret: this.apiKey.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        adjustForTimeDifference: true,
        portfolioMargin: true,
      },
    });
    this.marketsLoaded = false;
  }

  /**
   * 取得交易所類別
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getExchangeClass(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ccxtAny = ccxt as any;
    switch (this.exchangeName) {
      case 'binance':
        return ccxtAny.binance;
      case 'okx':
        return ccxtAny.okx;
      case 'gateio':
        return ccxtAny.gate;
      case 'bingx':
        return ccxtAny.bingx;
      default:
        throw new Error(`不支援的交易所: ${this.exchangeName}`);
    }
  }

  /**
   * 確保市場資料已載入
   */
  private async ensureMarketsLoaded(): Promise<void> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    if (!this.marketsLoaded) {
      await this.exchange.loadMarkets();
      this.marketsLoaded = true;
    }
  }

  /**
   * 查詢條件單
   */
  async fetchConditionalOrders(
    symbol: string,
  ): Promise<ExchangeConditionalOrder[]> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();
    const ccxtSymbol = convertToCcxtSymbol(symbol);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const market = (this.exchange as any).markets?.[ccxtSymbol];
    const contractSize = market?.contractSize || 1;

    try {
      switch (this.exchangeName) {
        case 'binance':
          return await this.fetchBinanceConditionalOrders(
            ccxtSymbol,
            contractSize,
          );
        case 'okx':
          return await this.fetchOkxConditionalOrders(ccxtSymbol, contractSize);
        case 'gateio':
          return await this.fetchGateioConditionalOrders(
            ccxtSymbol,
            contractSize,
          );
        case 'bingx':
          return await this.fetchBingxConditionalOrders(
            ccxtSymbol,
            contractSize,
          );
        default:
          return [];
      }
    } catch (error) {
      logger.error(
        { error, exchange: this.exchangeName, symbol },
        'Failed to fetch conditional orders',
      );
      throw error;
    }
  }

  // ===== NEW: Order History Query Methods (Feature 050) =====

  /**
   * 查詢訂單歷史以確認觸發狀態
   * @param symbol 交易對
   * @param orderId 訂單 ID
   * @returns OrderHistoryResult 或 null（找不到）
   */
  async fetchOrderHistory(
    symbol: string,
    orderId: string,
  ): Promise<OrderHistoryResult | null> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();

    try {
      switch (this.exchangeName) {
        case 'binance':
          return await this.fetchBinanceOrderHistory(symbol, orderId);
        case 'okx':
          return await this.fetchOkxOrderHistory(symbol, orderId);
        case 'gateio':
          return await this.fetchGateioOrderHistory(symbol, orderId);
        case 'bingx':
          return await this.fetchBingxOrderHistory(symbol, orderId);
        default:
          return null;
      }
    } catch (error) {
      logger.error(
        { error, exchange: this.exchangeName, symbol, orderId },
        'Failed to fetch order history',
      );
      throw error;
    }
  }

  /**
   * 檢查條件單是否存在於待執行列表
   */
  async checkOrderExists(symbol: string, orderId: string): Promise<boolean> {
    const orders = await this.fetchConditionalOrders(symbol);
    return orders.some((order) => order.orderId === orderId);
  }

  /**
   * Binance 訂單歷史查詢
   */
  private async fetchBinanceOrderHistory(
    symbol: string,
    orderId: string,
  ): Promise<OrderHistoryResult | null> {
    const exchangeSymbol = symbol.replace('USDT', '').replace('/', '') + 'USDT';

    if (this.isPortfolioMargin) {
      // Portfolio Margin 使用 papiGetUmConditionalOrderHistory
      const response = await retry(async () => {
        return await (this.exchange as any).papiGetUmConditionalOrderHistory({
          symbol: exchangeSymbol,
          strategyId: orderId,
        });
      });

      const order = (response || []).find(
        (o: any) => o.strategyId?.toString() === orderId,
      );

      if (!order) return null;

      // strategyStatus: TRIGGERED, EXPIRED, NEW, etc.
      const status = this.mapBinanceStatus(order.strategyStatus);

      return {
        orderId: order.strategyId?.toString(),
        status,
        triggerPrice: parseFloat(order.stopPrice || '0'),
        executedAt: order.updateTime ? new Date(order.updateTime) : undefined,
        rawData: order,
      };
    } else {
      // 標準期貨使用 fapiPrivateGetConditionalOrderHistory
      const response = await retry(async () => {
        return await (this.exchange as any).fapiPrivateGetConditionalOrderHistory({
          symbol: exchangeSymbol,
          strategyId: orderId,
        });
      });

      const order = (response || []).find(
        (o: any) => o.strategyId?.toString() === orderId,
      );

      if (!order) return null;

      const status = this.mapBinanceStatus(order.strategyStatus);

      return {
        orderId: order.strategyId?.toString(),
        status,
        triggerPrice: parseFloat(order.stopPrice || '0'),
        executedAt: order.updateTime ? new Date(order.updateTime) : undefined,
        rawData: order,
      };
    }
  }

  private mapBinanceStatus(strategyStatus: string): OrderHistoryResult['status'] {
    switch (strategyStatus?.toUpperCase()) {
      case 'TRIGGERED':
        return 'TRIGGERED';
      case 'EXPIRED':
        return 'EXPIRED';
      case 'CANCELLED':
      case 'CANCELED':
        return 'CANCELED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * OKX 訂單歷史查詢
   */
  private async fetchOkxOrderHistory(
    _symbol: string,
    orderId: string,
  ): Promise<OrderHistoryResult | null> {
    const response = await retry(async () => {
      return await (this.exchange as any).privateGetTradeOrdersAlgoHistory({
        instType: 'SWAP',
        ordType: 'trigger',
        algoId: orderId,
      });
    });

    const data = response?.data || [];
    const order = data.find((o: any) => o.algoId === orderId);

    if (!order) return null;

    // state: effective (觸發成交), canceled, order_failed
    const status = this.mapOkxStatus(order.state);

    return {
      orderId: order.algoId,
      status,
      triggerPrice: parseFloat(order.triggerPx || '0'),
      executedAt: order.triggerTime ? new Date(parseInt(order.triggerTime)) : undefined,
      rawData: order,
    };
  }

  private mapOkxStatus(state: string): OrderHistoryResult['status'] {
    switch (state?.toLowerCase()) {
      case 'effective':
      case 'filled':
        return 'TRIGGERED';
      case 'canceled':
      case 'cancelled':
        return 'CANCELED';
      case 'expired':
        return 'EXPIRED';
      case 'order_failed':
        return 'UNKNOWN';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Gate.io 訂單歷史查詢
   */
  private async fetchGateioOrderHistory(
    _symbol: string,
    orderId: string,
  ): Promise<OrderHistoryResult | null> {
    try {
      // Gate.io 可以直接用 orderId 查詢
      const response = await retry(async () => {
        return await (this.exchange as any).privateFuturesGetSettlePriceOrdersOrderId({
          settle: 'usdt',
          order_id: orderId,
        });
      });

      if (!response) return null;

      // finish_as: filled (成交), cancelled
      const status = this.mapGateioStatus(response.finish_as, response.status);

      return {
        orderId: response.id?.toString(),
        status,
        triggerPrice: parseFloat(response.trigger?.price || '0'),
        executedAt: response.finished_at ? new Date(response.finished_at * 1000) : undefined,
        rawData: response,
      };
    } catch (error) {
      logger.warn({ error, orderId }, 'Gate.io order history query failed');
      return null;
    }
  }

  private mapGateioStatus(finishAs: string, status: string): OrderHistoryResult['status'] {
    if (finishAs === 'filled' || status === 'finished') {
      return 'TRIGGERED';
    }
    if (finishAs === 'cancelled' || finishAs === 'canceled') {
      return 'CANCELED';
    }
    if (finishAs === 'expired') {
      return 'EXPIRED';
    }
    return 'UNKNOWN';
  }

  /**
   * BingX 訂單歷史查詢
   * 使用 CCXT 統一 API fetchClosedOrders
   */
  private async fetchBingxOrderHistory(
    symbol: string,
    orderId: string,
  ): Promise<OrderHistoryResult | null> {
    const ccxtSymbol = convertToCcxtSymbol(symbol);

    try {
      // 方法 1: 嘗試使用 fetchOrder 直接查詢
      try {
        const order = await retry(async () => {
          return await (this.exchange as any).fetchOrder(orderId, ccxtSymbol);
        });

        if (order) {
          const status = this.mapBingxStatus(order.status);
          return {
            orderId: order.id?.toString(),
            status,
            triggerPrice: parseFloat(order.stopPrice || order.triggerPrice || '0'),
            executedAt: order.timestamp ? new Date(order.timestamp) : undefined,
            rawData: order,
          };
        }
      } catch (fetchOrderError) {
        // fetchOrder 失敗，嘗試 fetchClosedOrders
        logger.debug(
          { orderId, error: (fetchOrderError as Error).message },
          'BingX fetchOrder failed, trying fetchClosedOrders',
        );
      }

      // 方法 2: 使用 fetchClosedOrders 查詢最近的已關閉訂單
      const closedOrders = await retry(async () => {
        return await (this.exchange as any).fetchClosedOrders(ccxtSymbol, undefined, 100);
      });

      const order = (closedOrders || []).find(
        (o: any) => o.id?.toString() === orderId || o.clientOrderId === orderId,
      );

      if (!order) {
        logger.debug({ orderId, symbol }, 'Order not found in BingX closed orders');
        return null;
      }

      const status = this.mapBingxStatus(order.status);

      return {
        orderId: order.id?.toString(),
        status,
        triggerPrice: parseFloat(order.stopPrice || order.triggerPrice || '0'),
        executedAt: order.timestamp ? new Date(order.timestamp) : undefined,
        rawData: order,
      };
    } catch (error) {
      logger.warn(
        { error: (error as Error).message, orderId, symbol },
        'BingX order history query failed',
      );
      return null;
    }
  }

  private mapBingxStatus(status: string): OrderHistoryResult['status'] {
    switch (status?.toUpperCase()) {
      case 'FILLED':
        return 'TRIGGERED';
      case 'CANCELED':
      case 'CANCELLED':
        return 'CANCELED';
      case 'EXPIRED':
        return 'EXPIRED';
      default:
        return 'UNKNOWN';
    }
  }

  // ===== Existing Methods (from original ExchangeQueryService) =====

  /**
   * Binance 條件單查詢
   */
  private async fetchBinanceConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const conditionalOrders: ExchangeConditionalOrder[] = [];
    const exchangeSymbol = symbol.replace('/', '').replace(':USDT', '');

    if (this.isPortfolioMargin) {
      try {
        const response = await retry(async () => {
          return await (this.exchange as any).papiGetUmConditionalOpenOrders({
            symbol: exchangeSymbol,
          });
        });

        for (const order of response || []) {
          const strategyType = (
            order.strategyType ||
            order.type ||
            ''
          ).toUpperCase();
          if (
            strategyType === 'STOP_MARKET' ||
            strategyType === 'TAKE_PROFIT_MARKET'
          ) {
            const quantity = parseFloat(order.origQty || '0');
            conditionalOrders.push({
              orderId:
                order.strategyId?.toString() || order.orderId?.toString() || '',
              type: strategyType === 'STOP_MARKET' ? 'stop_loss' : 'take_profit',
              symbol,
              triggerPrice: parseFloat(order.stopPrice || '0'),
              contracts: quantity,
              contractSize,
              quantity: quantity * contractSize,
              status: 'open',
            });
          }
        }
      } catch (error) {
        logger.error(
          { error, symbol },
          'Failed to fetch Binance Portfolio Margin conditional orders',
        );
      }
    } else {
      const orders = await retry(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (this.exchange as any).fetchOpenOrders(symbol);
      });

      for (const order of orders) {
        const type = order.type?.toUpperCase() || '';
        if (type === 'STOP_MARKET' || type === 'TAKE_PROFIT_MARKET') {
          conditionalOrders.push({
            orderId: order.id,
            type: type === 'STOP_MARKET' ? 'stop_loss' : 'take_profit',
            symbol: order.symbol,
            triggerPrice: order.stopPrice || order.triggerPrice || 0,
            contracts: order.amount || 0,
            contractSize,
            quantity: (order.amount || 0) * contractSize,
            status: 'open',
          });
        }
      }
    }

    return conditionalOrders;
  }

  /**
   * OKX 條件單查詢
   */
  private async fetchOkxConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const okxExchange = this.exchange as any;

    const response = await retry(async () => {
      return await okxExchange.privateGetTradeOrdersAlgoPending({
        instType: 'SWAP',
        ordType: 'trigger',
      });
    });

    const conditionalOrders: ExchangeConditionalOrder[] = [];
    const data = response?.data || [];
    const okxInstId = symbol.replace('/', '-').replace(':USDT', '-SWAP');

    const symbolOrders: Array<{ order: any; triggerPrice: number }> = [];

    for (const order of data) {
      if (order.instId !== okxInstId) continue;

      const triggerPrice = parseFloat(order.triggerPx || '0');
      if (triggerPrice > 0) {
        symbolOrders.push({ order, triggerPrice });
      }
    }

    for (const { order, triggerPrice } of symbolOrders) {
      const posSide = order.posSide?.toLowerCase() || '';
      const contracts = parseFloat(order.sz || '0');

      conditionalOrders.push({
        orderId: order.algoId,
        type: 'stop_loss', // 暫時設為 stop_loss，後面再修正
        symbol,
        triggerPrice,
        contracts,
        contractSize,
        quantity: contracts * contractSize,
        status: 'open',
        posSide,
      } as ExchangeConditionalOrder & { posSide?: string });
    }

    // 根據 posSide 和價格區分 SL 和 TP
    const longOrders = conditionalOrders.filter(
      (o: any) => o.posSide === 'long',
    );
    const shortOrders = conditionalOrders.filter(
      (o: any) => o.posSide === 'short',
    );

    if (longOrders.length === 2 && longOrders[0] && longOrders[1]) {
      longOrders.sort((a, b) => a.triggerPrice - b.triggerPrice);
      longOrders[0].type = 'stop_loss';
      longOrders[1].type = 'take_profit';
    }

    if (shortOrders.length === 2 && shortOrders[0] && shortOrders[1]) {
      shortOrders.sort((a, b) => b.triggerPrice - a.triggerPrice);
      shortOrders[0].type = 'stop_loss';
      shortOrders[1].type = 'take_profit';
    }

    conditionalOrders.forEach((o: any) => delete o.posSide);

    return conditionalOrders;
  }

  /**
   * Gate.io 條件單查詢
   */
  private async fetchGateioConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const gateExchange = this.exchange as any;

    const response = await retry(async () => {
      return await gateExchange.privateFuturesGetSettlePriceOrders({
        settle: 'usdt',
        status: 'open',
      });
    });

    const conditionalOrders: ExchangeConditionalOrder[] = [];
    const gateContract = symbol.replace('/', '_').replace(':USDT', '');

    for (const order of response || []) {
      const orderContract = order.initial?.contract || order.contract;
      const orderSize = order.initial?.size || order.size;

      if (orderContract !== gateContract) continue;

      const rule = parseInt(order.trigger?.rule || '0', 10);
      const size = parseFloat(orderSize || '0');
      let type: 'stop_loss' | 'take_profit' = 'stop_loss';

      if (size < 0) {
        type = rule === 1 ? 'take_profit' : 'stop_loss';
      } else {
        type = rule === 1 ? 'stop_loss' : 'take_profit';
      }

      const contracts = Math.abs(size);
      conditionalOrders.push({
        orderId: order.id?.toString() || '',
        type,
        symbol,
        triggerPrice: parseFloat(order.trigger?.price || '0'),
        contracts,
        contractSize,
        quantity: contracts * contractSize,
        status: 'open',
      });
    }

    return conditionalOrders;
  }

  /**
   * BingX 條件單查詢
   */
  private async fetchBingxConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const conditionalOrders: ExchangeConditionalOrder[] = [];

    try {
      const bingxExchange = this.exchange as any;
      const exchangeSymbol = symbol.replace('/', '-').replace(':USDT', '');

      const response = await retry(async () => {
        return await bingxExchange.swapV2PrivateGetTradeOpenOrders({
          symbol: exchangeSymbol,
        });
      });

      const orders = response?.data?.orders || [];
      for (const order of orders) {
        const type = order.type?.toUpperCase() || '';
        if (
          type === 'STOP_MARKET' ||
          type === 'TAKE_PROFIT_MARKET' ||
          type === 'STOP' ||
          type === 'TAKE_PROFIT' ||
          type === 'TRIGGER_MARKET'
        ) {
          const quantity = parseFloat(order.origQty || order.quantity || '0');
          conditionalOrders.push({
            orderId: order.orderId?.toString() || '',
            type: type.includes('STOP') ? 'stop_loss' : 'take_profit',
            symbol,
            triggerPrice: parseFloat(
              order.stopPrice || order.triggerPrice || '0',
            ),
            contracts: quantity,
            contractSize,
            quantity: quantity * contractSize,
            status: 'open',
          });
        }
      }
    } catch (error) {
      logger.error(
        { error, exchange: 'bingx', symbol },
        'Failed to fetch BingX conditional orders',
      );

      // Fallback to fetchOpenOrders
      try {
        const orders = await retry(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return await (this.exchange as any).fetchOpenOrders(symbol);
        });

        for (const order of orders) {
          const type = order.type?.toUpperCase() || '';
          if (
            type === 'STOP_MARKET' ||
            type === 'TAKE_PROFIT_MARKET' ||
            type === 'STOP' ||
            type === 'TAKE_PROFIT'
          ) {
            conditionalOrders.push({
              orderId: order.id,
              type: type.includes('STOP') ? 'stop_loss' : 'take_profit',
              symbol: order.symbol,
              triggerPrice: order.stopPrice || order.triggerPrice || 0,
              contracts: order.amount || 0,
              contractSize,
              quantity: (order.amount || 0) * contractSize,
              status: 'open',
            });
          }
        }
      } catch (fallbackError) {
        logger.error(
          { error: fallbackError, exchange: 'bingx', symbol },
          'BingX fetchOpenOrders fallback also failed',
        );
      }
    }

    return conditionalOrders;
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    this.exchange = null;
    this.marketsLoaded = false;
  }

  /**
   * 取得 exchange 實例（用於測試）
   */
  getExchange(): ccxt.Exchange | null {
    return this.exchange;
  }

  /**
   * 取得是否為 Portfolio Margin（用於測試）
   */
  getIsPortfolioMargin(): boolean {
    return this.isPortfolioMargin;
  }
}
