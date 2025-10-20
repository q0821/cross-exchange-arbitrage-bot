import { EventEmitter } from 'events';
import {
  IExchangeConnector,
  ExchangeName,
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
} from './types.js';
import { logger } from '../lib/logger.js';
import { ExchangeConnectionError } from '../lib/errors.js';

export abstract class BaseExchangeConnector extends EventEmitter implements IExchangeConnector {
  protected connected: boolean = false;
  protected wsConnected: boolean = false;
  protected symbolInfoCache: Map<string, SymbolInfo> = new Map();

  constructor(
    public readonly name: ExchangeName,
    public readonly isTestnet: boolean
  ) {
    super();
  }

  // 抽象方法 (子類必須實作)
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getFundingRate(symbol: string): Promise<FundingRateData>;
  abstract getFundingRates(symbols: string[]): Promise<FundingRateData[]>;
  abstract getPrice(symbol: string): Promise<PriceData>;
  abstract getPrices(symbols: string[]): Promise<PriceData[]>;
  abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  abstract getBalance(): Promise<AccountBalance>;
  abstract getPositions(): Promise<PositionInfo>;
  abstract getPosition(symbol: string): Promise<Position | null>;
  abstract createOrder(order: OrderRequest): Promise<OrderResponse>;
  abstract cancelOrder(symbol: string, orderId: string): Promise<void>;
  abstract getOrder(symbol: string, orderId: string): Promise<OrderResponse>;
  abstract subscribeWS(subscription: WSSubscription): Promise<void>;
  abstract unsubscribeWS(type: WSSubscriptionType, symbol?: string): Promise<void>;

  // 通用方法實作
  isConnected(): boolean {
    return this.connected;
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const info = await this.getSymbolInfo(symbol);
      return info.isActive;
    } catch (error) {
      logger.warn({
        symbol,
        exchange: this.name,
        error: error instanceof Error ? error.message : String(error),
      }, `Failed to validate symbol ${symbol} on ${this.name}`);
      return false;
    }
  }

  async formatQuantity(symbol: string, quantity: number): Promise<number> {
    const info = await this.getSymbolInfo(symbol);
    const precision = info.quantityPrecision;
    return parseFloat(quantity.toFixed(precision));
  }

  async formatPrice(symbol: string, price: number): Promise<number> {
    const info = await this.getSymbolInfo(symbol);
    const precision = info.pricePrecision;
    return parseFloat(price.toFixed(precision));
  }

  // 輔助方法
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new ExchangeConnectionError(this.name, {
        message: 'Exchange is not connected',
      });
    }
  }

  protected cacheSymbolInfo(symbol: string, info: SymbolInfo): void {
    this.symbolInfoCache.set(symbol, info);
  }

  protected getCachedSymbolInfo(symbol: string): SymbolInfo | undefined {
    return this.symbolInfoCache.get(symbol);
  }

  public emit(event: string, ...args: unknown[]): boolean {
    logger.debug({
      exchange: this.name,
      event,
    }, `Exchange event: ${event}`);
    return super.emit(event, ...args);
  }
}
