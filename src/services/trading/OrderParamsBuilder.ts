/**
 * OrderParamsBuilder
 *
 * 負責根據交易所和持倉模式建構訂單參數
 *
 * Feature: 062-refactor-trading-srp
 */

import { logger } from '@/lib/logger';
import type {
  HedgeModeConfig,
  IOrderParamsBuilder,
  OrderParams,
  SupportedExchange,
} from '@/types/trading';

/**
 * 訂單參數建構器
 *
 * 從 PositionOrchestrator.createCcxtTraderAsync 提取
 * 開倉參數：src/services/trading/PositionOrchestrator.ts:891-904
 * 平倉參數：src/services/trading/PositionOrchestrator.ts:1059-1076
 *
 * 不同交易所的參數格式：
 * - Binance Hedge Mode: positionSide = 'LONG' | 'SHORT'
 * - OKX Hedge Mode: posSide = 'long' | 'short', tdMode = 'cross'
 * - BingX Hedge Mode: positionSide = 'LONG' | 'SHORT'
 * - One-way Mode: 平倉使用 reduceOnly = true
 */
export class OrderParamsBuilder implements IOrderParamsBuilder {
  /**
   * 建構開倉參數
   *
   * 開倉邏輯：
   * - 開多倉: side='buy', positionSide='LONG'/posSide='long'
   * - 開空倉: side='sell', positionSide='SHORT'/posSide='short'
   *
   * @param exchange - 交易所類型
   * @param side - 買賣方向
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildOpenParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig,
  ): OrderParams {
    // Binance Hedge Mode
    if (exchange === 'binance' && hedgeMode.enabled) {
      const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, side, positionSide }, 'Building Binance Hedge Mode open params');
      return { positionSide };
    }

    // OKX Hedge Mode（預設啟用）
    if (exchange === 'okx') {
      const posSide = side === 'buy' ? 'long' : 'short';
      logger.debug({ exchange, side, posSide }, 'Building OKX Hedge Mode open params');
      return { posSide, tdMode: 'cross' };
    }

    // BingX Hedge Mode（預設啟用）
    if (exchange === 'bingx') {
      const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, side, positionSide }, 'Building BingX Hedge Mode open params');
      return { positionSide };
    }

    // One-way Mode（無特殊參數）
    logger.debug({ exchange, side }, 'Building One-way Mode open params');
    return {};
  }

  /**
   * 建構平倉參數
   *
   * 平倉邏輯（與開倉方向相反）：
   * - 平多倉: closeSide='sell', positionSide='LONG'/posSide='long'
   * - 平空倉: closeSide='buy', positionSide='SHORT'/posSide='short'
   *
   * 注意：positionSide 參數是原始持倉的方向，不是平倉訂單的方向
   *
   * @param exchange - 交易所類型
   * @param positionSide - 原始持倉的買賣方向（buy=多倉, sell=空倉）
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildCloseParams(
    exchange: SupportedExchange,
    positionSide: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig,
  ): OrderParams {
    // Binance Hedge Mode
    // positionSide='buy' 代表原本是做多，要用 sell 平倉，positionSide='LONG'
    // positionSide='sell' 代表原本是做空，要用 buy 平倉，positionSide='SHORT'
    if (exchange === 'binance' && hedgeMode.enabled) {
      const positionSideParam = positionSide === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, positionSide, positionSideParam }, 'Building Binance Hedge Mode close params');
      return { positionSide: positionSideParam };
    }

    // OKX Hedge Mode
    // positionSide='buy' 代表原本是做多，要用 sell 平倉，posSide='long'
    // positionSide='sell' 代表原本是做空，要用 buy 平倉，posSide='short'
    if (exchange === 'okx') {
      const posSide = positionSide === 'buy' ? 'long' : 'short';
      logger.debug({ exchange, positionSide, posSide }, 'Building OKX Hedge Mode close params');
      return { posSide, tdMode: 'cross' };
    }

    // BingX Hedge Mode
    if (exchange === 'bingx') {
      const positionSideParam = positionSide === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, positionSide, positionSideParam }, 'Building BingX Hedge Mode close params');
      return { positionSide: positionSideParam };
    }

    // One-way Mode 使用 reduceOnly
    logger.debug({ exchange, positionSide }, 'Building One-way Mode close params (reduceOnly)');
    return { reduceOnly: true };
  }
}

/**
 * 建立 OrderParamsBuilder 實例
 */
export function createOrderParamsBuilder(): IOrderParamsBuilder {
  return new OrderParamsBuilder();
}
