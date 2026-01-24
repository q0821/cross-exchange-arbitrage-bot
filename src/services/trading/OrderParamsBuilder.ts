/**
 * OrderParamsBuilder
 *
 * 負責根據交易所和持倉模式建構訂單參數
 *
 * Feature: 062-refactor-trading-srp
 */

import { logger } from '@/lib/logger';
import { TradingError } from '@/lib/errors/trading-errors';
import type {
  HedgeModeConfig,
  IOrderParamsBuilder,
  OrderParams,
  SupportedExchange,
} from '@/types/trading';

/**
 * 支援的交易所列表
 */
const SUPPORTED_EXCHANGES: SupportedExchange[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'];

/**
 * 有效的買賣方向
 */
const VALID_SIDES = ['buy', 'sell'] as const;

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
    // 驗證交易所
    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      throw new TradingError(
        `Unsupported exchange: ${exchange}`,
        'UNSUPPORTED_EXCHANGE',
        false,
        { exchange, supportedExchanges: SUPPORTED_EXCHANGES },
      );
    }

    // 驗證 side
    if (!VALID_SIDES.includes(side)) {
      throw new TradingError(
        `Invalid side: ${side}. Must be 'buy' or 'sell'`,
        'INVALID_SIDE',
        false,
        { side, validSides: VALID_SIDES },
      );
    }

    // Binance Hedge Mode
    if (exchange === 'binance' && hedgeMode.enabled) {
      const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, side, positionSide }, 'Building Binance Hedge Mode open params');
      return { positionSide };
    }

    // OKX：根據 hedgeMode 決定參數
    if (exchange === 'okx') {
      if (hedgeMode.enabled) {
        // 雙向模式：posSide = 'long' | 'short'
        const posSide = side === 'buy' ? 'long' : 'short';
        logger.debug({ exchange, side, posSide }, 'Building OKX Hedge Mode open params');
        return { posSide, tdMode: 'cross' };
      } else {
        // 單向模式：posSide = 'net'
        logger.debug({ exchange, side }, 'Building OKX One-way Mode open params');
        return { posSide: 'net', tdMode: 'cross' };
      }
    }

    // BingX：根據 hedgeMode 決定參數
    if (exchange === 'bingx') {
      if (hedgeMode.enabled) {
        // 雙向模式：positionSide = 'LONG' | 'SHORT'
        const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
        logger.debug({ exchange, side, positionSide }, 'Building BingX Hedge Mode open params');
        return { positionSide };
      } else {
        // 單向模式：positionSide = 'BOTH'
        logger.debug({ exchange, side }, 'Building BingX One-way Mode open params');
        return { positionSide: 'BOTH' };
      }
    }

    // One-way Mode（無特殊參數）
    logger.debug({ exchange, side }, 'Building One-way Mode open params');
    return {};
  }

  /**
   * 建構平倉參數
   *
   * 平倉邏輯（與開倉方向相反）：
   * - 平多倉: side='buy'（原始開倉方向）→ closeSide='sell', positionSide='LONG'/posSide='long'
   * - 平空倉: side='sell'（原始開倉方向）→ closeSide='buy', positionSide='SHORT'/posSide='short'
   *
   * 重要：positionSide 參數代表**原始開倉時的方向**，而不是平倉訂單的實際方向。
   * 例如：要平掉一個做多的倉位，傳入 positionSide='buy'，
   * 函數會產生 sell 方向的訂單，並帶上 positionSide='LONG' 參數。
   *
   * @param exchange - 交易所類型（binance, okx, mexc, gateio, bingx）
   * @param positionSide - **原始開倉時的方向**（buy=多倉, sell=空倉），不是平倉訂單的方向
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數（Binance/BingX: positionSide, OKX: posSide+tdMode, One-way: reduceOnly）
   */
  buildCloseParams(
    exchange: SupportedExchange,
    positionSide: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig,
  ): OrderParams {
    // 驗證交易所
    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      throw new TradingError(
        `Unsupported exchange: ${exchange}`,
        'UNSUPPORTED_EXCHANGE',
        false,
        { exchange, supportedExchanges: SUPPORTED_EXCHANGES },
      );
    }

    // 驗證 positionSide
    if (!VALID_SIDES.includes(positionSide)) {
      throw new TradingError(
        `Invalid positionSide: ${positionSide}. Must be 'buy' or 'sell'`,
        'INVALID_POSITION_SIDE',
        false,
        { positionSide, validSides: VALID_SIDES },
      );
    }

    // Binance Hedge Mode
    // positionSide='buy' 代表原本是做多，要用 sell 平倉，positionSide='LONG'
    // positionSide='sell' 代表原本是做空，要用 buy 平倉，positionSide='SHORT'
    if (exchange === 'binance' && hedgeMode.enabled) {
      const positionSideParam = positionSide === 'buy' ? 'LONG' : 'SHORT';
      logger.debug({ exchange, positionSide, positionSideParam }, 'Building Binance Hedge Mode close params');
      return { positionSide: positionSideParam };
    }

    // OKX：根據 hedgeMode 決定參數
    // positionSide='buy' 代表原本是做多，要用 sell 平倉
    // positionSide='sell' 代表原本是做空，要用 buy 平倉
    if (exchange === 'okx') {
      if (hedgeMode.enabled) {
        // 雙向模式：posSide = 'long' | 'short'
        const posSide = positionSide === 'buy' ? 'long' : 'short';
        logger.debug({ exchange, positionSide, posSide }, 'Building OKX Hedge Mode close params');
        return { posSide, tdMode: 'cross' };
      } else {
        // 單向模式：posSide = 'net' + reduceOnly
        logger.debug({ exchange, positionSide }, 'Building OKX One-way Mode close params');
        return { posSide: 'net', tdMode: 'cross', reduceOnly: true };
      }
    }

    // BingX：根據 hedgeMode 決定參數
    if (exchange === 'bingx') {
      if (hedgeMode.enabled) {
        // 雙向模式：positionSide = 'LONG' | 'SHORT'
        const positionSideParam = positionSide === 'buy' ? 'LONG' : 'SHORT';
        logger.debug({ exchange, positionSide, positionSideParam }, 'Building BingX Hedge Mode close params');
        return { positionSide: positionSideParam };
      } else {
        // 單向模式：positionSide = 'BOTH' + reduceOnly
        logger.debug({ exchange, positionSide }, 'Building BingX One-way Mode close params');
        return { positionSide: 'BOTH', reduceOnly: true };
      }
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
