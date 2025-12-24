/**
 * Binance Conditional Order Adapter
 *
 * Binance 期貨條件單適配器：使用 STOP_MARKET 和 TAKE_PROFIT_MARKET
 * Feature: 038-specify-scripts-bash
 *
 * API Reference: https://binance-docs.github.io/apidocs/futures/en/
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
 * Binance 條件單適配器
 */
export class BinanceConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'binance';
  private ccxtExchange: any; // CCXT Binance instance
  private isHedgeMode: boolean;
  private isPortfolioMargin: boolean;

  constructor(
    ccxtExchange: any,
    options: { isHedgeMode: boolean; isPortfolioMargin: boolean } = {
      isHedgeMode: true,
      isPortfolioMargin: false,
    },
  ) {
    this.ccxtExchange = ccxtExchange;
    this.isHedgeMode = options.isHedgeMode;
    this.isPortfolioMargin = options.isPortfolioMargin;
  }

  /**
   * 設定停損市價單
   */
  async setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult> {
    logger.info(
      {
        exchange: 'binance',
        orderType: 'stopLoss',
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity.toString(),
        triggerPrice: params.triggerPrice.toString(),
      },
      'Setting Binance stop loss order',
    );

    const result = await this.setConditionalOrder({
      ...params,
      type: 'STOP_MARKET',
    });

    logger.info(
      {
        exchange: 'binance',
        orderType: 'stopLoss',
        success: result.success,
        orderId: result.orderId,
        error: result.error,
      },
      'Binance stop loss order result',
    );

    return result;
  }

  /**
   * 設定停利市價單
   */
  async setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult> {
    logger.info(
      {
        exchange: 'binance',
        orderType: 'takeProfit',
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity.toString(),
        triggerPrice: params.triggerPrice.toString(),
      },
      'Setting Binance take profit order',
    );

    const result = await this.setConditionalOrder({
      ...params,
      type: 'TAKE_PROFIT_MARKET',
    });

    logger.info(
      {
        exchange: 'binance',
        orderType: 'takeProfit',
        success: result.success,
        orderId: result.orderId,
        error: result.error,
      },
      'Binance take profit order result',
    );

    return result;
  }

  /**
   * 取消條件單
   *
   * Portfolio Margin 使用: DELETE /papi/v1/um/conditional/order
   * 標準合約使用: DELETE /fapi/v1/order
   * 參考: https://developers.binance.com/docs/derivatives/portfolio-margin/trade/Cancel-UM-Conditional-Order
   */
  async cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      const exchangeSymbol = convertSymbolForExchange(symbol, 'binance');

      logger.info(
        { symbol: exchangeSymbol, orderId, isPortfolioMargin: this.isPortfolioMargin },
        'Canceling Binance conditional order',
      );

      if (this.isPortfolioMargin) {
        // Portfolio Margin 條件單取消 API
        const response = await this.ccxtExchange.papiDeleteUmConditionalOrder({
          symbol: exchangeSymbol,
          strategyId: orderId,
        });

        logger.info(
          { symbol: exchangeSymbol, orderId, response },
          'Binance Portfolio Margin conditional order cancelled',
        );
      } else {
        // 標準合約取消 API
        await this.ccxtExchange.fapiPrivateDeleteOrder({
          symbol: exchangeSymbol,
          orderId,
        });

        logger.info(
          { symbol: exchangeSymbol, orderId },
          'Binance standard conditional order cancelled',
        );
      }

      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel Binance conditional order');
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
      const exchangeSymbol = convertSymbolForExchange(symbol, 'binance');
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
          isPortfolioMargin: this.isPortfolioMargin,
        },
        'Creating Binance conditional order',
      );

      // 構建訂單參數
      const orderParams: Record<string, any> = {
        stopPrice: formattedPrice,
        reduceOnly: !this.isHedgeMode, // One-way mode 需要 reduceOnly
        workingType: 'MARK_PRICE', // 使用標記價格觸發
      };

      // Hedge Mode 需要指定 positionSide
      if (this.isHedgeMode) {
        orderParams.positionSide = side; // LONG or SHORT
      }

      // Portfolio Margin 使用不同的 API
      if (this.isPortfolioMargin) {
        orderParams.portfolioMargin = true;
      }

      const order = await this.ccxtExchange.createOrder(
        exchangeSymbol,
        type.toLowerCase(), // 'stop_market' or 'take_profit_market'
        closingSide.toLowerCase(), // 'buy' or 'sell'
        parseFloat(formattedQuantity),
        undefined, // price (市價單不需要)
        orderParams,
      );

      logger.info(
        { orderId: order.id, exchangeSymbol, type },
        'Binance conditional order created successfully',
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
        'Failed to create Binance conditional order',
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
      // Binance 特定錯誤碼處理
      const message = error.message;

      if (message.includes('-4061')) {
        return 'Position mode mismatch. Please check if Hedge Mode is enabled.';
      }
      if (message.includes('-2021')) {
        return 'Order would trigger immediately. Please adjust the trigger price.';
      }
      if (message.includes('-4015')) {
        return 'Invalid order type for symbol.';
      }
      if (message.includes('-1121')) {
        return 'Invalid symbol.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
