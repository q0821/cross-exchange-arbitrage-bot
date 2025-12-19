/**
 * Gate.io Conditional Order Adapter
 *
 * Gate.io 期貨條件單適配器：使用 price_orders API
 * Feature: 038-specify-scripts-bash
 *
 * API Reference: https://www.gate.io/docs/developers/futures/en/
 */

import { logger } from '../../../lib/logger';
import { formatPriceForExchange } from '../../../lib/conditional-order-calculator';
import type { SingleConditionalOrderResult, TradeSide } from '../../../types/trading';
import type {
  ConditionalOrderAdapter,
  SetStopLossOrderParams,
  SetTakeProfitOrderParams,
} from './ConditionalOrderAdapter';
import { convertSymbolForExchange } from './ConditionalOrderAdapter';

/**
 * Gate.io 條件單適配器
 */
export class GateioConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'gateio';
  private ccxtExchange: any; // CCXT Gate.io instance

  constructor(ccxtExchange: any) {
    this.ccxtExchange = ccxtExchange;
  }

  /**
   * 設定停損市價單
   */
  async setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult> {
    return this.setConditionalOrder({
      ...params,
      type: 'stopLoss',
    });
  }

  /**
   * 設定停利市價單
   */
  async setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult> {
    return this.setConditionalOrder({
      ...params,
      type: 'takeProfit',
    });
  }

  /**
   * 取消條件單
   */
  async cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      // Gate.io 使用 DELETE /futures/usdt/price_orders/{order_id}
      await this.ccxtExchange.privateFuturesDeletePriceOrdersOrderId({
        order_id: orderId,
        settle: 'usdt',
      });

      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel Gate.io conditional order');
      return false;
    }
  }

  /**
   * 設定條件單（內部方法）
   */
  private async setConditionalOrder(
    params: SetStopLossOrderParams & { type: 'stopLoss' | 'takeProfit' },
  ): Promise<SingleConditionalOrderResult> {
    const { symbol, side, quantity, triggerPrice, type } = params;

    try {
      const exchangeSymbol = convertSymbolForExchange(symbol, 'gateio');
      const formattedPrice = formatPriceForExchange(triggerPrice);

      // Gate.io 使用正負數表示方向
      // 正數 = 買入/做多, 負數 = 賣出/做空
      // 平倉時: Long 平倉 = 負數 (賣出), Short 平倉 = 正數 (買入)
      const sizeValue = side === 'LONG'
        ? quantity.negated() // Long 平倉需要賣出，用負數
        : quantity; // Short 平倉需要買入，用正數

      // 決定觸發規則
      // Long 停損: 價格下跌到目標 → rule: 2 (<=)
      // Long 停利: 價格上漲到目標 → rule: 1 (>=)
      // Short 停損: 價格上漲到目標 → rule: 1 (>=)
      // Short 停利: 價格下跌到目標 → rule: 2 (<=)
      const triggerRule = this.getTriggerRule(side, type);

      logger.info(
        {
          exchangeSymbol,
          type,
          side,
          size: sizeValue.toString(),
          triggerPrice: formattedPrice,
          triggerRule,
        },
        'Creating Gate.io conditional order',
      );

      // 構建 Price Order 參數
      const orderParams = {
        settle: 'usdt',
        contract: exchangeSymbol,
        size: parseInt(sizeValue.toString(), 10), // Gate.io 使用整數
        price: '0', // 市價單
        trigger: {
          price: formattedPrice,
          rule: triggerRule, // 1: >=, 2: <=
          price_type: 1, // 1: 標記價格, 0: 最新價格
        },
        initial: {
          size: parseInt(sizeValue.toString(), 10),
          price: '0', // 市價
          tif: 'ioc', // Immediate or Cancel
          reduce_only: true,
        },
      };

      // 使用 CCXT 的原生 API 調用
      const response = await this.ccxtExchange.privateFuturesPostPriceOrders(orderParams);

      const orderId = response.id?.toString();

      if (!orderId) {
        throw new Error('No order ID returned from Gate.io');
      }

      logger.info(
        { orderId, exchangeSymbol, type },
        'Gate.io conditional order created successfully',
      );

      return {
        success: true,
        orderId,
        triggerPrice,
      };
    } catch (error) {
      const errorMessage = this.parseError(error);
      logger.error(
        { error, symbol, side, type, triggerPrice: triggerPrice.toString() },
        'Failed to create Gate.io conditional order',
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 獲取觸發規則
   */
  private getTriggerRule(side: TradeSide, type: 'stopLoss' | 'takeProfit'): number {
    if (side === 'LONG') {
      // Long 停損: 價格下跌 → <=
      // Long 停利: 價格上漲 → >=
      return type === 'stopLoss' ? 2 : 1;
    } else {
      // Short 停損: 價格上漲 → >=
      // Short 停利: 價格下跌 → <=
      return type === 'stopLoss' ? 1 : 2;
    }
  }

  /**
   * 解析錯誤訊息
   */
  private parseError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message;

      // Gate.io 特定錯誤處理
      if (message.includes('INVALID_PARAM')) {
        return 'Invalid parameter. Please check the order details.';
      }
      if (message.includes('POSITION_NOT_FOUND')) {
        return 'Position not found.';
      }
      if (message.includes('INSUFFICIENT_BALANCE')) {
        return 'Insufficient balance.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
