/**
 * Conditional Order Service
 *
 * 條件單設定服務：統一管理停損停利訂單的設定
 * Feature: 038-specify-scripts-bash
 */

import Decimal from 'decimal.js';
import { logger } from '../../lib/logger';
import {
  calculateTriggerPrices,
  formatPriceForExchange,
  isStopLossPriceValid,
  isTakeProfitPriceValid,
} from '../../lib/conditional-order-calculator';
import type {
  SupportedExchange,
  TradeSide,
  ConditionalOrderStatus,
  ConditionalOrderResult,
  BilateralConditionalOrderResult,
  SingleConditionalOrderResult,
} from '../../types/trading';
import { ConditionalOrderAdapterFactory } from './ConditionalOrderAdapterFactory';

/**
 * 設定條件單的參數
 */
export interface SetConditionalOrdersParams {
  positionId: string;
  symbol: string;
  // Long 倉位
  longExchange: SupportedExchange;
  longEntryPrice: Decimal;
  longQuantity: Decimal;
  // Short 倉位
  shortExchange: SupportedExchange;
  shortEntryPrice: Decimal;
  shortQuantity: Decimal;
  // 停損停利設定
  stopLossEnabled: boolean;
  stopLossPercent?: number;
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
  // 用戶認證
  userId: string;
  // 當前市場價格（用於驗證條件單是否可能立即觸發）
  longCurrentPrice?: Decimal;
  shortCurrentPrice?: Decimal;
}

/**
 * 條件單設定服務
 */
export class ConditionalOrderService {
  private adapterFactory: ConditionalOrderAdapterFactory;

  constructor(adapterFactory?: ConditionalOrderAdapterFactory) {
    this.adapterFactory = adapterFactory || new ConditionalOrderAdapterFactory();
  }

  /**
   * 設定雙邊倉位的停損停利條件單
   */
  async setConditionalOrders(
    params: SetConditionalOrdersParams,
  ): Promise<BilateralConditionalOrderResult> {
    const {
      positionId,
      symbol,
      longExchange,
      longEntryPrice,
      longQuantity,
      shortExchange,
      shortEntryPrice,
      shortQuantity,
      stopLossEnabled,
      stopLossPercent,
      takeProfitEnabled,
      takeProfitPercent,
      userId,
      longCurrentPrice,
      shortCurrentPrice,
    } = params;

    logger.info(
      {
        positionId,
        symbol,
        longExchange,
        shortExchange,
        stopLossEnabled,
        stopLossPercent,
        takeProfitEnabled,
        takeProfitPercent,
      },
      'Setting conditional orders for position',
    );

    const errors: string[] = [];

    // 計算 Long 倉位觸發價格
    const longTriggerPrices = calculateTriggerPrices({
      entryPrice: longEntryPrice,
      side: 'LONG',
      stopLossPercent: stopLossEnabled ? stopLossPercent : undefined,
      takeProfitPercent: takeProfitEnabled ? takeProfitPercent : undefined,
    });

    // 計算 Short 倉位觸發價格
    const shortTriggerPrices = calculateTriggerPrices({
      entryPrice: shortEntryPrice,
      side: 'SHORT',
      stopLossPercent: stopLossEnabled ? stopLossPercent : undefined,
      takeProfitPercent: takeProfitEnabled ? takeProfitPercent : undefined,
    });

    // 價格驗證：檢查條件單是否可能立即觸發
    this.validatePrices({
      side: 'LONG',
      currentPrice: longCurrentPrice,
      stopLossPrice: longTriggerPrices.stopLossPrice,
      takeProfitPrice: longTriggerPrices.takeProfitPrice,
      stopLossEnabled,
      takeProfitEnabled,
    });

    this.validatePrices({
      side: 'SHORT',
      currentPrice: shortCurrentPrice,
      stopLossPrice: shortTriggerPrices.stopLossPrice,
      takeProfitPrice: shortTriggerPrices.takeProfitPrice,
      stopLossEnabled,
      takeProfitEnabled,
    });

    // 設定 Long 倉位條件單
    const longResult = await this.setConditionalOrdersForSide({
      positionId,
      symbol,
      exchange: longExchange,
      side: 'LONG',
      quantity: longQuantity,
      entryPrice: longEntryPrice,
      stopLossPrice: longTriggerPrices.stopLossPrice,
      takeProfitPrice: longTriggerPrices.takeProfitPrice,
      stopLossEnabled,
      takeProfitEnabled,
      userId,
    });

    if (longResult.stopLoss?.error) {
      errors.push(`Long 停損設定失敗 (${longExchange}): ${longResult.stopLoss.error}`);
    }
    if (longResult.takeProfit?.error) {
      errors.push(`Long 停利設定失敗 (${longExchange}): ${longResult.takeProfit.error}`);
    }

    // 設定 Short 倉位條件單
    const shortResult = await this.setConditionalOrdersForSide({
      positionId,
      symbol,
      exchange: shortExchange,
      side: 'SHORT',
      quantity: shortQuantity,
      entryPrice: shortEntryPrice,
      stopLossPrice: shortTriggerPrices.stopLossPrice,
      takeProfitPrice: shortTriggerPrices.takeProfitPrice,
      stopLossEnabled,
      takeProfitEnabled,
      userId,
    });

    if (shortResult.stopLoss?.error) {
      errors.push(`Short 停損設定失敗 (${shortExchange}): ${shortResult.stopLoss.error}`);
    }
    if (shortResult.takeProfit?.error) {
      errors.push(`Short 停利設定失敗 (${shortExchange}): ${shortResult.takeProfit.error}`);
    }

    // 計算整體狀態
    const overallStatus = this.calculateOverallStatus(longResult, shortResult, {
      stopLossEnabled,
      takeProfitEnabled,
    });

    logger.info(
      {
        positionId,
        overallStatus,
        errors,
        longStopLossOrderId: longResult.stopLoss?.orderId,
        longTakeProfitOrderId: longResult.takeProfit?.orderId,
        shortStopLossOrderId: shortResult.stopLoss?.orderId,
        shortTakeProfitOrderId: shortResult.takeProfit?.orderId,
      },
      'Conditional orders setting completed',
    );

    return {
      longResult,
      shortResult,
      overallStatus,
      errors,
    };
  }

  /**
   * 為單一倉位設定條件單
   */
  private async setConditionalOrdersForSide(params: {
    positionId: string;
    symbol: string;
    exchange: SupportedExchange;
    side: TradeSide;
    quantity: Decimal;
    entryPrice: Decimal;
    stopLossPrice?: Decimal;
    takeProfitPrice?: Decimal;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
    userId: string;
  }): Promise<ConditionalOrderResult> {
    const {
      positionId,
      symbol,
      exchange,
      side,
      quantity,
      // entryPrice is already used in the caller to calculate trigger prices
      stopLossPrice,
      takeProfitPrice,
      stopLossEnabled,
      takeProfitEnabled,
      userId,
    } = params;

    const result: ConditionalOrderResult = {
      exchange,
      side,
    };

    try {
      const adapter = await this.adapterFactory.getAdapter(exchange, userId);

      // 設定停損單
      if (stopLossEnabled && stopLossPrice) {
        logger.info(
          {
            positionId,
            exchange,
            side,
            stopLossPrice: formatPriceForExchange(stopLossPrice),
          },
          'Setting stop loss order',
        );

        result.stopLoss = await adapter.setStopLossOrder({
          symbol,
          side,
          quantity,
          triggerPrice: stopLossPrice,
        });
      }

      // 設定停利單
      if (takeProfitEnabled && takeProfitPrice) {
        logger.info(
          {
            positionId,
            exchange,
            side,
            takeProfitPrice: formatPriceForExchange(takeProfitPrice),
          },
          'Setting take profit order',
        );

        result.takeProfit = await adapter.setTakeProfitOrder({
          symbol,
          side,
          quantity,
          triggerPrice: takeProfitPrice,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error, positionId, exchange, side },
        'Failed to set conditional orders',
      );

      // 如果整個 adapter 失敗，設定兩邊都失敗
      if (stopLossEnabled && !result.stopLoss) {
        result.stopLoss = { success: false, error: errorMessage };
      }
      if (takeProfitEnabled && !result.takeProfit) {
        result.takeProfit = { success: false, error: errorMessage };
      }
    }

    return result;
  }

  /**
   * 驗證條件單價格是否可能立即觸發
   * 如果可能立即觸發，記錄警告但仍繼續設定
   */
  private validatePrices(params: {
    side: TradeSide;
    currentPrice?: Decimal;
    stopLossPrice?: Decimal;
    takeProfitPrice?: Decimal;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
  }): void {
    const { side, currentPrice, stopLossPrice, takeProfitPrice, stopLossEnabled, takeProfitEnabled } = params;

    // 如果沒有提供當前價格，跳過驗證
    if (!currentPrice) {
      return;
    }

    // 驗證停損價格
    if (stopLossEnabled && stopLossPrice) {
      if (!isStopLossPriceValid(stopLossPrice, currentPrice, side)) {
        logger.warn(
          {
            side,
            stopLossPrice: formatPriceForExchange(stopLossPrice),
            currentPrice: formatPriceForExchange(currentPrice),
          },
          'Stop loss price may trigger immediately',
        );
      }
    }

    // 驗證停利價格
    if (takeProfitEnabled && takeProfitPrice) {
      if (!isTakeProfitPriceValid(takeProfitPrice, currentPrice, side)) {
        logger.warn(
          {
            side,
            takeProfitPrice: formatPriceForExchange(takeProfitPrice),
            currentPrice: formatPriceForExchange(currentPrice),
          },
          'Take profit price may trigger immediately',
        );
      }
    }
  }

  /**
   * 計算整體條件單狀態
   */
  private calculateOverallStatus(
    longResult: ConditionalOrderResult,
    shortResult: ConditionalOrderResult,
    config: { stopLossEnabled: boolean; takeProfitEnabled: boolean },
  ): ConditionalOrderStatus {
    const { stopLossEnabled, takeProfitEnabled } = config;

    // 如果沒有啟用任何條件單，返回 PENDING
    if (!stopLossEnabled && !takeProfitEnabled) {
      return 'PENDING';
    }

    const results: SingleConditionalOrderResult[] = [];

    if (stopLossEnabled) {
      if (longResult.stopLoss) results.push(longResult.stopLoss);
      if (shortResult.stopLoss) results.push(shortResult.stopLoss);
    }

    if (takeProfitEnabled) {
      if (longResult.takeProfit) results.push(longResult.takeProfit);
      if (shortResult.takeProfit) results.push(shortResult.takeProfit);
    }

    if (results.length === 0) {
      return 'PENDING';
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    if (successCount === totalCount) {
      return 'SET';
    } else if (successCount === 0) {
      return 'FAILED';
    } else {
      return 'PARTIAL';
    }
  }
}

// Export singleton instance
export const conditionalOrderService = new ConditionalOrderService();
