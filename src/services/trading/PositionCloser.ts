/**
 * PositionCloser
 *
 * 平倉服務，負責協調雙邊平倉操作
 * Feature: 035-close-position
 */

import { PrismaClient, PositionWebStatus, Position, Trade, CloseReason } from '@/generated/prisma/client';
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
import { FundingFeeQueryService } from './FundingFeeQueryService';
import { ConditionalOrderAdapterFactory } from './ConditionalOrderAdapterFactory';

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
 * 單邊平倉參數
 * Feature: 050-sl-tp-trigger-monitor
 */
export interface CloseSingleSideParams {
  /** 用戶 ID */
  userId: string;
  /** 持倉 ID */
  positionId: string;
  /** 要平倉的一邊 */
  side: 'LONG' | 'SHORT';
  /** 平倉原因 */
  closeReason: CloseReason;
}

/**
 * 單邊平倉成功結果
 */
export interface CloseSingleSideSuccessResult {
  success: true;
  position: Position;
  closedSide: {
    side: 'LONG' | 'SHORT';
    exchange: SupportedExchange;
    orderId: string;
    price: Decimal;
    quantity: Decimal;
    fee: Decimal;
  };
}

/**
 * 單邊平倉失敗結果
 */
export interface CloseSingleSideFailedResult {
  success: false;
  error: string;
  position: Position;
}

/**
 * 單邊平倉結果類型
 */
export type CloseSingleSideResult = CloseSingleSideSuccessResult | CloseSingleSideFailedResult;

/**
 * PositionCloser
 *
 * 協調雙邊平倉操作的服務
 */
export class PositionCloser {
  private readonly prisma: PrismaClient;
  private readonly fundingFeeQueryService: FundingFeeQueryService;
  private readonly conditionalOrderAdapterFactory: ConditionalOrderAdapterFactory;

  constructor(prisma: PrismaClient, fundingFeeQueryService?: FundingFeeQueryService) {
    this.prisma = prisma;
    this.fundingFeeQueryService = fundingFeeQueryService || new FundingFeeQueryService(prisma);
    this.conditionalOrderAdapterFactory = new ConditionalOrderAdapterFactory(prisma);
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
      logger.info(
        { exchange, symbol, side, quantity },
        'Executing close order',
      );

      const result = await Promise.race([
        trader.closePosition(symbol, side, quantity),
        this.createTimeoutPromise(ORDER_TIMEOUT_MS, exchange),
      ]);

      // 詳細記錄訂單結果
      logger.info(
        {
          exchange,
          symbol,
          side,
          orderId: result.orderId,
          price: result.price,
          quantity: result.quantity,
          fee: result.fee,
        },
        'Close order executed successfully - raw result',
      );

      // 警告：如果價格為 0，可能需要重新獲取訂單資訊
      if (!result.price || result.price === 0) {
        logger.warn(
          { exchange, orderId: result.orderId },
          'Close order returned price 0 - API may not have returned fill price immediately',
        );
      }

      return {
        success: true,
        orderId: result.orderId,
        price: new Decimal(result.price || 0),
        quantity: new Decimal(result.quantity || quantity),
        fee: new Decimal(result.fee || 0),
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
    // 詳細記錄平倉結果，用於偵錯 PnL 計算
    logger.info(
      {
        positionId: position.id,
        long: {
          exchange: position.longExchange,
          orderId: longResult.orderId,
          price: longResult.price?.toString(),
          quantity: longResult.quantity?.toString(),
          fee: longResult.fee?.toString(),
        },
        short: {
          exchange: position.shortExchange,
          orderId: shortResult.orderId,
          price: shortResult.price?.toString(),
          quantity: shortResult.quantity?.toString(),
          fee: shortResult.fee?.toString(),
        },
      },
      'Both sides closed successfully - detailed results',
    );

    const closedAt = new Date();

    // 確保價格和費用有有效值
    const longExitPrice = longResult.price ?? new Decimal(0);
    const shortExitPrice = shortResult.price ?? new Decimal(0);
    const longFee = longResult.fee ?? new Decimal(0);
    const shortFee = shortResult.fee ?? new Decimal(0);

    // 警告：如果價格為 0，可能是 API 返回資料有問題
    if (longExitPrice.isZero()) {
      logger.warn(
        { positionId: position.id, exchange: position.longExchange },
        'Long exit price is 0 - this may indicate an API issue',
      );
    }
    if (shortExitPrice.isZero()) {
      logger.warn(
        { positionId: position.id, exchange: position.shortExchange },
        'Short exit price is 0 - this may indicate an API issue',
      );
    }

    // 查詢資金費率損益
    const fundingFeeResult = await this.fundingFeeQueryService.queryBilateralFundingFees(
      position.longExchange as SupportedExchange,
      position.shortExchange as SupportedExchange,
      position.symbol,
      position.openedAt || new Date(),
      closedAt,
      position.userId,
    );

    logger.info(
      {
        positionId: position.id,
        longFundingFee: fundingFeeResult.longResult.totalAmount.toString(),
        shortFundingFee: fundingFeeResult.shortResult.totalAmount.toString(),
        totalFundingFee: fundingFeeResult.totalFundingFee.toString(),
      },
      'Funding fee query result',
    );

    // 計算損益
    const pnlInput: PnLCalculationInput = {
      longEntryPrice: new Decimal(position.longEntryPrice),
      longExitPrice,
      longPositionSize: new Decimal(position.longPositionSize),
      longFee,
      shortEntryPrice: new Decimal(position.shortEntryPrice),
      shortExitPrice,
      shortPositionSize: new Decimal(position.shortPositionSize),
      shortFee,
      leverage: position.longLeverage,
      openedAt: position.openedAt || new Date(),
      closedAt,
      fundingRatePnL: fundingFeeResult.totalFundingFee, // 使用實際查詢結果
    };

    // 記錄 PnL 計算輸入
    logger.debug(
      {
        positionId: position.id,
        longEntryPrice: pnlInput.longEntryPrice.toString(),
        longExitPrice: pnlInput.longExitPrice.toString(),
        longPositionSize: pnlInput.longPositionSize.toString(),
        shortEntryPrice: pnlInput.shortEntryPrice.toString(),
        shortExitPrice: pnlInput.shortExitPrice.toString(),
        shortPositionSize: pnlInput.shortPositionSize.toString(),
      },
      'PnL calculation input',
    );

    const pnlResult = calculatePnL(pnlInput);

    // 記錄 PnL 計算結果
    logger.info(
      {
        positionId: position.id,
        priceDiffPnL: pnlResult.priceDiffPnL.toString(),
        totalFees: pnlResult.totalFees.toString(),
        totalPnL: pnlResult.totalPnL.toString(),
        roi: pnlResult.roi.toString(),
      },
      'PnL calculation result',
    );

    // 更新 Position 狀態
    // T039: closePosition() 設定 closeReason = MANUAL（手動平倉）
    const updatedPosition = await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
        closedAt,
        closeReason: 'MANUAL',
        longExitPrice: longExitPrice.toNumber(),
        longCloseOrderId: longResult.orderId,
        shortExitPrice: shortExitPrice.toNumber(),
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
        longExitPrice: longExitPrice.toNumber(),
        longPositionSize: position.longPositionSize,
        longFee: longFee.toNumber(),
        shortEntryPrice: position.shortEntryPrice,
        shortExitPrice: shortExitPrice.toNumber(),
        shortPositionSize: position.shortPositionSize,
        shortFee: shortFee.toNumber(),
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

    // 取消條件單（停損停利）
    // 平倉成功後清理殘留的條件單，失敗不影響平倉結果
    await this.cancelConditionalOrders(position);

    // 準備返回的 quantity
    const longQuantity = longResult.quantity ?? new Decimal(position.longPositionSize);
    const shortQuantity = shortResult.quantity ?? new Decimal(position.shortPositionSize);

    return {
      success: true,
      position: updatedPosition,
      trade,
      longClose: {
        orderId: longResult.orderId!,
        price: longExitPrice,
        quantity: longQuantity,
        fee: longFee,
      },
      shortClose: {
        orderId: shortResult.orderId!,
        price: shortExitPrice,
        quantity: shortQuantity,
        fee: shortFee,
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
   * 偵測 Binance 帳戶類型和持倉模式
   *
   * @returns { isPortfolioMargin, isHedgeMode }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async detectBinanceAccountType(ccxtExchange: any): Promise<{
    isPortfolioMargin: boolean;
    isHedgeMode: boolean;
  }> {
    // 先嘗試標準 Futures API
    try {
      const result = await ccxtExchange.fapiPrivateGetPositionSideDual();
      const isHedgeMode = result?.dualSidePosition === true || result?.dualSidePosition === 'true';
      logger.info({ isHedgeMode, result }, 'Binance standard Futures account detected (PositionCloser)');
      return { isPortfolioMargin: false, isHedgeMode };
    } catch (fapiError: unknown) {
      const fapiErrorMsg = fapiError instanceof Error ? fapiError.message : String(fapiError);
      logger.warn({ error: fapiErrorMsg }, 'Standard Futures API failed, trying Portfolio Margin (PositionCloser)');
    }

    // 標準 API 失敗，嘗試 Portfolio Margin API
    try {
      const papiResult = await ccxtExchange.papiGetUmPositionSideDual();
      const isHedgeMode = papiResult?.dualSidePosition === true || papiResult?.dualSidePosition === 'true';
      logger.info({ isHedgeMode, papiResult }, 'Binance Portfolio Margin account detected (PositionCloser)');
      return { isPortfolioMargin: true, isHedgeMode };
    } catch (papiError: unknown) {
      const papiErrorMsg = papiError instanceof Error ? papiError.message : String(papiError);
      logger.warn({ error: papiErrorMsg }, 'Portfolio Margin API also failed (PositionCloser)');
    }

    // 無法偵測，預設標準帳戶 + One-way Mode
    logger.info('Binance account type detection failed, defaulting to standard + One-way Mode (PositionCloser)');
    return { isPortfolioMargin: false, isHedgeMode: false };
  }

  /**
   * 創建 CCXT 交易器（異步版本，支援動態偵測持倉模式）
   */
  private async createCcxtTraderAsync(
    exchange: SupportedExchange,
    apiKey: string,
    apiSecret: string,
    passphrase?: string,
    isTestnet: boolean = false,
  ): Promise<ExchangeTrader> {
    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
      bingx: 'bingx',
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

    // Binance 使用 future 類型
    if (exchange === 'binance') {
      config.options.defaultType = 'future';
    }

    if (passphrase && exchange === 'okx') {
      config.password = passphrase;
    }

    let ccxtExchange = new ExchangeClass(config);

    // 動態偵測 Binance 帳戶類型和持倉模式
    let isBinancePortfolioMargin = false;
    let isBinanceHedgeMode = false;

    if (exchange === 'binance') {
      const accountType = await this.detectBinanceAccountType(ccxtExchange);
      isBinancePortfolioMargin = accountType.isPortfolioMargin;
      isBinanceHedgeMode = accountType.isHedgeMode;

      // 如果是 Portfolio Margin，需要重新創建 exchange 實例並啟用 portfolioMargin 選項
      if (isBinancePortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled (PositionCloser)');
        config.options.portfolioMargin = true;
        ccxtExchange = new ExchangeClass(config);
      }
    }

    // OKX 預設使用 Hedge Mode
    const isOkxHedgeMode = exchange === 'okx';

    // BingX 預設使用 Hedge Mode（雙向持倉）
    const isBingxHedgeMode = exchange === 'bingx';

    logger.info(
      { exchange, isBinancePortfolioMargin, isBinanceHedgeMode, isOkxHedgeMode, isBingxHedgeMode },
      'Position mode configuration (PositionCloser)',
    );

    // 載入市場資料以獲取合約大小（contractSize）
    await ccxtExchange.loadMarkets();

    // 用於追蹤 Binance 實際使用的模式（初始值為偵測結果）
    let actualBinanceHedgeMode = isBinanceHedgeMode;

    /**
     * 將用戶指定的數量轉換為合約數量
     * OKX 的合約大小不是 1，例如 BEAT 的 contractSize = 10
     * 所以用戶要買 40 BEAT，實際要下單 4 張合約
     */
    const convertToContracts = (symbol: string, amount: number): number => {
      const market = ccxtExchange.markets[symbol];
      const contractSize = market?.contractSize || 1;

      if (contractSize !== 1) {
        const contracts = amount / contractSize;
        logger.info(
          { exchange, symbol, originalAmount: amount, contractSize, contracts },
          'Converting quantity to contracts (PositionCloser)',
        );
        return contracts;
      }
      return amount;
    };

    return {
      closePosition: async (symbol, side, quantity) => {
        // 轉換為合約數量
        const contractQuantity = convertToContracts(symbol, quantity);

        // 執行平倉
        // Hedge Mode 需要指定 positionSide/posSide
        // - 平多倉 (long): side='sell', positionSide='LONG'/posSide='long'
        // - 平空倉 (short): side='buy', positionSide='SHORT'/posSide='short'
        const buildCloseOrderParams = (useHedgeMode: boolean): Record<string, unknown> => {
          if (exchange === 'binance' && useHedgeMode) {
            // side='sell' 代表平多倉，positionSide='LONG'
            // side='buy' 代表平空倉，positionSide='SHORT'
            const positionSide = side === 'sell' ? 'LONG' : 'SHORT';
            return { positionSide };
          } else if (isOkxHedgeMode) {
            // side='sell' 代表平多倉，posSide='long'
            // side='buy' 代表平空倉，posSide='short'
            const posSide = side === 'sell' ? 'long' : 'short';
            return { posSide, tdMode: 'cross' };
          } else if (isBingxHedgeMode) {
            // BingX Hedge Mode: side='sell' 代表平多倉，side='buy' 代表平空倉
            const positionSide = side === 'sell' ? 'LONG' : 'SHORT';
            return { positionSide };
          }
          return { reduceOnly: true };
        };

        let orderParams = buildCloseOrderParams(actualBinanceHedgeMode);

        if (exchange === 'binance' && actualBinanceHedgeMode) {
          logger.info({ exchange, symbol, side, orderParams, quantity, contractQuantity }, 'Closing position with Binance Hedge Mode params');
        } else if (isOkxHedgeMode) {
          logger.info({ exchange, symbol, side, orderParams, quantity, contractQuantity }, 'Closing position with OKX Hedge Mode params');
        } else if (isBingxHedgeMode) {
          logger.info({ exchange, symbol, side, orderParams, quantity, contractQuantity }, 'Closing position with BingX Hedge Mode params');
        } else {
          logger.info({ exchange, symbol, side, orderParams, quantity, contractQuantity }, 'Closing position with One-way Mode (reduceOnly)');
        }

        try {
          const order = await ccxtExchange.createMarketOrder(symbol, side, contractQuantity, undefined, orderParams);

          // 詳細記錄原始訂單回應
          logger.info(
            {
              exchange,
              symbol,
              orderId: order.id,
              status: order.status,
              average: order.average,
              price: order.price,
              filled: order.filled,
              amount: order.amount,
              fee: order.fee,
              cost: order.cost,
              rawInfo: JSON.stringify(order.info).substring(0, 500), // 限制長度
            },
            'Raw order response from exchange (closePosition)',
          );

          // 獲取價格：優先使用 average，其次使用 price
          let fillPrice = order.average || order.price || 0;

          // 如果價格為 0，嘗試獲取訂單詳情（某些交易所需要）
          if (!fillPrice || fillPrice === 0) {
            logger.warn(
              { exchange, orderId: order.id },
              'Price not available in order response, attempting to fetch order details',
            );

            try {
              // 等待一小段時間讓訂單狀態更新
              await new Promise(resolve => setTimeout(resolve, 500));

              const fetchedOrder = await ccxtExchange.fetchOrder(order.id, symbol);
              fillPrice = fetchedOrder.average || fetchedOrder.price || 0;

              logger.info(
                {
                  exchange,
                  orderId: order.id,
                  fetchedAverage: fetchedOrder.average,
                  fetchedPrice: fetchedOrder.price,
                  finalPrice: fillPrice,
                },
                'Fetched order details for price',
              );
            } catch (fetchError) {
              logger.error(
                { exchange, orderId: order.id, error: fetchError },
                'Failed to fetch order details',
              );
            }

            // 如果 fetchOrder 仍無法取得價格，使用 fetchMyTrades 作為備援（特別是 OKX）
            if (!fillPrice || fillPrice === 0) {
              logger.info(
                { exchange, orderId: order.id },
                'Price still 0 after fetchOrder, trying fetchMyTrades',
              );
              try {
                const trades = await ccxtExchange.fetchMyTrades(symbol, undefined, 10);
                // 找到與此訂單相關的成交記錄
                const orderTrades = trades.filter((t: { order?: string }) => t.order === order.id);
                if (orderTrades.length > 0) {
                  // 計算加權平均價格
                  let totalCost = 0;
                  let totalAmount = 0;
                  for (const t of orderTrades) {
                    totalCost += (t.price || 0) * (t.amount || 0);
                    totalAmount += t.amount || 0;
                  }
                  if (totalAmount > 0) {
                    fillPrice = totalCost / totalAmount;
                    logger.info(
                      { exchange, orderId: order.id, fillPrice, tradesCount: orderTrades.length },
                      'Got price from fetchMyTrades',
                    );
                  }
                }
              } catch (tradesError) {
                logger.warn(
                  { exchange, orderId: order.id, error: tradesError },
                  'Failed to fetch trades for price, using 0',
                );
              }
            }
          }

          // 獲取手續費
          const fee = order.fee?.cost || 0;

          return {
            orderId: order.id,
            price: fillPrice,
            quantity: order.filled || order.amount || quantity, // 返回原始數量
            fee,
          };
        } catch (error: unknown) {
          // 檢查是否為 Binance 持倉模式不匹配錯誤 (-4061)
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isBinancePositionSideError =
            exchange === 'binance' &&
            (errorMessage.includes('-4061') || errorMessage.includes('position side does not match'));

          if (isBinancePositionSideError) {
            // 嘗試用相反的模式重試
            actualBinanceHedgeMode = !actualBinanceHedgeMode;
            orderParams = buildCloseOrderParams(actualBinanceHedgeMode);
            logger.warn(
              { exchange, symbol, side, newHedgeMode: actualBinanceHedgeMode, orderParams },
              'Retrying close with opposite position mode after -4061 error (PositionCloser)',
            );

            const order = await ccxtExchange.createMarketOrder(symbol, side, contractQuantity, undefined, orderParams);

            // 詳細記錄重試後的訂單回應
            logger.info(
              {
                exchange,
                symbol,
                orderId: order.id,
                average: order.average,
                price: order.price,
                filled: order.filled,
              },
              'Retry order response (closePosition)',
            );

            // 獲取價格
            let retryFillPrice = order.average || order.price || 0;

            // 如果價格為 0，嘗試獲取訂單詳情
            if (!retryFillPrice || retryFillPrice === 0) {
              try {
                await new Promise(resolve => setTimeout(resolve, 500));
                const fetchedOrder = await ccxtExchange.fetchOrder(order.id, symbol);
                retryFillPrice = fetchedOrder.average || fetchedOrder.price || 0;
              } catch (fetchError) {
                logger.error(
                  { exchange, orderId: order.id, error: fetchError },
                  'Failed to fetch retry order details',
                );
              }

              // 如果 fetchOrder 仍無法取得價格，使用 fetchMyTrades 作為備援
              if (!retryFillPrice || retryFillPrice === 0) {
                try {
                  const trades = await ccxtExchange.fetchMyTrades(symbol, undefined, 10);
                  const orderTrades = trades.filter((t: { order?: string }) => t.order === order.id);
                  if (orderTrades.length > 0) {
                    let totalCost = 0;
                    let totalAmount = 0;
                    for (const t of orderTrades) {
                      totalCost += (t.price || 0) * (t.amount || 0);
                      totalAmount += t.amount || 0;
                    }
                    if (totalAmount > 0) {
                      retryFillPrice = totalCost / totalAmount;
                    }
                  }
                } catch {
                  // 忽略
                }
              }
            }

            return {
              orderId: order.id,
              price: retryFillPrice,
              quantity: order.filled || order.amount || quantity,
              fee: order.fee?.cost || 0,
            };
          }

          // 其他錯誤直接拋出
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
   * 取消倉位的所有條件單（停損停利）
   *
   * 平倉成功後呼叫此方法清理殘留的條件單
   * 失敗時僅記錄警告，不影響平倉結果
   */
  private async cancelConditionalOrders(position: Position): Promise<void> {
    const conditionalOrders = [
      {
        exchange: position.longExchange as SupportedExchange,
        orderId: position.longStopLossOrderId,
        type: 'longStopLoss',
      },
      {
        exchange: position.longExchange as SupportedExchange,
        orderId: position.longTakeProfitOrderId,
        type: 'longTakeProfit',
      },
      {
        exchange: position.shortExchange as SupportedExchange,
        orderId: position.shortStopLossOrderId,
        type: 'shortStopLoss',
      },
      {
        exchange: position.shortExchange as SupportedExchange,
        orderId: position.shortTakeProfitOrderId,
        type: 'shortTakeProfit',
      },
    ].filter(order => order.orderId); // 只處理有 orderId 的

    if (conditionalOrders.length === 0) {
      logger.debug(
        { positionId: position.id },
        'No conditional orders to cancel',
      );
      return;
    }

    logger.info(
      {
        positionId: position.id,
        orderCount: conditionalOrders.length,
        orders: conditionalOrders.map(o => ({ type: o.type, exchange: o.exchange })),
      },
      'Canceling conditional orders after position close',
    );

    // 並行取消所有條件單
    const cancelResults = await Promise.allSettled(
      conditionalOrders.map(async order => {
        try {
          const adapter = await this.conditionalOrderAdapterFactory.getAdapter(
            order.exchange,
            position.userId,
          );
          const success = await adapter.cancelConditionalOrder(
            position.symbol,
            order.orderId!,
          );

          if (success) {
            logger.info(
              {
                positionId: position.id,
                type: order.type,
                exchange: order.exchange,
                orderId: order.orderId,
              },
              'Conditional order cancelled successfully',
            );
          } else {
            logger.warn(
              {
                positionId: position.id,
                type: order.type,
                exchange: order.exchange,
                orderId: order.orderId,
              },
              'Failed to cancel conditional order (adapter returned false)',
            );
          }

          return { type: order.type, success };
        } catch (error) {
          logger.warn(
            {
              positionId: position.id,
              type: order.type,
              exchange: order.exchange,
              orderId: order.orderId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Error canceling conditional order',
          );
          return { type: order.type, success: false };
        }
      }),
    );

    // 統計結果
    const successCount = cancelResults.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;

    logger.info(
      {
        positionId: position.id,
        total: conditionalOrders.length,
        success: successCount,
        failed: conditionalOrders.length - successCount,
      },
      'Conditional orders cancellation completed',
    );
  }

  /**
   * 單邊平倉
   *
   * 當條件單觸發後，用於平倉另一邊的倉位
   * Feature: 050-sl-tp-trigger-monitor
   *
   * @param params 單邊平倉參數
   * @returns 單邊平倉結果
   */
  async closeSingleSide(params: CloseSingleSideParams): Promise<CloseSingleSideResult> {
    const { userId, positionId, side, closeReason } = params;

    logger.info(
      { userId, positionId, side, closeReason },
      'Starting single side position close',
    );

    // 使用分散式鎖執行平倉
    return this.withCloseLock(positionId, async () => {
      return this.executeCloseSingleSideWithLock(userId, positionId, side, closeReason);
    });
  }

  /**
   * 在持有鎖的情況下執行單邊平倉
   */
  private async executeCloseSingleSideWithLock(
    userId: string,
    positionId: string,
    side: 'LONG' | 'SHORT',
    closeReason: CloseReason,
  ): Promise<CloseSingleSideResult> {
    // 1. 獲取並驗證持倉
    const position = await this.getAndValidatePosition(userId, positionId);

    // 2. 更新狀態為 CLOSING
    await this.updatePositionStatus(position.id, 'CLOSING');

    try {
      // 3. 根據 side 決定要平倉的交易所和倉位資訊
      const exchange = (side === 'LONG' ? position.longExchange : position.shortExchange) as SupportedExchange;
      const quantity = side === 'LONG'
        ? new Decimal(position.longPositionSize)
        : new Decimal(position.shortPositionSize);

      // 平倉方向：Long 用 sell，Short 用 buy
      const orderSide = side === 'LONG' ? 'sell' : 'buy';

      // 4. 創建用戶特定的交易所連接器
      const trader = await this.createUserTrader(userId, exchange);

      // 5. 執行平倉
      const ccxtSymbol = this.formatSymbolForCcxt(position.symbol);
      const closeResult = await this.executeCloseOrder(
        trader,
        ccxtSymbol,
        orderSide,
        quantity.toNumber(),
        exchange,
      );

      if (!closeResult.success) {
        // 平倉失敗，回復狀態
        await this.updatePositionStatus(
          position.id,
          'OPEN',
          closeResult.error?.message || 'Single side close failed',
        );

        return {
          success: false,
          error: closeResult.error?.message || 'Single side close failed',
          position,
        };
      }

      // 6. 更新 Position 狀態為 CLOSED 並記錄 closeReason
      const closedAt = new Date();
      const updatedPosition = await this.prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          closedAt,
          closeReason,
          ...(side === 'LONG'
            ? {
                longExitPrice: closeResult.price!.toNumber(),
                longCloseOrderId: closeResult.orderId,
              }
            : {
                shortExitPrice: closeResult.price!.toNumber(),
                shortCloseOrderId: closeResult.orderId,
              }),
        },
      });

      logger.info(
        {
          positionId: position.id,
          side,
          exchange,
          orderId: closeResult.orderId,
          price: closeResult.price?.toString(),
          closeReason,
        },
        'Single side position closed successfully',
      );

      return {
        success: true,
        position: updatedPosition,
        closedSide: {
          side,
          exchange,
          orderId: closeResult.orderId!,
          price: closeResult.price!,
          quantity: closeResult.quantity!,
          fee: closeResult.fee!,
        },
      };
    } catch (error) {
      // 回復狀態為 OPEN
      await this.updatePositionStatus(
        position.id,
        'OPEN',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * 取消單邊的條件單
   *
   * 當一邊觸發後，用於取消另一邊的條件單（停損/停利）
   * Feature: 050-sl-tp-trigger-monitor
   *
   * @param position 持倉資料
   * @param side 要取消的一邊 (LONG 或 SHORT)
   */
  async cancelSingleSideConditionalOrders(
    position: Position,
    side: 'LONG' | 'SHORT',
  ): Promise<void> {
    // 根據 side 選擇對應的交易所和訂單 ID
    const exchange = (side === 'LONG' ? position.longExchange : position.shortExchange) as SupportedExchange;
    const stopLossOrderId = side === 'LONG' ? position.longStopLossOrderId : position.shortStopLossOrderId;
    const takeProfitOrderId = side === 'LONG' ? position.longTakeProfitOrderId : position.shortTakeProfitOrderId;

    const conditionalOrders = [
      {
        exchange,
        orderId: stopLossOrderId,
        type: `${side.toLowerCase()}StopLoss`,
      },
      {
        exchange,
        orderId: takeProfitOrderId,
        type: `${side.toLowerCase()}TakeProfit`,
      },
    ].filter(order => order.orderId); // 只處理有 orderId 的

    if (conditionalOrders.length === 0) {
      logger.debug(
        { positionId: position.id, side },
        'No conditional orders to cancel on this side',
      );
      return;
    }

    logger.info(
      {
        positionId: position.id,
        side,
        orderCount: conditionalOrders.length,
        orders: conditionalOrders.map(o => ({ type: o.type, exchange: o.exchange })),
      },
      'Canceling single side conditional orders',
    );

    // 並行取消指定邊的條件單
    const cancelResults = await Promise.allSettled(
      conditionalOrders.map(async order => {
        try {
          const adapter = await this.conditionalOrderAdapterFactory.getAdapter(
            order.exchange,
            position.userId,
          );
          const success = await adapter.cancelConditionalOrder(
            position.symbol,
            order.orderId!,
          );

          if (success) {
            logger.info(
              {
                positionId: position.id,
                type: order.type,
                exchange: order.exchange,
                orderId: order.orderId,
              },
              'Single side conditional order cancelled successfully',
            );
          } else {
            logger.warn(
              {
                positionId: position.id,
                type: order.type,
                exchange: order.exchange,
                orderId: order.orderId,
              },
              'Failed to cancel single side conditional order (adapter returned false)',
            );
          }

          return { type: order.type, success };
        } catch (error) {
          logger.warn(
            {
              positionId: position.id,
              type: order.type,
              exchange: order.exchange,
              orderId: order.orderId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Error canceling single side conditional order',
          );
          return { type: order.type, success: false };
        }
      }),
    );

    // 統計結果
    const successCount = cancelResults.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;

    logger.info(
      {
        positionId: position.id,
        side,
        total: conditionalOrders.length,
        success: successCount,
        failed: conditionalOrders.length - successCount,
      },
      'Single side conditional orders cancellation completed',
    );
  }
}

export default PositionCloser;
