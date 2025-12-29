/**
 * MEXC Conditional Order Adapter
 *
 * MEXC 期貨條件單適配器：使用類似 Binance 的 STOP_MARKET/TAKE_PROFIT_MARKET
 * Feature: 038-specify-scripts-bash
 *
 * API Reference: https://mexcdevelop.github.io/apidocs/contract_v1_en/
 */

import { logger } from '../../../lib/logger';
import { formatPriceForExchange } from '../../../lib/conditional-order-calculator';
import type { SingleConditionalOrderResult } from '../../../types/trading';
import type {
  ConditionalOrderAdapter,
  SetStopLossOrderParams,
  SetTakeProfitOrderParams,
} from './ConditionalOrderAdapter';
import { getClosingSide, convertSymbolForExchange } from './ConditionalOrderAdapter';

/**
 * MEXC 條件單適配器
 */
export class MexcConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'mexc';
  private ccxtExchange: any; // CCXT MEXC instance
  private isHedgeMode: boolean;
  private marketsLoaded = false;

  constructor(
    ccxtExchange: any,
    options: { isHedgeMode: boolean } = { isHedgeMode: true },
  ) {
    this.ccxtExchange = ccxtExchange;
    this.isHedgeMode = options.isHedgeMode;
  }

  /**
   * 確保市場資料已載入
   */
  private async ensureMarketsLoaded(): Promise<void> {
    if (!this.marketsLoaded) {
      await this.ccxtExchange.loadMarkets();
      this.marketsLoaded = true;
    }
  }

  /**
   * 將數量轉換為合約張數
   * MEXC 某些幣種的 contractSize 不是 1
   */
  private convertToContracts(ccxtSymbol: string, quantity: number): number {
    const market = this.ccxtExchange.markets[ccxtSymbol];
    const contractSize = market?.contractSize || 1;

    if (contractSize !== 1) {
      const contracts = quantity / contractSize;
      logger.info(
        { symbol: ccxtSymbol, originalQuantity: quantity, contractSize, contracts },
        'MEXC: Converting quantity to contracts',
      );
      return contracts;
    }
    return quantity;
  }

  /**
   * 轉換 symbol 為 CCXT 格式
   * e.g., BTCUSDT -> BTC/USDT:USDT
   */
  private convertToCcxtSymbol(symbol: string): string {
    // 如果已經是 CCXT 格式，直接返回
    if (symbol.includes('/')) {
      return symbol;
    }

    // 處理純格式 BTCUSDT -> BTC/USDT:USDT
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}/${quote}:${quote}`;
      }
    }

    return `${symbol}/USDT:USDT`;
  }

  /**
   * 設定停損市價單
   */
  async setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult> {
    return this.setConditionalOrder({
      ...params,
      type: 'STOP_MARKET',
    });
  }

  /**
   * 設定停利市價單
   */
  async setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult> {
    return this.setConditionalOrder({
      ...params,
      type: 'TAKE_PROFIT_MARKET',
    });
  }

  /**
   * 取消條件單
   */
  async cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      const exchangeSymbol = convertSymbolForExchange(symbol, 'mexc');
      await this.ccxtExchange.cancelOrder(orderId, exchangeSymbol);
      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel MEXC conditional order');
      return false;
    }
  }

  /**
   * 設定條件單（內部方法）
   */
  private async setConditionalOrder(
    params: SetStopLossOrderParams & { type: 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' },
  ): Promise<SingleConditionalOrderResult> {
    const { symbol, side, quantity, triggerPrice, type } = params;

    try {
      // 確保市場資料已載入（用於合約大小轉換）
      await this.ensureMarketsLoaded();

      const exchangeSymbol = convertSymbolForExchange(symbol, 'mexc');
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);
      const closingSide = getClosingSide(side);
      const formattedPrice = formatPriceForExchange(triggerPrice);

      // 將數量轉換為合約張數（處理 contractSize != 1 的情況）
      const contractQuantity = this.convertToContracts(ccxtSymbol, quantity.toNumber());

      logger.info(
        {
          exchangeSymbol,
          type,
          closingSide,
          positionSide: side,
          triggerPrice: formattedPrice,
          originalQuantity: quantity.toString(),
          contractQuantity,
          isHedgeMode: this.isHedgeMode,
        },
        'Creating MEXC conditional order',
      );

      // 構建訂單參數
      const orderParams: Record<string, any> = {
        stopPrice: formattedPrice,
        reduceOnly: !this.isHedgeMode,
      };

      // Hedge Mode 需要指定 positionSide
      if (this.isHedgeMode) {
        orderParams.positionSide = side; // LONG or SHORT
      }

      const order = await this.ccxtExchange.createOrder(
        exchangeSymbol,
        type.toLowerCase(),
        closingSide.toLowerCase(),
        contractQuantity, // 使用轉換後的合約張數
        undefined,
        orderParams,
      );

      logger.info(
        { orderId: order.id, exchangeSymbol, type },
        'MEXC conditional order created successfully',
      );

      return {
        success: true,
        orderId: order.id,
        triggerPrice,
      };
    } catch (error) {
      const errorMessage = this.parseError(error);
      logger.error(
        { error, symbol, side, type, triggerPrice: triggerPrice.toString() },
        'Failed to create MEXC conditional order',
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 解析錯誤訊息
   */
  private parseError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message;

      // MEXC 特定錯誤碼處理
      if (message.includes('POSITION_SIDE_NOT_MATCH')) {
        return 'Position mode mismatch. Please check if Hedge Mode is enabled.';
      }
      if (message.includes('ORDER_WOULD_TRIGGER_IMMEDIATELY')) {
        return 'Order would trigger immediately. Please adjust the trigger price.';
      }
      if (message.includes('SYMBOL_NOT_FOUND')) {
        return 'Invalid symbol.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
