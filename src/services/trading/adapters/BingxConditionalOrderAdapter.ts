/**
 * BingX Conditional Order Adapter
 *
 * BingX 永續合約條件單適配器：使用 STOP_MARKET/TAKE_PROFIT_MARKET
 * Feature: 043-bingx-integration
 *
 * API Reference: https://bingx-api.github.io/docs/#/swapV2/trade-api.html
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
 * BingX 條件單適配器
 */
export class BingxConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'bingx';
  private ccxtExchange: any; // CCXT BingX instance
  private isHedgeMode: boolean;

  constructor(
    ccxtExchange: any,
    options: { isHedgeMode: boolean } = { isHedgeMode: true },
  ) {
    this.ccxtExchange = ccxtExchange;
    this.isHedgeMode = options.isHedgeMode;
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
      const exchangeSymbol = convertSymbolForExchange(symbol, 'bingx');
      await this.ccxtExchange.cancelOrder(orderId, exchangeSymbol);
      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel BingX conditional order');
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
      const exchangeSymbol = convertSymbolForExchange(symbol, 'bingx');
      const closingSide = getClosingSide(side);
      const formattedPrice = formatPriceForExchange(triggerPrice);
      const formattedQuantity = quantity.toString();

      logger.info(
        {
          exchangeSymbol,
          type,
          closingSide,
          positionSide: side,
          triggerPrice: formattedPrice,
          quantity: formattedQuantity,
          isHedgeMode: this.isHedgeMode,
        },
        'Creating BingX conditional order',
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
        parseFloat(formattedQuantity),
        undefined,
        orderParams,
      );

      logger.info(
        { orderId: order.id, exchangeSymbol, type },
        'BingX conditional order created successfully',
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
        'Failed to create BingX conditional order',
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

      // BingX 特定錯誤碼處理
      if (message.includes('Position side not match')) {
        return 'Position mode mismatch. Please check if Hedge Mode is enabled.';
      }
      if (message.includes('would trigger immediately')) {
        return 'Order would trigger immediately. Please adjust the trigger price.';
      }
      if (message.includes('Invalid symbol')) {
        return 'Invalid symbol.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
