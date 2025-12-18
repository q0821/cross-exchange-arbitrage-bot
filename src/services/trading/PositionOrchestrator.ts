/**
 * PositionOrchestrator
 *
 * Saga Pattern 協調器，負責協調雙邊開倉操作
 * Feature: 033-manual-open-position
 */

import { PrismaClient, PositionWebStatus, Position } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import { PositionLockService, LockContext } from './PositionLockService';
import { BalanceValidator } from './BalanceValidator';
import {
  TradingError,
  ExchangeApiError,
  RollbackFailedError,
  type SupportedExchange,
} from '../../lib/errors/trading-errors';
import type {
  OpenPositionParams,
  ExecuteOpenResult,
  BilateralOpenResult,
  RollbackResult,
  LeverageOption,
} from '../../types/trading';
import * as ccxt from 'ccxt';

/**
 * 回滾配置
 */
const ROLLBACK_CONFIG = {
  /** 最大重試次數 */
  MAX_RETRIES: 3,
  /** 重試間隔 (ms): 0, 1000, 2000 */
  RETRY_DELAYS: [0, 1000, 2000],
} as const;

/**
 * 訂單執行超時 (ms)
 */
const ORDER_TIMEOUT_MS = 30000;

/**
 * 交易所交易執行介面
 */
interface ExchangeTrader {
  createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    leverage?: number,
  ): Promise<{
    orderId: string;
    price: number;
    quantity: number;
    fee: number;
  }>;
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
 * PositionOrchestrator
 *
 * 協調雙邊開倉操作的 Saga Pattern 實現
 */
export class PositionOrchestrator {
  private readonly prisma: PrismaClient;
  private readonly balanceValidator: BalanceValidator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.balanceValidator = new BalanceValidator(prisma);
  }

  /**
   * 執行開倉操作
   *
   * @param params 開倉參數
   * @returns 開倉結果（Position 記錄）
   */
  async openPosition(params: OpenPositionParams): Promise<Position> {
    const { userId, symbol, longExchange, shortExchange, quantity, leverage } = params;

    logger.info(
      {
        userId,
        symbol,
        longExchange,
        shortExchange,
        quantity: quantity.toString(),
        leverage,
      },
      'Starting position opening orchestration',
    );

    // 使用分散式鎖執行開倉
    return PositionLockService.withLock(userId, symbol, async (lockContext) => {
      return this.executeOpenPositionWithLock(params, lockContext);
    });
  }

  /**
   * 在持有鎖的情況下執行開倉
   */
  private async executeOpenPositionWithLock(
    params: OpenPositionParams,
    _lockContext: LockContext,
  ): Promise<Position> {
    const { userId, symbol, longExchange, shortExchange, quantity, leverage } = params;

    // 1. 創建 Position 記錄 (PENDING)
    const position = await this.createPendingPosition(params);

    try {
      // 2. 獲取當前價格
      const prices = await this.getCurrentPrices(symbol, longExchange, shortExchange);

      // 3. 驗證餘額
      await this.balanceValidator.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        new Decimal(prices.longPrice),
        new Decimal(prices.shortPrice),
        leverage,
      );

      // 4. 更新狀態為 OPENING
      await this.updatePositionStatus(position.id, 'OPENING');

      // 5. 執行雙邊開倉
      const result = await this.executeBilateralOpen(
        userId,
        symbol,
        longExchange,
        shortExchange,
        quantity,
        leverage,
      );

      // 6. 處理結果
      return await this.handleOpenResult(position, result, quantity);
    } catch (error) {
      // 更新 Position 為 FAILED
      await this.updatePositionStatus(
        position.id,
        'FAILED',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * 創建 PENDING 狀態的 Position 記錄
   */
  private async createPendingPosition(params: OpenPositionParams): Promise<Position> {
    const { userId, symbol, longExchange, shortExchange, leverage } = params;

    const position = await this.prisma.position.create({
      data: {
        userId,
        symbol,
        longExchange,
        shortExchange,
        longEntryPrice: 0,
        longPositionSize: 0,
        longLeverage: leverage,
        shortEntryPrice: 0,
        shortPositionSize: 0,
        shortLeverage: leverage,
        status: 'PENDING',
        openFundingRateLong: 0,
        openFundingRateShort: 0,
      },
    });

    logger.info({ positionId: position.id }, 'Created pending position');

    return position;
  }

  /**
   * 獲取當前價格
   */
  private async getCurrentPrices(
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
  ): Promise<{ longPrice: number; shortPrice: number }> {
    // 使用 CCXT 獲取價格
    const ccxt = await import('ccxt');

    const longTrader = this.createCcxtExchange(ccxt, longExchange);
    const shortTrader = this.createCcxtExchange(ccxt, shortExchange);

    const [longTicker, shortTicker] = await Promise.all([
      longTrader.fetchTicker(this.formatSymbolForCcxt(symbol)),
      shortTrader.fetchTicker(this.formatSymbolForCcxt(symbol)),
    ]);

    return {
      longPrice: longTicker.last || 0,
      shortPrice: shortTicker.last || 0,
    };
  }

  /**
   * 創建 CCXT 交易所實例（用於價格查詢，無需 API Key）
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createCcxtExchange(ccxt: any, exchange: SupportedExchange) {
    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
    };

    const exchangeId = exchangeMap[exchange];
    const ExchangeClass = ccxt[exchangeId];

    return new ExchangeClass({
      sandbox: false,
      options: { defaultType: 'swap' },
    });
  }

  /**
   * 執行雙邊開倉
   */
  private async executeBilateralOpen(
    userId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    quantity: Decimal,
    leverage: LeverageOption,
  ): Promise<BilateralOpenResult> {
    // 創建用戶特定的交易所連接器
    const longTrader = await this.createUserTrader(userId, longExchange);
    const shortTrader = await this.createUserTrader(userId, shortExchange);

    const ccxtSymbol = this.formatSymbolForCcxt(symbol);

    // 並行執行雙邊開倉
    const [longResult, shortResult] = await Promise.all([
      this.executeOpenOrder(longTrader, ccxtSymbol, 'buy', quantity.toNumber(), leverage, longExchange),
      this.executeOpenOrder(shortTrader, ccxtSymbol, 'sell', quantity.toNumber(), leverage, shortExchange),
    ]);

    return { longResult, shortResult };
  }

  /**
   * 執行單邊開倉訂單
   */
  private async executeOpenOrder(
    trader: ExchangeTrader,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    leverage: LeverageOption,
    exchange: SupportedExchange,
  ): Promise<ExecuteOpenResult> {
    try {
      const result = await Promise.race([
        trader.createMarketOrder(symbol, side, quantity, leverage),
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
        'Failed to execute open order',
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
        reject(new ExchangeApiError(exchange, 'createOrder', `Timeout after ${ms}ms`, undefined, true));
      }, ms);
    });
  }

  /**
   * 處理開倉結果
   */
  private async handleOpenResult(
    position: Position,
    result: BilateralOpenResult,
    quantity: Decimal,
  ): Promise<Position> {
    const { longResult, shortResult } = result;

    // 兩邊都成功
    if (longResult.success && shortResult.success) {
      return this.handleBothSuccess(position, longResult, shortResult, quantity);
    }

    // 兩邊都失敗
    if (!longResult.success && !shortResult.success) {
      return this.handleBothFailed(position, longResult, shortResult);
    }

    // 一邊成功一邊失敗 - 執行回滾
    return this.handlePartialSuccess(position, longResult, shortResult, quantity);
  }

  /**
   * 處理兩邊都成功
   */
  private async handleBothSuccess(
    position: Position,
    longResult: ExecuteOpenResult,
    shortResult: ExecuteOpenResult,
    quantity: Decimal,
  ): Promise<Position> {
    logger.info(
      {
        positionId: position.id,
        longOrderId: longResult.orderId,
        shortOrderId: shortResult.orderId,
      },
      'Both sides opened successfully',
    );

    const updatedPosition = await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'OPEN',
        longOrderId: longResult.orderId,
        longEntryPrice: longResult.price!.toNumber(),
        longPositionSize: quantity.toNumber(),
        shortOrderId: shortResult.orderId,
        shortEntryPrice: shortResult.price!.toNumber(),
        shortPositionSize: quantity.toNumber(),
        openedAt: new Date(),
      },
    });

    return updatedPosition;
  }

  /**
   * 處理兩邊都失敗
   */
  private async handleBothFailed(
    position: Position,
    longResult: ExecuteOpenResult,
    shortResult: ExecuteOpenResult,
  ): Promise<Position> {
    logger.warn(
      {
        positionId: position.id,
        longError: longResult.error?.message,
        shortError: shortResult.error?.message,
      },
      'Both sides failed to open',
    );

    const errorMessages = [
      longResult.error ? `Long: ${longResult.error.message}` : null,
      shortResult.error ? `Short: ${shortResult.error.message}` : null,
    ].filter(Boolean).join('; ');

    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'FAILED',
        failureReason: errorMessages,
      },
    });

    throw new TradingError(
      '雙邊開倉都失敗',
      'BILATERAL_OPEN_FAILED',
      false,
      { longError: longResult.error?.message, shortError: shortResult.error?.message },
    );
  }

  /**
   * 處理部分成功（需要回滾）
   */
  private async handlePartialSuccess(
    position: Position,
    longResult: ExecuteOpenResult,
    shortResult: ExecuteOpenResult,
    quantity: Decimal,
  ): Promise<Position> {
    const successSide = longResult.success ? 'LONG' : 'SHORT';
    const successResult = longResult.success ? longResult : shortResult;
    const failedResult = longResult.success ? shortResult : longResult;
    const successExchange = longResult.success ? position.longExchange : position.shortExchange;

    logger.warn(
      {
        positionId: position.id,
        successSide,
        successOrderId: successResult.orderId,
        failedError: failedResult.error?.message,
      },
      'Partial success - initiating rollback',
    );

    // 獲取用戶 ID 用於回滾
    const rollbackResult = await this.executeRollback(
      position.userId,
      successExchange as SupportedExchange,
      position.symbol,
      successSide === 'LONG' ? 'sell' : 'buy',
      quantity.toNumber(),
    );

    if (rollbackResult.success) {
      // 回滾成功 - Position 標記為 FAILED
      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'FAILED',
          failureReason: `${successSide === 'LONG' ? 'Short' : 'Long'} side failed: ${failedResult.error?.message}. Rollback successful.`,
        },
      });

      throw new TradingError(
        '開倉失敗，已自動回滾',
        'OPEN_FAILED_ROLLED_BACK',
        false,
        { rollbackSuccess: true },
      );
    } else {
      // 回滾失敗 - Position 標記為 PARTIAL
      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'PARTIAL',
          longOrderId: longResult.success ? longResult.orderId : null,
          longEntryPrice: longResult.success ? longResult.price!.toNumber() : 0,
          longPositionSize: longResult.success ? quantity.toNumber() : 0,
          shortOrderId: shortResult.success ? shortResult.orderId : null,
          shortEntryPrice: shortResult.success ? shortResult.price!.toNumber() : 0,
          shortPositionSize: shortResult.success ? quantity.toNumber() : 0,
          openedAt: new Date(),
          failureReason: `Rollback failed after ${rollbackResult.attempts} attempts. Manual intervention required.`,
        },
      });

      throw new RollbackFailedError(
        successExchange as SupportedExchange,
        successResult.orderId!,
        successSide,
        quantity.toString(),
        rollbackResult.attempts,
      );
    }
  }

  /**
   * 執行回滾操作（帶重試）
   */
  private async executeRollback(
    userId: string,
    exchange: SupportedExchange,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
  ): Promise<RollbackResult> {
    const ccxtSymbol = this.formatSymbolForCcxt(symbol);

    for (let attempt = 0; attempt < ROLLBACK_CONFIG.MAX_RETRIES; attempt++) {
      // 等待重試間隔
      const retryDelay = ROLLBACK_CONFIG.RETRY_DELAYS[attempt] ?? 0;
      if (retryDelay > 0) {
        await this.sleep(retryDelay);
      }

      logger.info(
        { exchange, symbol, side, quantity, attempt: attempt + 1 },
        'Attempting rollback',
      );

      try {
        const trader = await this.createUserTrader(userId, exchange);
        await trader.closePosition(ccxtSymbol, side, quantity);

        logger.info(
          { exchange, symbol, attempt: attempt + 1 },
          'Rollback successful',
        );

        return {
          success: true,
          attempts: attempt + 1,
          requiresManualIntervention: false,
        };
      } catch (error) {
        logger.error(
          { error, exchange, symbol, attempt: attempt + 1 },
          'Rollback attempt failed',
        );
      }
    }

    // 所有重試都失敗
    return {
      success: false,
      attempts: ROLLBACK_CONFIG.MAX_RETRIES,
      requiresManualIntervention: true,
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
    const ExchangeClass = ccxt[exchangeId];

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
      createMarketOrder: async (symbol, side, quantity, leverage) => {
        // 設置槓桿（始終設定，確保使用正確的槓桿倍數）
        if (leverage) {
          try {
            await ccxtExchange.setLeverage(leverage, symbol);
            logger.info({ exchange, symbol, leverage }, 'Leverage set successfully');
          } catch (e) {
            logger.warn({ exchange, symbol, leverage, error: e }, 'Failed to set leverage, continuing...');
          }
        }

        // 執行市價單
        const orderParams = isPortfolioMargin ? { portfolioMargin: true } : {};
        const order = await ccxtExchange.createMarketOrder(symbol, side, quantity, undefined, orderParams);

        return {
          orderId: order.id,
          price: order.average || order.price || 0,
          quantity: order.filled || order.amount || quantity,
          fee: order.fee?.cost || 0,
        };
      },

      closePosition: async (symbol, side, quantity) => {
        // 執行平倉（與開倉方向相反）
        const closeSide = side === 'buy' ? 'sell' : 'buy';
        const orderParams = isPortfolioMargin
          ? { reduceOnly: true, portfolioMargin: true }
          : { reduceOnly: true };
        const order = await ccxtExchange.createMarketOrder(symbol, closeSide, quantity, undefined, orderParams);

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

  /**
   * Sleep 函數
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default PositionOrchestrator;
