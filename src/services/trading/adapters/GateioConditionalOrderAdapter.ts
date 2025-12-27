/**
 * Gate.io Conditional Order Adapter
 *
 * Gate.io 期貨條件單適配器：使用 CCXT 統一 API
 * Feature: 038-specify-scripts-bash
 * Updated: 040-fix-conditional-orders
 *
 * API Reference: https://www.gate.io/docs/developers/futures/en/
 *
 * 修正說明：
 * - 改用 CCXT 統一 createOrder API 配合 triggerPrice/stopPrice
 * - 避免直接使用 privateFuturesPostSettlePriceOrders 的參數格式問題
 * - 參考：https://github.com/ccxt/ccxt/issues/13801
 */

import { Decimal } from 'decimal.js';
import { logger } from '../../../lib/logger';
import type { SingleConditionalOrderResult } from '../../../types/trading';
import type {
  ConditionalOrderAdapter,
  SetStopLossOrderParams,
  SetTakeProfitOrderParams,
} from './ConditionalOrderAdapter';

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
      // 使用 Gate.io 原生取消 Price Order API
      // DELETE /futures/{settle}/price_orders/{order_id}
      await this.ccxtExchange.privateFuturesDeleteSettlePriceOrdersOrderId({
        settle: 'usdt',
        order_id: orderId,
      });

      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel Gate.io conditional order');
      return false;
    }
  }

  /**
   * 轉換 symbol 為 Gate.io 合約格式
   * e.g., BTCUSDT -> BTC_USDT
   */
  private convertToGateContract(symbol: string): string {
    // 如果已經是 Gate.io 格式，直接返回
    if (symbol.includes('_')) {
      return symbol;
    }

    // 處理 CCXT 格式 BTC/USDT:USDT
    if (symbol.includes('/')) {
      const base = symbol.split('/')[0];
      const quote = symbol.split('/')[1]?.split(':')[0] || 'USDT';
      return `${base}_${quote}`;
    }

    // 處理純格式 BTCUSDT
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}_${quote}`;
      }
    }

    return `${symbol}_USDT`;
  }

  /**
   * 獲取觸發規則
   */
  private getTriggerRule(side: 'LONG' | 'SHORT', type: 'stopLoss' | 'takeProfit'): number {
    if (side === 'LONG') {
      // Long 停損: 價格下跌 → <=  (rule: 2)
      // Long 停利: 價格上漲 → >=  (rule: 1)
      return type === 'stopLoss' ? 2 : 1;
    } else {
      // Short 停損: 價格上漲 → >= (rule: 1)
      // Short 停利: 價格下跌 → <= (rule: 2)
      return type === 'stopLoss' ? 1 : 2;
    }
  }

  /**
   * 根據交易對精度格式化價格
   * Gate.io 要求價格必須是 tick size 的整數倍
   */
  private async formatPriceWithPrecision(symbol: string, price: Decimal): Promise<string> {
    try {
      // 確保市場資訊已載入
      if (!this.ccxtExchange.markets) {
        await this.ccxtExchange.loadMarkets();
      }

      // 嘗試找到對應的市場
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);
      const market = this.ccxtExchange.markets[ccxtSymbol];

      if (market && market.precision && market.precision.price !== undefined) {
        // 使用 CCXT 的 priceToPrecision 方法
        const formattedPrice = this.ccxtExchange.priceToPrecision(ccxtSymbol, price.toNumber());
        logger.debug(
          { symbol, ccxtSymbol, originalPrice: price.toString(), formattedPrice, precision: market.precision.price },
          'Formatted price with market precision',
        );
        return formattedPrice;
      }

      // 如果找不到市場精度，使用保守的 8 位小數
      logger.warn({ symbol }, 'Market precision not found, using default 8 decimals');
      return price.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toString();
    } catch (error) {
      logger.warn({ symbol, error }, 'Failed to get market precision, using default');
      return price.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toString();
    }
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
   * 設定條件單（內部方法）
   *
   * 使用 Gate.io 原生 Price Order API
   * 參考：https://www.gate.io/docs/developers/futures/en/#create-a-price-triggered-order
   */
  private async setConditionalOrder(
    params: SetStopLossOrderParams & { type: 'stopLoss' | 'takeProfit' },
  ): Promise<SingleConditionalOrderResult> {
    const { symbol, side, quantity, triggerPrice, type } = params;

    const contract = this.convertToGateContract(symbol);
    // 使用交易對精度格式化價格，確保是 tick size 的整數倍
    const formattedPrice = await this.formatPriceWithPrecision(symbol, triggerPrice);

    // Gate.io 合約用整數張數，需要轉換
    const sizeAbs = quantity.abs().toNumber();
    const sizeInt = Math.max(1, Math.round(sizeAbs));
    // Long 平倉用負數 (賣出), Short 平倉用正數 (買入)
    const finalSize = side === 'LONG' ? -sizeInt : sizeInt;

    // 決定觸發規則
    const triggerRule = this.getTriggerRule(side, type);

    try {
      logger.info(
        {
          originalQuantity: quantity.toString(),
          sizeAbs,
          sizeInt,
          finalSize,
          side,
        },
        'Gate.io contract size conversion',
      );

      logger.info(
        {
          contract,
          type,
          side,
          size: finalSize,
          triggerPrice: formattedPrice,
          triggerRule,
        },
        'Creating Gate.io conditional order via native API',
      );

      // 構建 Gate.io Price Order 參數
      // 參考: https://github.com/gateio/gateapi-python/blob/master/docs/FuturesPriceTriggeredOrder.md
      // 需要使用 initial 和 trigger 兩個物件
      const orderParams = {
        settle: 'usdt',
        initial: {
          contract,
          size: finalSize,
          price: '0', // 市價單
          tif: 'ioc', // Immediate or Cancel
          reduce_only: true,
        },
        trigger: {
          strategy_type: 0, // 0: by price
          price_type: 1, // 1: mark price (較穩定)
          price: formattedPrice,
          rule: triggerRule, // 1: >=, 2: <=
          expiration: 86400, // 24 小時有效期
        },
      };

      logger.debug({ orderParams }, 'Gate.io price order params');

      // 使用 CCXT 原生 API
      const response = await this.ccxtExchange.privateFuturesPostSettlePriceOrders(orderParams);

      const orderId = response?.id?.toString();

      if (!orderId) {
        throw new Error('No order ID returned from Gate.io');
      }

      logger.info(
        { orderId, contract, type },
        'Gate.io conditional order created successfully',
      );

      return {
        success: true,
        orderId,
        triggerPrice,
      };
    } catch (error) {
      // 取得完整錯誤訊息
      const fullError = error instanceof Error ? error.message : String(error);
      const errorMessage = this.parseError(error);

      logger.error(
        {
          error: fullError,
          symbol,
          side,
          type,
          triggerPrice: triggerPrice.toString(),
          orderParams: {
            contract,
            size: finalSize,
            triggerRule,
          },
        },
        'Failed to create Gate.io conditional order',
      );

      return {
        success: false,
        error: errorMessage.includes('Invalid parameter') ? fullError : errorMessage,
      };
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
