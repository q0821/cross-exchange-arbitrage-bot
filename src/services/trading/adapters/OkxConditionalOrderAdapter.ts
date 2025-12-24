/**
 * OKX Conditional Order Adapter
 *
 * OKX 合約條件單適配器：使用 CCXT 統一 API
 * Feature: 038-specify-scripts-bash
 * Updated: 040-fix-conditional-orders
 *
 * API Reference: https://www.okx.com/docs-v5/en/
 *
 * 重要限制：
 * - Net Mode 下同時發送 TP 和 SL 時，僅 SL 執行，TP 被忽略
 * - 解決方案：分開發送兩個訂單
 *
 * 修正說明：
 * - 改用 CCXT 統一 createOrder API 配合 triggerPrice 和 reduceOnly
 * - 避免直接使用 privatePostTradeOrderAlgo 的參數格式問題
 */

import { logger } from '../../../lib/logger';
import { formatPriceForExchange } from '../../../lib/conditional-order-calculator';
import type { SingleConditionalOrderResult } from '../../../types/trading';
import type {
  ConditionalOrderAdapter,
  SetStopLossOrderParams,
  SetTakeProfitOrderParams,
} from './ConditionalOrderAdapter';
import { getClosingSide } from './ConditionalOrderAdapter';

/**
 * OKX 條件單適配器
 */
export class OkxConditionalOrderAdapter implements ConditionalOrderAdapter {
  readonly exchangeName = 'okx';
  private ccxtExchange: any; // CCXT OKX instance
  private positionMode: 'long_short_mode' | 'net_mode';
  private marketsLoaded: boolean = false;

  constructor(
    ccxtExchange: any,
    options: { positionMode?: 'long_short_mode' | 'net_mode' } = {},
  ) {
    this.ccxtExchange = ccxtExchange;
    this.positionMode = options.positionMode || 'long_short_mode';
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
   */
  private convertToContracts(ccxtSymbol: string, quantity: number): number {
    const market = this.ccxtExchange.markets[ccxtSymbol];
    const contractSize = market?.contractSize || 1;

    if (contractSize !== 1) {
      const contracts = quantity / contractSize;
      logger.info(
        { symbol: ccxtSymbol, originalQuantity: quantity, contractSize, contracts },
        'OKX: Converting quantity to contracts',
      );
      return contracts;
    }
    return quantity;
  }

  /**
   * 設定停損市價單
   */
  async setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult> {
    logger.info(
      {
        exchange: 'okx',
        orderType: 'stopLoss',
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity.toString(),
        triggerPrice: params.triggerPrice.toString(),
        positionMode: this.positionMode,
      },
      'Setting OKX stop loss order',
    );

    const result = await this.setConditionalOrder({
      ...params,
      type: 'stopLoss',
    });

    logger.info(
      {
        exchange: 'okx',
        orderType: 'stopLoss',
        success: result.success,
        orderId: result.orderId,
        error: result.error,
      },
      'OKX stop loss order result',
    );

    return result;
  }

  /**
   * 設定停利市價單
   */
  async setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult> {
    logger.info(
      {
        exchange: 'okx',
        orderType: 'takeProfit',
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity.toString(),
        triggerPrice: params.triggerPrice.toString(),
        positionMode: this.positionMode,
      },
      'Setting OKX take profit order',
    );

    const result = await this.setConditionalOrder({
      ...params,
      type: 'takeProfit',
    });

    logger.info(
      {
        exchange: 'okx',
        orderType: 'takeProfit',
        success: result.success,
        orderId: result.orderId,
        error: result.error,
      },
      'OKX take profit order result',
    );

    return result;
  }

  /**
   * 取消條件單
   *
   * OKX cancel-algos API 需要傳入陣列格式
   * 參考: https://www.okx.com/docs-v5/en/#order-book-trading-algo-trading-post-cancel-algo-order
   */
  async cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      const instId = this.convertToOkxInstId(symbol);

      logger.info(
        { instId, algoId: orderId },
        'Canceling OKX conditional order',
      );

      // OKX cancel-algos API 需要傳入陣列格式
      const response = await this.ccxtExchange.privatePostTradeCancelAlgos([
        {
          algoId: orderId,
          instId,
        },
      ]);

      if (response.code !== '0') {
        const errorMsg = response.data?.[0]?.sMsg || response.msg || 'Unknown error';
        throw new Error(`OKX cancel error: ${errorMsg} (code: ${response.code})`);
      }

      logger.info(
        { instId, algoId: orderId },
        'OKX conditional order cancelled successfully',
      );

      return true;
    } catch (error) {
      logger.error({ error, symbol, orderId }, 'Failed to cancel OKX conditional order');
      return false;
    }
  }

  /**
   * 設定條件單（內部方法）
   *
   * 使用 OKX 原生 Algo Order API (ordType: 'trigger')
   * 參考: https://www.okx.com/docs-v5/en/#order-book-trading-algo-trading-post-place-algo-order
   */
  private async setConditionalOrder(
    params: SetStopLossOrderParams & { type: 'stopLoss' | 'takeProfit' },
  ): Promise<SingleConditionalOrderResult> {
    const { symbol, side, quantity, triggerPrice, type } = params;

    try {
      // 確保市場資料已載入
      await this.ensureMarketsLoaded();

      // 轉換為 OKX 格式: BTC-USDT-SWAP
      const instId = this.convertToOkxInstId(symbol);
      const closingSide = getClosingSide(side);
      const formattedPrice = formatPriceForExchange(triggerPrice);

      // 轉換為 CCXT symbol 格式以查詢合約大小
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);
      const contracts = this.convertToContracts(ccxtSymbol, quantity.toNumber());

      // 檢查合約數量是否有效（OKX 最小為 1 張）
      if (contracts < 1) {
        logger.warn(
          { symbol, quantity: quantity.toString(), contracts, minContracts: 1 },
          'OKX: Position size too small for conditional order (min 1 contract)',
        );
        return {
          success: false,
          error: `Position size too small for OKX conditional order. Min 1 contract, got ${contracts.toFixed(4)} contracts.`,
        };
      }

      // 確定 posSide
      const posSide = this.positionMode === 'long_short_mode'
        ? side.toLowerCase() // 'long' or 'short'
        : 'net';

      logger.info(
        {
          instId,
          type,
          closingSide,
          posSide,
          triggerPrice: formattedPrice,
          originalQuantity: quantity.toString(),
          contracts,
          positionMode: this.positionMode,
        },
        'Creating OKX conditional order via native API',
      );

      // 構建 OKX Algo Order 參數
      // ordType: 'trigger' 用於獨立的觸發單
      const algoParams: Record<string, any> = {
        instId,
        tdMode: 'cross', // 全倉模式
        side: closingSide.toLowerCase(), // 'buy' or 'sell'
        ordType: 'trigger', // 觸發單類型
        sz: contracts.toString(), // 使用合約張數
        posSide,
        reduceOnly: true,
        // 觸發條件
        triggerPx: formattedPrice,
        triggerPxType: 'mark', // 使用標記價格
        orderPx: '-1', // -1 表示市價執行
      };

      logger.debug({ algoParams }, 'OKX algo order params');

      // 使用 CCXT 的原生 API 調用
      const response = await this.ccxtExchange.privatePostTradeOrderAlgo(algoParams);

      // 解析回應
      if (response.code !== '0') {
        const errorMsg = response.data?.[0]?.sMsg || response.msg || 'Unknown error';
        throw new Error(`OKX API Error: ${errorMsg} (code: ${response.code})`);
      }

      const algoId = response.data?.[0]?.algoId;

      if (!algoId) {
        throw new Error('No algoId returned from OKX');
      }

      logger.info(
        { algoId, instId, type },
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
   * 轉換 symbol 為 OKX instId 格式
   * e.g., BTCUSDT -> BTC-USDT-SWAP
   */
  private convertToOkxInstId(symbol: string): string {
    // 如果已經是 OKX 格式，直接返回
    if (symbol.includes('-') && symbol.endsWith('-SWAP')) {
      return symbol;
    }

    // 處理 CCXT 格式 BTC/USDT:USDT
    if (symbol.includes('/')) {
      const base = symbol.split('/')[0];
      const quote = symbol.split('/')[1]?.split(':')[0] || 'USDT';
      return `${base}-${quote}-SWAP`;
    }

    // 處理純格式 BTCUSDT
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}-${quote}-SWAP`;
      }
    }

    return `${symbol}-USDT-SWAP`;
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

    // 處理 OKX 格式 BTC-USDT-SWAP
    if (symbol.includes('-') && symbol.endsWith('-SWAP')) {
      const parts = symbol.split('-');
      const base = parts[0];
      const quote = parts[1];
      return `${base}/${quote}:${quote}`;
    }

    // 處理純格式 BTCUSDT
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
