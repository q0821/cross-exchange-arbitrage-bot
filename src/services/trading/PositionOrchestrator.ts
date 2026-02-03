/**
 * PositionOrchestrator
 *
 * Saga Pattern 協調器，負責協調雙邊開倉操作
 * Feature: 033-manual-open-position
 */

import { PrismaClient, PositionWebStatus, Position } from '@/generated/prisma/client';
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
import { ConditionalOrderService } from './ConditionalOrderService';
import { PositionGroupService } from './PositionGroupService';
import { createBinanceAccountDetector } from './BinanceAccountDetector';
import { createCcxtExchangeFactory } from './CcxtExchangeFactory';
import { createPublicExchange, type SupportedExchange as CcxtSupportedExchange } from '@/lib/ccxt-factory';
import { convertToContractsWithExchange } from './ContractQuantityConverter';
import { createOrderParamsBuilder } from './OrderParamsBuilder';
import { createOrderPriceFetcher } from './OrderPriceFetcher';
import type {
  ICcxtExchangeFactory,
  IOrderParamsBuilder,
  IOrderPriceFetcher,
} from '@/types/trading';

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
  private readonly conditionalOrderService: ConditionalOrderService;
  private readonly exchangeFactory: ICcxtExchangeFactory;
  private readonly paramsBuilder: IOrderParamsBuilder;
  private readonly priceFetcher: IOrderPriceFetcher;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.balanceValidator = new BalanceValidator(prisma);
    this.conditionalOrderService = new ConditionalOrderService();

    // 初始化重構後的交易服務
    const binanceAccountDetector = createBinanceAccountDetector();
    this.exchangeFactory = createCcxtExchangeFactory(binanceAccountDetector);
    this.paramsBuilder = createOrderParamsBuilder();
    this.priceFetcher = createOrderPriceFetcher();
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
    const {
      userId,
      symbol,
      longExchange,
      shortExchange,
      quantity,
      leverage,
      // 停損停利參數 (Feature 038)
      stopLossEnabled,
      stopLossPercent,
      takeProfitEnabled,
      takeProfitPercent,
    } = params;

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

      // 6. 處理結果（含停損停利設定）
      return await this.handleOpenResult(
        position,
        result,
        quantity,
        { enabled: stopLossEnabled ?? false, percent: stopLossPercent },
        { enabled: takeProfitEnabled ?? false, percent: takeProfitPercent },
      );
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
    const { userId, symbol, longExchange, shortExchange, leverage, groupId } = params;

    // Feature 070: 統一 groupId 架構 - 單獨開倉時自動生成 groupId
    const effectiveGroupId = groupId ?? PositionGroupService.generateGroupId();

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
        // Feature 069/070: 持倉組別 ID（所有持倉必須有 groupId）
        groupId: effectiveGroupId,
      },
    });

    logger.info(
      { positionId: position.id, groupId: effectiveGroupId },
      'Created pending position',
    );

    return position;
  }

  /**
   * 獲取當前價格
   *
   * 使用 createPublicExchange 確保 proxy 配置自動套用
   */
  private async getCurrentPrices(
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
  ): Promise<{ longPrice: number; shortPrice: number }> {

    const longTrader = createPublicExchange(longExchange as CcxtSupportedExchange);
    const shortTrader = createPublicExchange(shortExchange as CcxtSupportedExchange);

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
    // 創建用戶特定的交易所連接器（平行執行以優化效能）
    const [longTrader, shortTrader] = await Promise.all([
      this.createUserTrader(userId, longExchange),
      this.createUserTrader(userId, shortExchange),
    ]);

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
    stopLossParams?: { enabled: boolean; percent?: number },
    takeProfitParams?: { enabled: boolean; percent?: number },
  ): Promise<Position> {
    const { longResult, shortResult } = result;

    // 兩邊都成功
    if (longResult.success && shortResult.success) {
      return this.handleBothSuccess(
        position,
        longResult,
        shortResult,
        quantity,
        stopLossParams,
        takeProfitParams,
      );
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
    stopLossParams?: { enabled: boolean; percent?: number },
    takeProfitParams?: { enabled: boolean; percent?: number },
  ): Promise<Position> {
    logger.info(
      {
        positionId: position.id,
        longOrderId: longResult.orderId,
        shortOrderId: shortResult.orderId,
      },
      'Both sides opened successfully',
    );

    // 更新 Position 為 OPEN 狀態
    let updatedPosition = await this.prisma.position.update({
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
        // 停損停利設定 (Feature 038)
        stopLossEnabled: stopLossParams?.enabled ?? false,
        stopLossPercent: stopLossParams?.percent,
        takeProfitEnabled: takeProfitParams?.enabled ?? false,
        takeProfitPercent: takeProfitParams?.percent,
        conditionalOrderStatus: 'PENDING',
      },
    });

    // 設定停損停利條件單 (Feature 038)
    const shouldSetConditionalOrders =
      (stopLossParams?.enabled && stopLossParams?.percent) ||
      (takeProfitParams?.enabled && takeProfitParams?.percent);

    if (shouldSetConditionalOrders) {
      updatedPosition = await this.setConditionalOrders(
        updatedPosition,
        quantity,
        stopLossParams,
        takeProfitParams,
      );
    }

    return updatedPosition;
  }

  /**
   * 設定停損停利條件單 (Feature 038)
   */
  private async setConditionalOrders(
    position: Position,
    quantity: Decimal,
    stopLossParams?: { enabled: boolean; percent?: number },
    takeProfitParams?: { enabled: boolean; percent?: number },
  ): Promise<Position> {
    logger.info(
      {
        positionId: position.id,
        stopLossEnabled: stopLossParams?.enabled,
        stopLossPercent: stopLossParams?.percent,
        takeProfitEnabled: takeProfitParams?.enabled,
        takeProfitPercent: takeProfitParams?.percent,
      },
      'Setting conditional orders for position',
    );

    try {
      // 更新狀態為 SETTING
      await this.prisma.position.update({
        where: { id: position.id },
        data: { conditionalOrderStatus: 'SETTING' },
      });

      // 調用 ConditionalOrderService
      const result = await this.conditionalOrderService.setConditionalOrders({
        positionId: position.id,
        symbol: position.symbol,
        longExchange: position.longExchange as SupportedExchange,
        longEntryPrice: new Decimal(position.longEntryPrice),
        longQuantity: quantity,
        shortExchange: position.shortExchange as SupportedExchange,
        shortEntryPrice: new Decimal(position.shortEntryPrice),
        shortQuantity: quantity,
        stopLossEnabled: stopLossParams?.enabled ?? false,
        stopLossPercent: stopLossParams?.percent,
        takeProfitEnabled: takeProfitParams?.enabled ?? false,
        takeProfitPercent: takeProfitParams?.percent,
        userId: position.userId,
      });

      // 更新 Position 記錄條件單結果
      const updatedPosition = await this.prisma.position.update({
        where: { id: position.id },
        data: {
          conditionalOrderStatus: result.overallStatus,
          conditionalOrderError:
            result.errors.length > 0 ? result.errors.join('; ') : null,
          // 停損
          longStopLossPrice: result.longResult.stopLoss?.triggerPrice?.toNumber(),
          longStopLossOrderId: result.longResult.stopLoss?.orderId,
          shortStopLossPrice: result.shortResult.stopLoss?.triggerPrice?.toNumber(),
          shortStopLossOrderId: result.shortResult.stopLoss?.orderId,
          // 停利
          longTakeProfitPrice: result.longResult.takeProfit?.triggerPrice?.toNumber(),
          longTakeProfitOrderId: result.longResult.takeProfit?.orderId,
          shortTakeProfitPrice: result.shortResult.takeProfit?.triggerPrice?.toNumber(),
          shortTakeProfitOrderId: result.shortResult.takeProfit?.orderId,
        },
      });

      logger.info(
        {
          positionId: position.id,
          overallStatus: result.overallStatus,
          errors: result.errors,
        },
        'Conditional orders setting completed',
      );

      return updatedPosition;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error, positionId: position.id },
        'Failed to set conditional orders',
      );

      // 更新狀態為 FAILED，但不影響開倉成功狀態
      return this.prisma.position.update({
        where: { id: position.id },
        data: {
          conditionalOrderStatus: 'FAILED',
          conditionalOrderError: errorMessage,
        },
      });
    }
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
    // 注意：closePosition 的 side 參數是「原始開倉方向」，內部會自動反轉為平倉方向
    // LONG 倉位的原始開倉方向是 'buy'，SHORT 倉位的原始開倉方向是 'sell'
    const rollbackResult = await this.executeRollback(
      position.userId,
      successExchange as SupportedExchange,
      position.symbol,
      successSide === 'LONG' ? 'buy' : 'sell',
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

    // 創建 CCXT 交易所實例（使用異步版本以偵測持倉模式）
    return this.createCcxtTraderAsync(
      exchange,
      decryptedKey,
      decryptedSecret,
      decryptedPassphrase,
      apiKey.environment === 'TESTNET',
    );
  }

  /**
   * 創建 CCXT 交易器
   *
   * 使用重構後的服務：
   * - CcxtExchangeFactory: 創建交易所實例
   * - OrderParamsBuilder: 建構訂單參數
   * - OrderPriceFetcher: 獲取成交價格
   * - ContractQuantityConverter: 合約數量轉換
   */
  private async createCcxtTraderAsync(
    exchange: SupportedExchange,
    apiKey: string,
    apiSecret: string,
    passphrase?: string,
    isTestnet: boolean = false,
  ): Promise<ExchangeTrader> {
    // 使用 CcxtExchangeFactory 創建交易所實例（含帳戶偵測和市場載入）
    const exchangeInstance = await this.exchangeFactory.create(exchange, {
      apiKey,
      apiSecret,
      passphrase,
      isTestnet,
    });

    const ccxtExchange = exchangeInstance.ccxt;
    const { isPortfolioMargin, isHedgeMode } = exchangeInstance;

    // 用於追蹤實際使用的持倉模式（初始值為偵測結果）
    // Binance 可能會在 -4061 錯誤後切換模式
    let actualHedgeMode = isHedgeMode;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ccxtExchangeAny = ccxtExchange as any;

    return {
      createMarketOrder: async (symbol, side, quantity, leverage) => {
        // 使用 ContractQuantityConverter 轉換為合約數量
        const contractQuantity = convertToContractsWithExchange(ccxtExchange, symbol, quantity, exchange);

        // 設置槓桿
        if (leverage) {
          try {
            if (exchange === 'bingx') {
              // BingX：雙向模式需指定 side，單向模式不需要
              if (actualHedgeMode) {
                const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
                await ccxtExchangeAny.setLeverage(leverage, symbol, { side: positionSide });
                logger.info({ exchange, symbol, leverage, positionSide }, 'Leverage set successfully (BingX Hedge Mode)');
              } else {
                await ccxtExchangeAny.setLeverage(leverage, symbol);
                logger.info({ exchange, symbol, leverage }, 'Leverage set successfully (BingX One-way Mode)');
              }
            } else {
              await ccxtExchangeAny.setLeverage(leverage, symbol);
              logger.info({ exchange, symbol, leverage }, 'Leverage set successfully');
            }
          } catch (e) {
            logger.warn({ exchange, symbol, leverage, error: e }, 'Failed to set leverage, continuing...');
          }
        }

        // 使用 OrderParamsBuilder 建構訂單參數
        const hedgeConfig = { enabled: actualHedgeMode, isPortfolioMargin };
        let orderParams = this.paramsBuilder.buildOpenParams(exchange, side, hedgeConfig);

        logger.info(
          { exchange, symbol, side, orderParams, quantity, contractQuantity, leverage, isHedgeMode },
          'Opening position',
        );

        try {
          const order = await ccxtExchangeAny.createMarketOrder(symbol, side, contractQuantity, undefined, orderParams);

          // 使用 OrderPriceFetcher 獲取成交價格
          const priceResult = await this.priceFetcher.fetch(ccxtExchange, order.id, symbol, order.average || order.price);

          return {
            orderId: order.id,
            price: priceResult.price,
            quantity: order.filled || order.amount || quantity,
            fee: order.fee?.cost || 0,
          };
        } catch (error: unknown) {
          // 處理 Binance -4061 錯誤（持倉模式不匹配）
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isBinancePositionSideError =
            exchange === 'binance' &&
            (errorMessage.includes('-4061') || errorMessage.includes('position side does not match'));

          if (isBinancePositionSideError) {
            actualHedgeMode = !actualHedgeMode;
            orderParams = this.paramsBuilder.buildOpenParams(exchange, side, { enabled: actualHedgeMode, isPortfolioMargin });
            logger.warn(
              { exchange, symbol, side, newHedgeMode: actualHedgeMode, orderParams },
              'Retrying with opposite position mode after -4061 error',
            );

            const order = await ccxtExchangeAny.createMarketOrder(symbol, side, contractQuantity, undefined, orderParams);
            const priceResult = await this.priceFetcher.fetch(ccxtExchange, order.id, symbol, order.average || order.price);

            return {
              orderId: order.id,
              price: priceResult.price,
              quantity: order.filled || order.amount || quantity,
              fee: order.fee?.cost || 0,
            };
          }

          throw error;
        }
      },

      closePosition: async (symbol, side, quantity) => {
        // 使用 ContractQuantityConverter 轉換為合約數量
        const contractQuantity = convertToContractsWithExchange(ccxtExchange, symbol, quantity, exchange);
        const closeSide = side === 'buy' ? 'sell' : 'buy';

        // 使用 OrderParamsBuilder 建構平倉參數
        const hedgeConfig = { enabled: actualHedgeMode, isPortfolioMargin };
        let orderParams = this.paramsBuilder.buildCloseParams(exchange, side, hedgeConfig);

        logger.info(
          { exchange, symbol, closeSide, orderParams, quantity, contractQuantity, isHedgeMode },
          'Closing position',
        );

        try {
          const order = await ccxtExchangeAny.createMarketOrder(symbol, closeSide, contractQuantity, undefined, orderParams);

          // 使用 OrderPriceFetcher 獲取成交價格
          const priceResult = await this.priceFetcher.fetch(ccxtExchange, order.id, symbol, order.average || order.price);

          return {
            orderId: order.id,
            price: priceResult.price,
            quantity: order.filled || order.amount || quantity,
            fee: order.fee?.cost || 0,
          };
        } catch (error: unknown) {
          // 處理 Binance -4061 錯誤
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isBinancePositionSideError =
            exchange === 'binance' &&
            (errorMessage.includes('-4061') || errorMessage.includes('position side does not match'));

          if (isBinancePositionSideError) {
            actualHedgeMode = !actualHedgeMode;
            orderParams = this.paramsBuilder.buildCloseParams(exchange, side, { enabled: actualHedgeMode, isPortfolioMargin });
            logger.warn(
              { exchange, symbol, closeSide, newHedgeMode: actualHedgeMode, orderParams },
              'Retrying close with opposite position mode after -4061 error',
            );

            const order = await ccxtExchangeAny.createMarketOrder(symbol, closeSide, contractQuantity, undefined, orderParams);
            const priceResult = await this.priceFetcher.fetch(ccxtExchange, order.id, symbol, order.average || order.price);

            return {
              orderId: order.id,
              price: priceResult.price,
              quantity: order.filled || order.amount || quantity,
              fee: order.fee?.cost || 0,
            };
          }

          throw error;
        }
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
