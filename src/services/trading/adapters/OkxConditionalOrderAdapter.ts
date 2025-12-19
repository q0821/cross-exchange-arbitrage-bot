/**
 * OKX Conditional Order Adapter
 *
 * OKX 合約條件單適配器：使用 order-algo API
 * Feature: 038-specify-scripts-bash
 *
 * API Reference: https://www.okx.com/docs-v5/en/
 *
 * 重要限制：
 * - Net Mode 下同時發送 TP 和 SL 時，僅 SL 執行，TP 被忽略
 * - 解決方案：分開發送兩個訂單
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
 * OKX 條件單適配器
 */
export class OkxConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'okx';
  private ccxtExchange: any; // CCXT OKX instance
  private positionMode: 'long_short_mode' | 'net_mode';

  constructor(
    ccxtExchange: any,
    options: { positionMode?: 'long_short_mode' | 'net_mode' } = {},
  ) {
    this.ccxtExchange = ccxtExchange;
    this.positionMode = options.positionMode || 'long_short_mode';
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
      const exchangeSymbol = convertSymbolForExchange(symbol, 'okx');

      // OKX 使用 cancelAlgoOrder API
      await this.ccxtExchange.privatePostTradeCancelAlgos({
        algoId: orderId,
        instId: exchangeSymbol,
      });

      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel OKX conditional order');
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
      const exchangeSymbol = convertSymbolForExchange(symbol, 'okx');
      const closingSide = getClosingSide(side);
      const formattedPrice = formatPriceForExchange(triggerPrice);
      const formattedQuantity = quantity.toString();

      // 確定 posSide
      let posSide: string;
      if (this.positionMode === 'long_short_mode') {
        posSide = side.toLowerCase(); // 'long' or 'short'
      } else {
        posSide = 'net';
      }

      logger.info(
        {
          exchangeSymbol,
          type,
          closingSide,
          posSide,
          triggerPrice: formattedPrice,
          quantity: formattedQuantity,
          positionMode: this.positionMode,
        },
        'Creating OKX conditional order',
      );

      // 構建 Algo Order 參數
      const algoParams: Record<string, any> = {
        instId: exchangeSymbol,
        tdMode: 'cross', // 全倉模式
        side: closingSide.toLowerCase(), // 'buy' or 'sell'
        ordType: 'conditional',
        sz: formattedQuantity,
        posSide,
        reduceOnly: true,
      };

      // 根據類型設定觸發價格
      if (type === 'stopLoss') {
        algoParams.slTriggerPx = formattedPrice;
        algoParams.slOrdPx = '-1'; // -1 表示市價
        algoParams.slTriggerPxType = 'mark'; // 使用標記價格
      } else {
        algoParams.tpTriggerPx = formattedPrice;
        algoParams.tpOrdPx = '-1'; // -1 表示市價
        algoParams.tpTriggerPxType = 'mark'; // 使用標記價格
      }

      // 使用 CCXT 的原生 API 調用
      const response = await this.ccxtExchange.privatePostTradeOrderAlgo(algoParams);

      // 解析回應
      if (response.code !== '0') {
        throw new Error(`OKX API Error: ${response.msg} (code: ${response.code})`);
      }

      const algoId = response.data?.[0]?.algoId;

      if (!algoId) {
        throw new Error('No algoId returned from OKX');
      }

      logger.info(
        { algoId, exchangeSymbol, type },
        'OKX conditional order created successfully',
      );

      return {
        success: true,
        orderId: algoId,
        triggerPrice,
      };
    } catch (error) {
      const errorMessage = this.parseError(error);
      logger.error(
        { error, symbol, side, type, triggerPrice: triggerPrice.toString() },
        'Failed to create OKX conditional order',
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

      // OKX 特定錯誤處理
      if (message.includes('51006')) {
        return 'Position does not exist.';
      }
      if (message.includes('51008')) {
        return 'Insufficient position balance.';
      }
      if (message.includes('51016')) {
        return 'Invalid position side.';
      }
      if (message.includes('51009')) {
        return 'Order price is out of range.';
      }

      return message;
    }
    return 'Unknown error';
  }
}
