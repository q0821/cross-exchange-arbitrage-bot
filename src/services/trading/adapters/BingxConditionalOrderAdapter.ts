/**
 * BingX Conditional Order Adapter
 *
 * BingX 永續合約條件單適配器
 * Feature: 043-bingx-integration
 *
 * 注意：BingX 不支援 STOP_MARKET/TAKE_PROFIT_MARKET 訂單類型
 * 需要使用 market 訂單配合 stopLossPrice/takeProfitPrice 參數
 * 參考：https://github.com/ccxt/ccxt/issues/19773
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
      orderType: 'stopLoss',
    });
  }

  /**
   * 設定停利市價單
   */
  async setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult> {
    return this.setConditionalOrder({
      ...params,
      orderType: 'takeProfit',
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
   *
   * BingX 不支援 STOP_MARKET/TAKE_PROFIT_MARKET 訂單類型
   * 需要使用 market 訂單配合 stopLossPrice/takeProfitPrice 參數
   */
  private async setConditionalOrder(
    params: SetStopLossOrderParams & { orderType: 'stopLoss' | 'takeProfit' },
  ): Promise<SingleConditionalOrderResult> {
    const { symbol, side, quantity, triggerPrice, orderType } = params;

    try {
      const exchangeSymbol = convertSymbolForExchange(symbol, 'bingx');
      const closingSide = getClosingSide(side);
      const formattedPrice = formatPriceForExchange(triggerPrice);
      const formattedQuantity = quantity.toString();

      logger.info(
        {
          exchangeSymbol,
          orderType,
          closingSide,
          positionSide: side,
          triggerPrice: formattedPrice,
          quantity: formattedQuantity,
          isHedgeMode: this.isHedgeMode,
        },
        'Creating BingX conditional order',
      );

      // 構建訂單參數
      // BingX 使用 stopLossPrice/takeProfitPrice 而非 STOP_MARKET/TAKE_PROFIT_MARKET
      const orderParams: Record<string, any> = {
        reduceOnly: true,
      };

      // 設定停損或停利價格
      if (orderType === 'stopLoss') {
        orderParams.stopLossPrice = parseFloat(formattedPrice);
      } else {
        orderParams.takeProfitPrice = parseFloat(formattedPrice);
      }

      // Hedge Mode 需要指定 positionSide
      if (this.isHedgeMode) {
        orderParams.positionSide = side; // LONG or SHORT
      }

      // 使用 market 訂單類型
      const order = await this.ccxtExchange.createOrder(
        exchangeSymbol,
        'market',
        closingSide.toLowerCase(),
        parseFloat(formattedQuantity),
        undefined,
        orderParams,
      );

      logger.info(
        { orderId: order.id, exchangeSymbol, orderType },
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
        { error, symbol, side, orderType, triggerPrice: triggerPrice.toString() },
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
      if (message.includes('Order type not supported')) {
        return 'Order type not supported. BingX requires stopLossPrice/takeProfitPrice parameters.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
