/**
 * PositionCloser
 *
 * 平倉服務，負責協調雙邊平倉操作
 * Feature: 035-close-position
 */

import { PrismaClient, PositionWebStatus, Position, Trade } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import { acquireLock, releaseLock } from '../../lib/redis';
import { randomUUID } from 'crypto';
import {
  TradingError,
  ExchangeApiError,
} from '../../lib/errors/trading-errors';
import type {
  SupportedExchange,
  ClosePositionParams,
  ExecuteCloseResult,
  BilateralCloseResult,
  TradeSide,
} from '../../types/trading';
import {
  calculatePnL,
  type PnLCalculationInput,
} from '../../lib/pnl-calculator';
import * as ccxt from 'ccxt';

/**
 * 鎖的配置
 */
const LOCK_CONFIG = {
  /** 鎖的 TTL (秒) - 60 秒超時（平倉可能需要更長時間） */
  TTL_SECONDS: 60,
  /** 鎖的 key 前綴 */
  KEY_PREFIX: 'position:close',
} as const;

/**
 * 訂單執行超時 (ms)
 */
const ORDER_TIMEOUT_MS = 30000;

/**
 * 鎖的上下文
 */
interface LockContext {
  key: string;
  value: string;
  positionId: string;
  acquiredAt: number;
}

/**
 * 交易所交易執行介面
 */
interface ExchangeTrader {
  closePosition(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
  ): Promise<{
    orderId: string;
    price: number;
    quantity: number;
    fee: number;
  }>;
}

/**
 * 平倉成功結果
 */
export interface ClosePositionSuccessResult {
  success: true;
  position: Position;
  trade: Trade;
  longClose: {
    orderId: string;
    price: Decimal;
    quantity: Decimal;
    fee: Decimal;
  };
  shortClose: {
    orderId: string;
    price: Decimal;
    quantity: Decimal;
    fee: Decimal;
  };
}

/**
 * 部分平倉結果
 */
export interface ClosePositionPartialResult {
  success: false;
  error: 'PARTIAL_CLOSE';
  position: Position;
  closedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    orderId: string;
    price: Decimal;
    quantity: Decimal;
    fee: Decimal;
  };
  failedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    error: Error;
  };
}

/**
 * 平倉結果類型
 */
export type ClosePositionResult = ClosePositionSuccessResult | ClosePositionPartialResult;

/**
 * PositionCloser
 *
 * 協調雙邊平倉操作的服務
 */
export class PositionCloser {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 執行平倉操作
   *
   * @param params 平倉參數
   * @returns 平倉結果
   */
  async closePosition(params: ClosePositionParams): Promise<ClosePositionResult> {
    const { userId, positionId } = params;

    logger.info(
      { userId, positionId },
      'Starting position close orchestration',
    );

    // 使用分散式鎖執行平倉
    return this.withCloseLock(positionId, async () => {
      return this.executeClosePositionWithLock(userId, positionId);
    });
  }

  /**
   * 獲取並使用平倉鎖
   */
  private async withCloseLock<T>(
    positionId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const context = await this.acquireCloseLock(positionId);

    try {
      return await operation();
    } finally {
      await this.releaseCloseLock(context);
    }
  }

  /**
   * 獲取平倉鎖
   */
  private async acquireCloseLock(positionId: string): Promise<LockContext> {
    const key = `${LOCK_CONFIG.KEY_PREFIX}:${positionId}`;
    const value = randomUUID();
    const acquiredAt = Date.now();

    logger.info({ positionId, key }, 'Attempting to acquire close position lock');

    const acquired = await acquireLock(key, LOCK_CONFIG.TTL_SECONDS, value);

    if (!acquired) {
      logger.warn({ positionId, key }, 'Failed to acquire close position lock - already held');
      throw new TradingError(
        '此倉位正在執行其他操作，請稍後再試',
        'CLOSE_LOCK_CONFLICT',
        true,
        { positionId },
      );
    }

    logger.info({ positionId, key, value }, 'Close position lock acquired successfully');

    return {
      key,
      value,
      positionId,
      acquiredAt,
    };
  }

  /**
   * 釋放平倉鎖
   */
  private async releaseCloseLock(context: LockContext): Promise<void> {
    const { key, value, positionId, acquiredAt } = context;
    const holdDuration = Date.now() - acquiredAt;

    logger.info(
      { positionId, key, holdDuration },
      'Releasing close position lock',
    );

    await releaseLock(key, value);
  }

  /**
   * 在持有鎖的情況下執行平倉
   */
  private async executeClosePositionWithLock(
    userId: string,
    positionId: string,
  ): Promise<ClosePositionResult> {
    // 1. 獲取並驗證持倉
    const position = await this.getAndValidatePosition(userId, positionId);

    // 2. 更新狀態為 CLOSING
    await this.updatePositionStatus(position.id, 'CLOSING');

    try {
      // 3. 執行雙邊平倉
      const result = await this.executeBilateralClose(
        userId,
        position.symbol,
        position.longExchange as SupportedExchange,
        position.shortExchange as SupportedExchange,
        new Decimal(position.longPositionSize),
        new Decimal(position.shortPositionSize),
      );

      // 4. 處理結果
      return await this.handleCloseResult(position, result);
    } catch (error) {
      // 更新 Position 狀態（如果還沒被更新為 PARTIAL）
      const currentPosition = await this.prisma.position.findUnique({
        where: { id: position.id },
      });

      if (currentPosition?.status === 'CLOSING') {
        await this.updatePositionStatus(
          position.id,
          'OPEN', // 回復為 OPEN
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
      throw error;
    }
  }

  /**
   * 獲取並驗證持倉
   */
  private async getAndValidatePosition(
    userId: string,
    positionId: string,
  ): Promise<Position> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new TradingError(
        '持倉不存在',
        'POSITION_NOT_FOUND',
        false,
        { positionId },
      );
    }

    if (position.userId !== userId) {
      throw new TradingError(
        '無權操作此持倉',
        'POSITION_ACCESS_DENIED',
        false,
        { positionId, userId },
      );
    }

    if (position.status !== 'OPEN') {
      throw new TradingError(
        `持倉狀態不正確，當前狀態：${position.status}`,
        'INVALID_POSITION_STATUS',
        false,
        { positionId, status: position.status },
      );
    }

    return position;
  }

  /**
   * 執行雙邊平倉
   */
  private async executeBilateralClose(
    userId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    longQuantity: Decimal,
    shortQuantity: Decimal,
  ): Promise<BilateralCloseResult> {
    // 創建用戶特定的交易所連接器
    const longTrader = await this.createUserTrader(userId, longExchange);
    const shortTrader = await this.createUserTrader(userId, shortExchange);

    const ccxtSymbol = this.formatSymbolForCcxt(symbol);

    // 並行執行雙邊平倉
    // Long position close: sell to close (reduceOnly)
    // Short position close: buy to close (reduceOnly)
    const [longResult, shortResult] = await Promise.all([
      this.executeCloseOrder(longTrader, ccxtSymbol, 'sell', longQuantity.toNumber(), longExchange),
      this.executeCloseOrder(shortTrader, ccxtSymbol, 'buy', shortQuantity.toNumber(), shortExchange),
    ]);

    return { longResult, shortResult };
  }

  /**
   * 執行單邊平倉訂單
   */
  private async executeCloseOrder(
    trader: ExchangeTrader,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    exchange: SupportedExchange,
  ): Promise<ExecuteCloseResult> {
    try {
      const result = await Promise.race([
        trader.closePosition(symbol, side, quantity),
        this.createTimeoutPromise(ORDER_TIMEOUT_MS, exchange),
      ]);

      return {
        success: true,
        orderId: result.orderId,
        price: new Decimal(result.price),
        quantity: new Decimal(result.quantity),
        fee: new Decimal(result.fee),
      };
    } catch (error) {
      logger.error(
        { error, exchange, symbol, side, quantity },
        'Failed to execute close order',
      );

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 創建超時 Promise
   */
  private createTimeoutPromise(ms: number, exchange: SupportedExchange): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ExchangeApiError(exchange, 'closePosition', `Timeout after ${ms}ms`, undefined, true));
      }, ms);
    });
  }

  /**
   * 處理平倉結果
   */
  private async handleCloseResult(
    position: Position,
    result: BilateralCloseResult,
  ): Promise<ClosePositionResult> {
    const { longResult, shortResult } = result;

    // 兩邊都成功
    if (longResult.success && shortResult.success) {
      return this.handleBothCloseSuccess(position, longResult, shortResult);
    }

    // 兩邊都失敗
    if (!longResult.success && !shortResult.success) {
      return this.handleBothCloseFailed(position, longResult, shortResult);
    }

    // 一邊成功一邊失敗 - 標記為 PARTIAL
    return this.handlePartialClose(position, longResult, shortResult);
  }

  /**
   * 處理兩邊都成功
   */
  private async handleBothCloseSuccess(
    position: Position,
    longResult: ExecuteCloseResult,
    shortResult: ExecuteCloseResult,
  ): Promise<ClosePositionSuccessResult> {
    logger.info(
      {
        positionId: position.id,
        longOrderId: longResult.orderId,
        shortOrderId: shortResult.orderId,
      },
      'Both sides closed successfully',
    );

    const closedAt = new Date();

    // 計算損益
    const pnlInput: PnLCalculationInput = {
      longEntryPrice: new Decimal(position.longEntryPrice),
      longExitPrice: longResult.price!,
      longPositionSize: new Decimal(position.longPositionSize),
      longFee: longResult.fee!,
      shortEntryPrice: new Decimal(position.shortEntryPrice),
      shortExitPrice: shortResult.price!,
      shortPositionSize: new Decimal(position.shortPositionSize),
      shortFee: shortResult.fee!,
      leverage: position.longLeverage,
      openedAt: position.openedAt || new Date(),
      closedAt,
      fundingRatePnL: new Decimal(0), // 簡化：資金費率損益設為 0
    };

    const pnlResult = calculatePnL(pnlInput);

    // 更新 Position 狀態
    const updatedPosition = await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
        closedAt,
        longExitPrice: longResult.price!.toNumber(),
        longCloseOrderId: longResult.orderId,
        shortExitPrice: shortResult.price!.toNumber(),
        shortCloseOrderId: shortResult.orderId,
      },
    });

    // 創建 Trade 績效記錄
    const trade = await this.prisma.trade.create({
      data: {
        userId: position.userId,
        positionId: position.id,
        symbol: position.symbol,
        longExchange: position.longExchange,
        shortExchange: position.shortExchange,
        longEntryPrice: position.longEntryPrice,
        longExitPrice: longResult.price!.toNumber(),
        longPositionSize: position.longPositionSize,
        longFee: longResult.fee!.toNumber(),
        shortEntryPrice: position.shortEntryPrice,
        shortExitPrice: shortResult.price!.toNumber(),
        shortPositionSize: position.shortPositionSize,
        shortFee: shortResult.fee!.toNumber(),
        openedAt: position.openedAt || new Date(),
        closedAt,
        holdingDuration: pnlResult.holdingDuration,
        priceDiffPnL: pnlResult.priceDiffPnL.toNumber(),
        fundingRatePnL: pnlResult.fundingRatePnL.toNumber(),
        totalFees: pnlResult.totalFees.toNumber(),
        totalPnL: pnlResult.totalPnL.toNumber(),
        roi: pnlResult.roi.toNumber(),
        status: 'SUCCESS',
      },
    });

    logger.info(
      {
        positionId: position.id,
        tradeId: trade.id,
        totalPnL: pnlResult.totalPnL.toString(),
        roi: pnlResult.roi.toString(),
      },
      'Trade performance record created',
    );

    return {
      success: true,
      position: updatedPosition,
      trade,
      longClose: {
        orderId: longResult.orderId!,
        price: longResult.price!,
        quantity: longResult.quantity!,
        fee: longResult.fee!,
      },
      shortClose: {
        orderId: shortResult.orderId!,
        price: shortResult.price!,
        quantity: shortResult.quantity!,
        fee: shortResult.fee!,
      },
    };
  }

  /**
   * 處理兩邊都失敗
   */
  private async handleBothCloseFailed(
    position: Position,
    longResult: ExecuteCloseResult,
    shortResult: ExecuteCloseResult,
  ): Promise<never> {
    logger.warn(
      {
        positionId: position.id,
        longError: longResult.error?.message,
        shortError: shortResult.error?.message,
      },
      'Both sides failed to close',
    );

    const errorMessages = [
      longResult.error ? `Long: ${longResult.error.message}` : null,
      shortResult.error ? `Short: ${shortResult.error.message}` : null,
    ].filter(Boolean).join('; ');

    // 回復狀態為 OPEN
    await this.updatePositionStatus(position.id, 'OPEN', errorMessages);

    throw new TradingError(
      '雙邊平倉都失敗',
      'BILATERAL_CLOSE_FAILED',
      true, // 可重試
      { longError: longResult.error?.message, shortError: shortResult.error?.message },
    );
  }

  /**
   * 處理部分平倉（一邊成功一邊失敗）
   */
  private async handlePartialClose(
    position: Position,
    longResult: ExecuteCloseResult,
    shortResult: ExecuteCloseResult,
  ): Promise<ClosePositionPartialResult> {
    const longSuccess = longResult.success;
    const successResult = longSuccess ? longResult : shortResult;
    const failedResult = longSuccess ? shortResult : longResult;
    const successSide: TradeSide = longSuccess ? 'LONG' : 'SHORT';
    const failedSide: TradeSide = longSuccess ? 'SHORT' : 'LONG';
    const successExchange = longSuccess
      ? (position.longExchange as SupportedExchange)
      : (position.shortExchange as SupportedExchange);
    const failedExchange = longSuccess
      ? (position.shortExchange as SupportedExchange)
      : (position.longExchange as SupportedExchange);

    logger.warn(
      {
        positionId: position.id,
        successSide,
        successOrderId: successResult.orderId,
        failedSide,
        failedError: failedResult.error?.message,
      },
      'Partial close - one side succeeded, one side failed',
    );

    // 更新 Position 狀態為 PARTIAL
    const updatedPosition = await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'PARTIAL',
        failureReason: `${failedSide} side close failed: ${failedResult.error?.message}. ${successSide} side closed successfully.`,
        ...(longSuccess
          ? {
              longExitPrice: successResult.price!.toNumber(),
              longCloseOrderId: successResult.orderId,
            }
          : {
              shortExitPrice: successResult.price!.toNumber(),
              shortCloseOrderId: successResult.orderId,
            }),
      },
    });

    return {
      success: false,
      error: 'PARTIAL_CLOSE',
      position: updatedPosition,
      closedSide: {
        exchange: successExchange,
        side: successSide,
        orderId: successResult.orderId!,
        price: successResult.price!,
        quantity: successResult.quantity!,
        fee: successResult.fee!,
      },
      failedSide: {
        exchange: failedExchange,
        side: failedSide,
        error: failedResult.error!,
      },
    };
  }

  /**
   * 創建用戶特定的交易連接器
   */
  private async createUserTrader(
    userId: string,
    exchange: SupportedExchange,
  ): Promise<ExchangeTrader> {
    // 獲取用戶的 API Key
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        userId,
        exchange,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new TradingError(
        `用戶 ${exchange} API Key 不存在`,
        'API_KEY_NOT_FOUND',
        false,
        { userId, exchange },
      );
    }

    // 解密 API Key
    const decryptedKey = decrypt(apiKey.encryptedKey);
    const decryptedSecret = decrypt(apiKey.encryptedSecret);
    const decryptedPassphrase = apiKey.encryptedPassphrase
      ? decrypt(apiKey.encryptedPassphrase)
      : undefined;

    // 創建 CCXT 交易所實例
    return this.createCcxtTrader(
      exchange,
      decryptedKey,
      decryptedSecret,
      decryptedPassphrase,
      apiKey.environment === 'TESTNET',
    );
  }

  /**
   * 創建 CCXT 交易器
   */
  private createCcxtTrader(
    exchange: SupportedExchange,
    apiKey: string,
    apiSecret: string,
    passphrase?: string,
    isTestnet: boolean = false,
  ): ExchangeTrader {
    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
    };

    const exchangeId = exchangeMap[exchange];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExchangeClass = (ccxt as any)[exchangeId];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      apiKey,
      secret: apiSecret,
      sandbox: isTestnet,
      enableRateLimit: true,
      timeout: 30000, // 30 秒超時
      options: {
        defaultType: 'swap',
      },
    };

    // Binance Portfolio Margin 帳戶需要設定 portfolioMargin 和 defaultType: future
    if (exchange === 'binance') {
      config.options.defaultType = 'future';
      config.options.portfolioMargin = true;
    }

    if (passphrase && exchange === 'okx') {
      config.password = passphrase;
    }

    const ccxtExchange = new ExchangeClass(config);

    // Binance Portfolio Margin 需要在訂單參數中傳遞 portfolioMargin
    const isPortfolioMargin = exchange === 'binance';

    return {
      closePosition: async (symbol, side, quantity) => {
        // 執行平倉
        // Binance Portfolio Margin 使用 Hedge Mode，需要指定 positionSide
        // - 平多倉 (long): side='sell', positionSide='LONG'
        // - 平空倉 (short): side='buy', positionSide='SHORT'
        let orderParams: Record<string, unknown>;

        if (isPortfolioMargin) {
          // Hedge Mode: 使用 positionSide 來平倉
          const positionSide = side === 'sell' ? 'LONG' : 'SHORT';
          orderParams = {
            portfolioMargin: true,
            positionSide,
          };
          logger.info({ exchange, symbol, side, positionSide, quantity }, 'Closing position with Hedge Mode params');
        } else {
          // One-way Mode: 使用 reduceOnly
          orderParams = { reduceOnly: true };
        }

        const order = await ccxtExchange.createMarketOrder(symbol, side, quantity, undefined, orderParams);

        return {
          orderId: order.id,
          price: order.average || order.price || 0,
          quantity: order.filled || order.amount || quantity,
          fee: order.fee?.cost || 0,
        };
      },
    };
  }

  /**
   * 更新 Position 狀態
   */
  private async updatePositionStatus(
    positionId: string,
    status: PositionWebStatus,
    failureReason?: string,
  ): Promise<void> {
    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        status,
        failureReason,
      },
    });

    logger.info({ positionId, status }, 'Position status updated');
  }

  /**
   * 格式化交易對為 CCXT 格式
   */
  private formatSymbolForCcxt(symbol: string): string {
    // 例如 BTCUSDT -> BTC/USDT:USDT
    if (symbol.endsWith('USDT')) {
      const base = symbol.slice(0, -4);
      return `${base}/USDT:USDT`;
    }
    return symbol;
  }
}

export default PositionCloser;
