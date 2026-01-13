/**
 * OrderPriceFetcher
 *
 * 負責獲取訂單成交價格，包含多層 fallback 機制
 *
 * Feature: 062-refactor-trading-srp
 */

import { logger } from '@/lib/logger';
import type { FetchPriceResult, IOrderPriceFetcher } from '@/types/trading';

/**
 * 訂單價格獲取器
 *
 * 從 PositionOrchestrator.createCcxtTraderAsync 提取
 * 原始位置：src/services/trading/PositionOrchestrator.ts:922-976
 *
 * Fallback 機制：
 * 1. order.average || order.price（立即取得）
 * 2. fetchOrder API（等待 500ms 後查詢）
 * 3. fetchMyTrades API（計算加權平均價格）
 * 4. 全部失敗時回傳 price: 0
 */
export class OrderPriceFetcher implements IOrderPriceFetcher {
  /**
   * 獲取訂單成交價格
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @param orderId - 訂單 ID
   * @param symbol - 交易對符號
   * @param initialPrice - 初始價格（來自 order.average || order.price）
   * @returns 價格獲取結果（含來源）
   */
  async fetch(
    ccxtExchange: unknown,
    orderId: string,
    symbol: string,
    initialPrice?: number,
  ): Promise<FetchPriceResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exchange = ccxtExchange as any;

    // 1. 如果已有價格，直接回傳
    if (initialPrice && initialPrice > 0) {
      return { price: initialPrice, source: 'order' };
    }

    logger.info(
      { symbol, orderId },
      'Price not in order response, fetching order details',
    );

    // 2. 嘗試 fetchOrder
    let price = await this.tryFetchOrder(exchange, orderId, symbol);
    if (price > 0) {
      return { price, source: 'fetchOrder' };
    }

    // 3. 嘗試 fetchMyTrades
    price = await this.tryFetchMyTrades(exchange, orderId, symbol);
    if (price > 0) {
      return { price, source: 'fetchMyTrades' };
    }

    // 4. 全部失敗，回傳 0
    logger.warn(
      { symbol, orderId },
      'All price fetch attempts failed, returning 0',
    );
    return { price: 0, source: 'order' };
  }

  /**
   * 嘗試使用 fetchOrder 獲取價格
   *
   * @param exchange - CCXT 交易所實例
   * @param orderId - 訂單 ID
   * @param symbol - 交易對符號
   * @returns 價格（失敗時回傳 0）
   */
  private async tryFetchOrder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exchange: any,
    orderId: string,
    symbol: string,
  ): Promise<number> {
    try {
      // 等待短暫時間讓訂單結算
      await new Promise(resolve => setTimeout(resolve, 500));
      const fetchedOrder = await exchange.fetchOrder(orderId, symbol);
      const price = fetchedOrder.average || fetchedOrder.price || 0;

      if (price > 0) {
        logger.info(
          { symbol, orderId, price },
          'Got price from fetched order',
        );
      }

      return price;
    } catch (fetchError) {
      logger.warn(
        { symbol, orderId, error: fetchError },
        'Failed to fetch order details for price',
      );
      return 0;
    }
  }

  /**
   * 嘗試使用 fetchMyTrades 獲取價格
   *
   * 計算與此訂單相關成交記錄的加權平均價格
   *
   * @param exchange - CCXT 交易所實例
   * @param orderId - 訂單 ID
   * @param symbol - 交易對符號
   * @returns 價格（失敗時回傳 0）
   */
  private async tryFetchMyTrades(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exchange: any,
    orderId: string,
    symbol: string,
  ): Promise<number> {
    logger.info(
      { symbol, orderId },
      'Price still 0 after fetchOrder, trying fetchMyTrades',
    );

    try {
      const trades = await exchange.fetchMyTrades(symbol, undefined, 10);

      // 找到與此訂單相關的成交記錄
      const orderTrades = trades.filter((t: { order?: string }) => t.order === orderId);

      if (orderTrades.length === 0) {
        return 0;
      }

      // 計算加權平均價格
      let totalCost = 0;
      let totalAmount = 0;

      for (const t of orderTrades) {
        totalCost += (t.price || 0) * (t.amount || 0);
        totalAmount += t.amount || 0;
      }

      if (totalAmount > 0) {
        const price = totalCost / totalAmount;
        logger.info(
          { symbol, orderId, price, tradesCount: orderTrades.length },
          'Got price from fetchMyTrades',
        );
        return price;
      }

      return 0;
    } catch (tradesError) {
      logger.warn(
        { symbol, orderId, error: tradesError },
        'Failed to fetch trades for price, using 0',
      );
      return 0;
    }
  }
}

/**
 * 建立 OrderPriceFetcher 實例
 */
export function createOrderPriceFetcher(): IOrderPriceFetcher {
  return new OrderPriceFetcher();
}
