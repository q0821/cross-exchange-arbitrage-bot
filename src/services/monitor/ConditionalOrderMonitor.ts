/**
 * ConditionalOrderMonitor
 * Feature: 050-sl-tp-trigger-monitor
 *
 * 條件單觸發偵測監控服務
 * 每 30 秒檢查所有 OPEN 持倉的條件單狀態，偵測觸發事件
 */

import { PrismaClient, Position, CloseReason } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logger } from '@/lib/logger';
import { ExchangeQueryService, DecryptedApiKey } from '@/lib/exchange-query-service';
import { decrypt } from '@/lib/encryption';
import { calculatePnL, PnLCalculationInput } from '@/lib/pnl-calculator';
import { PositionCloser, CloseSingleSideResult } from '@/services/trading/PositionCloser';
import { DiscordNotifier } from '@/services/notification/DiscordNotifier';
import { SlackNotifier } from '@/services/notification/SlackNotifier';
import {
  buildTriggerNotificationMessage,
  buildEmergencyNotificationMessage,
} from '@/services/notification/utils';
import type { TriggerNotificationType } from '@/services/notification/types';
import {
  triggerProgressEmitter,
  type TriggerDetectedEvent,
  type TriggerCloseSuccessEvent,
  type TriggerCloseFailedEvent,
  type TriggerCloseStep,
} from '@/services/websocket/TriggerProgressEmitter';
import {
  TriggerType,
  TriggerResult,
  OrderStatusMap,
  DEFAULT_MONITOR_CONFIG,
} from './types';

/**
 * handleTrigger 結果類型
 */
export interface HandleTriggerResult {
  success: boolean;
  error?: string;
  closedSide?: {
    side: 'LONG' | 'SHORT';
    exchange: string;
    orderId: string;
  };
}

/**
 * 條件單監控服務
 */
export class ConditionalOrderMonitor {
  private readonly prisma: PrismaClient;
  private readonly positionCloser: PositionCloser;
  private readonly discordNotifier: DiscordNotifier;
  private readonly slackNotifier: SlackNotifier;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _intervalMs: number;

  constructor(
    prisma: PrismaClient,
    intervalMs?: number,
    positionCloser?: PositionCloser,
  ) {
    this.prisma = prisma;
    this._intervalMs = intervalMs ?? DEFAULT_MONITOR_CONFIG.intervalMs;
    this.positionCloser = positionCloser ?? new PositionCloser(prisma);
    this.discordNotifier = new DiscordNotifier();
    this.slackNotifier = new SlackNotifier();
  }

  /**
   * 是否正在運行
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * 輪詢間隔（毫秒）
   */
  get intervalMs(): number {
    return this._intervalMs;
  }

  /**
   * 啟動監控
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      logger.warn({}, 'ConditionalOrderMonitor is already running');
      return;
    }

    this._isRunning = true;

    logger.info(
      { intervalMs: this._intervalMs },
      'ConditionalOrderMonitor started',
    );

    // 立即執行一次檢查
    await this.checkAllPositions();

    // 設定定時檢查
    this.timer = setInterval(async () => {
      await this.checkAllPositions();
    }, this._intervalMs);
  }

  /**
   * 停止監控
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this._isRunning = false;

    logger.info({}, 'ConditionalOrderMonitor stopped');
  }

  /**
   * 檢查所有 OPEN 持倉的條件單狀態
   */
  async checkAllPositions(): Promise<void> {
    try {
      // 查詢所有 OPEN 且有條件單的持倉
      const positions = await this.prisma.position.findMany({
        where: {
          status: 'OPEN',
          conditionalOrderStatus: 'SET',
        },
      });

      if (positions.length === 0) {
        logger.info({}, '[條件單監控] 沒有需要檢查的持倉');
        return;
      }

      logger.info(
        { count: positions.length },
        '[條件單監控] 開始檢查持倉的條件單狀態',
      );

      // 逐一檢查每個持倉
      for (const position of positions) {
        try {
          const triggerResult = await this.checkPositionConditionalOrders(position);

          if (triggerResult) {
            // 觸發偵測到，記錄日誌
            logger.info(
              {
                positionId: position.id,
                triggerType: triggerResult.triggerType,
                triggeredExchange: triggerResult.triggeredExchange,
                confirmedByHistory: triggerResult.confirmedByHistory,
              },
              '[條件單監控] 偵測到觸發事件',
            );

            // Phase 4 (US2): 處理自動平倉
            if (triggerResult.triggerType === 'BOTH') {
              await this.handleBothTriggered(position, triggerResult);
            } else {
              await this.handleTrigger(position, triggerResult);
            }
          }
        } catch (error) {
          logger.error(
            {
              positionId: position.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Error checking position conditional orders',
          );
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error in checkAllPositions',
      );
    }
  }

  /**
   * 檢查單一持倉的條件單狀態
   */
  async checkPositionConditionalOrders(
    position: Position,
  ): Promise<TriggerResult | null> {
    logger.info(
      { positionId: position.id, symbol: position.symbol },
      '[條件單監控] 檢查持倉',
    );

    // 檢查各個條件單是否存在
    const orderStatus = await this.checkAllOrdersExist(position);

    logger.info(
      {
        positionId: position.id,
        symbol: position.symbol,
        orderStatus,
      },
      '[條件單監控] 訂單狀態檢查結果',
    );

    // 檢查是否雙邊同時觸發
    if (this.detectBothSidesTriggered(orderStatus)) {
      // 確認雙邊觸發
      const longConfirmed = await this.confirmLongTrigger(position, orderStatus);
      const shortConfirmed = await this.confirmShortTrigger(position, orderStatus);

      if (longConfirmed && shortConfirmed) {
        logger.info(
          { positionId: position.id },
          'Both sides triggered detected',
        );

        return {
          positionId: position.id,
          triggerType: 'BOTH',
          triggeredExchange: position.longExchange,
          triggeredOrderId: this.getMissingOrderId(position, orderStatus, 'LONG'),
          triggeredAt: new Date(),
          confirmedByHistory: true,
          otherSideTriggeredExchange: position.shortExchange,
          otherSideTriggeredOrderId: this.getMissingOrderId(position, orderStatus, 'SHORT'),
        };
      }
    }

    // 檢查單邊觸發
    const triggerType = await this.detectTrigger(position, orderStatus);

    if (!triggerType) {
      logger.info(
        { positionId: position.id, symbol: position.symbol },
        '[條件單監控] 未偵測到觸發',
      );
      return null;
    }

    // 確認觸發
    const isLongSide = triggerType === 'LONG_SL' || triggerType === 'LONG_TP';
    const exchange = isLongSide ? position.longExchange : position.shortExchange;
    const orderId = this.getTriggeredOrderId(position, triggerType);
    const positionSide: 'long' | 'short' = isLongSide ? 'long' : 'short';

    const confirmed = await this.confirmTriggerWithHistory(
      exchange,
      position.userId,
      position.symbol,
      orderId,
      positionSide,
    );

    if (!confirmed) {
      logger.info(
        { positionId: position.id, triggerType, orderId },
        '[條件單監控] 觸發未經訂單歷史確認',
      );
      return null;
    }

    return {
      positionId: position.id,
      triggerType,
      triggeredExchange: exchange,
      triggeredOrderId: orderId,
      triggeredAt: new Date(),
      confirmedByHistory: true,
    };
  }

  /**
   * 檢查所有條件單是否存在
   */
  private async checkAllOrdersExist(position: Position): Promise<OrderStatusMap> {
    const result: OrderStatusMap = {
      longStopLossExists: true,
      longTakeProfitExists: true,
      shortStopLossExists: true,
      shortTakeProfitExists: true,
    };

    // 檢查 long 交易所的條件單
    if (position.longStopLossOrderId || position.longTakeProfitOrderId) {
      try {
        const longService = await this.createExchangeService(
          position.longExchange,
          position.userId,
        );

        if (position.longStopLossOrderId) {
          result.longStopLossExists = await longService.checkOrderExists(
            position.symbol,
            position.longStopLossOrderId,
          );
        }

        if (position.longTakeProfitOrderId) {
          result.longTakeProfitExists = await longService.checkOrderExists(
            position.symbol,
            position.longTakeProfitOrderId,
          );
        }

        await longService.disconnect();
      } catch (error) {
        logger.error(
          {
            positionId: position.id,
            exchange: position.longExchange,
            error: error instanceof Error ? error.message : String(error),
          },
          '[條件單監控] 檢查多方條件單失敗',
        );
      }
    }

    // 檢查 short 交易所的條件單
    if (position.shortStopLossOrderId || position.shortTakeProfitOrderId) {
      try {
        const shortService = await this.createExchangeService(
          position.shortExchange,
          position.userId,
        );

        if (position.shortStopLossOrderId) {
          result.shortStopLossExists = await shortService.checkOrderExists(
            position.symbol,
            position.shortStopLossOrderId,
          );
        }

        if (position.shortTakeProfitOrderId) {
          result.shortTakeProfitExists = await shortService.checkOrderExists(
            position.symbol,
            position.shortTakeProfitOrderId,
          );
        }

        await shortService.disconnect();
      } catch (error) {
        logger.error(
          {
            positionId: position.id,
            exchange: position.shortExchange,
            error: error instanceof Error ? error.message : String(error),
          },
          '[條件單監控] 檢查空方條件單失敗',
        );
      }
    }

    return result;
  }

  /**
   * 偵測觸發類型
   */
  async detectTrigger(
    position: Position,
    orderStatus: OrderStatusMap,
  ): Promise<TriggerType | null> {
    // 檢查 long stop loss
    if (!orderStatus.longStopLossExists && position.longStopLossOrderId) {
      return 'LONG_SL';
    }

    // 檢查 long take profit
    if (!orderStatus.longTakeProfitExists && position.longTakeProfitOrderId) {
      return 'LONG_TP';
    }

    // 檢查 short stop loss
    if (!orderStatus.shortStopLossExists && position.shortStopLossOrderId) {
      return 'SHORT_SL';
    }

    // 檢查 short take profit
    if (!orderStatus.shortTakeProfitExists && position.shortTakeProfitOrderId) {
      return 'SHORT_TP';
    }

    return null;
  }

  /**
   * 確認觸發（查詢訂單歷史）
   *
   * 邏輯：
   * 1. 查詢訂單歷史
   * 2. 如果狀態是 TRIGGERED，確認觸發
   * 3. 如果狀態是 CANCELLED，檢查交易所持倉是否還存在
   *    - 如果持倉不存在，表示用戶可能修改了條件單價格導致觸發，視為觸發
   *    - 如果持倉還存在，表示訂單只是被取消，不視為觸發
   */
  async confirmTriggerWithHistory(
    exchange: string,
    userId: string,
    symbol: string,
    orderId: string,
    positionSide?: 'long' | 'short',
  ): Promise<boolean> {
    try {
      const service = await this.createExchangeService(exchange, userId);
      const history = await service.fetchOrderHistory(symbol, orderId);

      logger.info(
        { exchange, symbol, orderId, history },
        '[條件單監控] 訂單歷史查詢結果',
      );

      if (!history) {
        await service.disconnect();
        return false;
      }

      // 狀態是 TRIGGERED，確認觸發
      if (history.status === 'TRIGGERED') {
        await service.disconnect();
        return true;
      }

      // 狀態是 CANCELLED，額外檢查持倉是否還存在
      // 這處理用戶修改條件單價格導致舊單被取消、新單觸發的情況
      if (history.status === 'CANCELED' && positionSide) {
        logger.info(
          { exchange, symbol, orderId, positionSide },
          '[條件單監控] 訂單已取消，檢查交易所持倉是否存在',
        );

        try {
          const positionExists = await service.checkPositionExists(symbol, positionSide);
          await service.disconnect();

          if (!positionExists) {
            logger.info(
              { exchange, symbol, orderId, positionSide },
              '[條件單監控] 交易所持倉已不存在，視為觸發（可能是修改條件單價格後觸發）',
            );
            return true;
          } else {
            logger.info(
              { exchange, symbol, orderId, positionSide },
              '[條件單監控] 交易所持倉仍存在，訂單只是被取消',
            );
            return false;
          }
        } catch (posError) {
          logger.warn(
            { exchange, symbol, orderId, error: (posError as Error).message },
            '[條件單監控] 查詢持倉失敗，無法確認觸發',
          );
          await service.disconnect();
          return false;
        }
      }

      await service.disconnect();
      return false;
    } catch (error) {
      logger.error(
        {
          exchange,
          orderId,
          error: error instanceof Error ? error.message : String(error),
        },
        '[條件單監控] 查詢訂單歷史確認觸發失敗',
      );
      return false;
    }
  }

  /**
   * 偵測雙邊同時觸發
   */
  detectBothSidesTriggered(orderStatus: OrderStatusMap): boolean {
    const longMissing =
      !orderStatus.longStopLossExists || !orderStatus.longTakeProfitExists;
    const shortMissing =
      !orderStatus.shortStopLossExists || !orderStatus.shortTakeProfitExists;

    return longMissing && shortMissing;
  }

  /**
   * 確認 long 側觸發
   */
  private async confirmLongTrigger(
    position: Position,
    orderStatus: OrderStatusMap,
  ): Promise<boolean> {
    if (!orderStatus.longStopLossExists && position.longStopLossOrderId) {
      return await this.confirmTriggerWithHistory(
        position.longExchange,
        position.userId,
        position.symbol,
        position.longStopLossOrderId,
        'long',
      );
    }
    if (!orderStatus.longTakeProfitExists && position.longTakeProfitOrderId) {
      return await this.confirmTriggerWithHistory(
        position.longExchange,
        position.userId,
        position.symbol,
        position.longTakeProfitOrderId,
        'long',
      );
    }
    return false;
  }

  /**
   * 確認 short 側觸發
   */
  private async confirmShortTrigger(
    position: Position,
    orderStatus: OrderStatusMap,
  ): Promise<boolean> {
    if (!orderStatus.shortStopLossExists && position.shortStopLossOrderId) {
      return await this.confirmTriggerWithHistory(
        position.shortExchange,
        position.userId,
        position.symbol,
        position.shortStopLossOrderId,
        'short',
      );
    }
    if (!orderStatus.shortTakeProfitExists && position.shortTakeProfitOrderId) {
      return await this.confirmTriggerWithHistory(
        position.shortExchange,
        position.userId,
        position.symbol,
        position.shortTakeProfitOrderId,
        'short',
      );
    }
    return false;
  }

  /**
   * 取得觸發的訂單 ID
   */
  private getTriggeredOrderId(position: Position, triggerType: TriggerType): string {
    switch (triggerType) {
      case 'LONG_SL':
        return position.longStopLossOrderId || '';
      case 'LONG_TP':
        return position.longTakeProfitOrderId || '';
      case 'SHORT_SL':
        return position.shortStopLossOrderId || '';
      case 'SHORT_TP':
        return position.shortTakeProfitOrderId || '';
      default:
        return '';
    }
  }

  /**
   * 取得缺失的訂單 ID
   */
  private getMissingOrderId(
    position: Position,
    orderStatus: OrderStatusMap,
    side: 'LONG' | 'SHORT',
  ): string {
    if (side === 'LONG') {
      if (!orderStatus.longStopLossExists) return position.longStopLossOrderId || '';
      if (!orderStatus.longTakeProfitExists) return position.longTakeProfitOrderId || '';
    } else {
      if (!orderStatus.shortStopLossExists) return position.shortStopLossOrderId || '';
      if (!orderStatus.shortTakeProfitExists) return position.shortTakeProfitOrderId || '';
    }
    return '';
  }

  /**
   * 創建交易所查詢服務
   */
  private async createExchangeService(
    exchange: string,
    userId: string,
  ): Promise<ExchangeQueryService> {
    // 獲取用戶的 API Key
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        userId,
        exchange,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new Error(`No API key found for ${exchange}`);
    }

    // 解密 API Key
    const decryptedKey: DecryptedApiKey = {
      apiKey: decrypt(apiKey.encryptedKey),
      secret: decrypt(apiKey.encryptedSecret),
      passphrase: apiKey.encryptedPassphrase
        ? decrypt(apiKey.encryptedPassphrase)
        : undefined,
    };

    // 創建服務
    const service = new ExchangeQueryService(exchange as any);
    await service.connect(decryptedKey);

    return service;
  }

  // ==================== Phase 4: US2 自動平倉 ====================

  /**
   * 處理單邊觸發事件
   * T017-T019, T021-T024
   */
  async handleTrigger(
    position: Position,
    triggerResult: TriggerResult,
  ): Promise<HandleTriggerResult> {
    // BOTH 類型應該由 handleBothTriggered 處理
    if (triggerResult.triggerType === 'BOTH') {
      await this.handleBothTriggered(position, triggerResult);
      return { success: true };
    }

    // 計算需要平倉的一邊
    const sideToClose = this.getOppositeSide(triggerResult.triggerType);
    const closeReason = this.triggerTypeToCloseReason(triggerResult.triggerType);

    logger.info(
      {
        positionId: position.id,
        triggerType: triggerResult.triggerType,
        triggeredExchange: triggerResult.triggeredExchange,
        sideToClose,
        closeReason,
      },
      '[條件單監控] 開始處理觸發事件：平倉對沖邊',
    );

    // 呼叫 PositionCloser.closeSingleSide()
    const closeResult = await this.positionCloser.closeSingleSide({
      userId: position.userId,
      positionId: position.id,
      side: sideToClose,
      closeReason,
    });

    if (!closeResult.success) {
      const errorMessage = closeResult.error || 'Unknown error';

      // 檢查是否為「無持倉可平」的錯誤（表示另一邊也已被觸發）
      const noPositionError = this.isNoPositionError(errorMessage);

      if (noPositionError) {
        logger.info(
          {
            positionId: position.id,
            triggerType: triggerResult.triggerType,
            sideToClose,
          },
          'No position to close - treating as both sides triggered',
        );

        // 判斷為雙邊觸發，直接更新狀態
        await this.prisma.position.update({
          where: { id: position.id },
          data: {
            status: 'CLOSED',
            closeReason: 'BOTH_TRIGGERED',
            closedAt: new Date(),
          },
        });

        logger.info(
          { positionId: position.id },
          'Position closed due to both sides triggered (detected via close failure)',
        );

        return { success: true };
      }

      // 其他錯誤：記錄並發送緊急通知
      logger.error(
        {
          positionId: position.id,
          triggerType: triggerResult.triggerType,
          error: errorMessage,
        },
        'Failed to close opposite side after trigger',
      );

      // T031: 發送緊急通知
      await this.sendEmergencyNotifications(position, triggerResult, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }

    // 取消被平倉那一邊的條件單（sideToClose 的條件單）
    logger.info(
      {
        positionId: position.id,
        side: sideToClose,
        exchange: sideToClose === 'LONG' ? position.longExchange : position.shortExchange,
        stopLossOrderId: sideToClose === 'LONG' ? position.longStopLossOrderId : position.shortStopLossOrderId,
        takeProfitOrderId: sideToClose === 'LONG' ? position.longTakeProfitOrderId : position.shortTakeProfitOrderId,
      },
      '[條件單監控] 開始取消被平倉一邊的條件單',
    );

    try {
      await this.positionCloser.cancelSingleSideConditionalOrders(position, sideToClose);
      logger.info(
        { positionId: position.id, side: sideToClose },
        '[條件單監控] 被平倉一邊的條件單已取消',
      );
    } catch (error) {
      logger.warn(
        {
          positionId: position.id,
          side: sideToClose,
          error: error instanceof Error ? error.message : String(error),
        },
        '[條件單監控] 取消條件單失敗（非致命錯誤）',
      );
    }

    logger.info(
      {
        positionId: position.id,
        triggerType: triggerResult.triggerType,
        closedSide: sideToClose,
      },
      '[條件單監控] 觸發事件處理完成',
    );

    // 創建 Trade 記錄
    try {
      await this.createTradeRecord(position, triggerResult, closeResult);
    } catch (tradeError) {
      logger.error(
        {
          positionId: position.id,
          error: tradeError instanceof Error ? tradeError.message : String(tradeError),
        },
        '[條件單監控] 創建 Trade 記錄失敗（非致命錯誤）',
      );
    }

    // T030: 發送觸發通知
    await this.sendTriggerNotifications(position, triggerResult, closeResult);

    return {
      success: true,
      closedSide: {
        side: sideToClose,
        exchange: sideToClose === 'LONG' ? position.longExchange : position.shortExchange,
        orderId: (closeResult as any).closedSide?.orderId ?? '',
      },
    };
  }

  /**
   * 處理雙邊同時觸發事件
   * T020
   */
  async handleBothTriggered(
    position: Position,
    _triggerResult: TriggerResult, // 雙邊觸發時不需要使用觸發結果
  ): Promise<HandleTriggerResult> {
    logger.info(
      {
        positionId: position.id,
        longExchange: position.longExchange,
        shortExchange: position.shortExchange,
      },
      'Both sides triggered - updating position status only',
    );

    // 雙邊都已觸發，只需更新狀態
    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
        closeReason: 'BOTH_TRIGGERED',
        closedAt: new Date(),
      },
    });

    logger.info(
      { positionId: position.id },
      'Position closed due to both sides triggered',
    );

    // 雙邊觸發也需要創建 Trade 記錄
    try {
      await this.createTradeRecordForBothTriggered(position);
    } catch (tradeError) {
      logger.error(
        {
          positionId: position.id,
          error: tradeError instanceof Error ? tradeError.message : String(tradeError),
        },
        '[條件單監控] 創建 Trade 記錄失敗（雙邊觸發，非致命錯誤）',
      );
    }

    return { success: true };
  }

  /**
   * 創建 Trade 記錄（單邊觸發後平倉）
   *
   * 當一邊條件單觸發後，系統自動平倉另一邊，需要創建交易記錄
   */
  private async createTradeRecord(
    position: Position,
    triggerResult: TriggerResult,
    closeResult: CloseSingleSideResult,
  ): Promise<void> {
    const closedAt = new Date();
    const triggeredSide = triggerResult.triggerType === 'LONG_SL' || triggerResult.triggerType === 'LONG_TP' ? 'LONG' : 'SHORT';
    const closedSide = this.getOppositeSide(triggerResult.triggerType);

    // 檢查平倉是否成功
    if (!closeResult.success) {
      logger.warn(
        { positionId: position.id },
        '[條件單監控] closeSingleSide 失敗，無法創建完整 Trade 記錄',
      );
      return;
    }

    // 從 closeResult 獲取系統平倉邊的資訊（成功時一定有 closedSide）
    const closedSideInfo = closeResult.closedSide;

    // 查詢觸發邊的成交資訊
    let triggeredExitPrice: Decimal;
    let triggeredFee: Decimal;

    try {
      const triggeredExchange = triggeredSide === 'LONG' ? position.longExchange : position.shortExchange;
      const triggeredOrderId = triggerResult.triggeredOrderId;

      const service = await this.createExchangeService(triggeredExchange, position.userId);
      const history = await service.fetchOrderHistory(position.symbol, triggeredOrderId);
      await service.disconnect();

      if (history && history.triggerPrice) {
        // 使用 triggerPrice 作為成交價格（條件單的觸發價格）
        triggeredExitPrice = new Decimal(history.triggerPrice);
        triggeredFee = new Decimal(0); // 手續費暫時無法獲取，設為 0
      } else {
        // 使用設定的停損/停利價格作為估計
        triggeredExitPrice = new Decimal(
          triggeredSide === 'LONG'
            ? (position.longStopLossPrice || position.longTakeProfitPrice || position.longEntryPrice)
            : (position.shortStopLossPrice || position.shortTakeProfitPrice || position.shortEntryPrice)
        );
        triggeredFee = new Decimal(0);
        logger.warn(
          { positionId: position.id, triggeredSide },
          '[條件單監控] 無法獲取觸發邊成交資訊，使用估計價格',
        );
      }
    } catch (error) {
      // 使用設定的停損/停利價格作為估計
      triggeredExitPrice = new Decimal(
        triggeredSide === 'LONG'
          ? (position.longStopLossPrice || position.longTakeProfitPrice || position.longEntryPrice)
          : (position.shortStopLossPrice || position.shortTakeProfitPrice || position.shortEntryPrice)
      );
      triggeredFee = new Decimal(0);
      logger.warn(
        {
          positionId: position.id,
          triggeredSide,
          error: error instanceof Error ? error.message : String(error),
        },
        '[條件單監控] 查詢觸發邊成交資訊失敗，使用估計價格',
      );
    }

    // 組合兩邊的出場資訊
    const longExitPrice = triggeredSide === 'LONG' ? triggeredExitPrice : closedSideInfo.price;
    const longFee = triggeredSide === 'LONG' ? triggeredFee : closedSideInfo.fee;
    const shortExitPrice = triggeredSide === 'SHORT' ? triggeredExitPrice : closedSideInfo.price;
    const shortFee = triggeredSide === 'SHORT' ? triggeredFee : closedSideInfo.fee;

    // 計算 PnL
    const pnlInput: PnLCalculationInput = {
      longEntryPrice: new Decimal(position.longEntryPrice),
      longExitPrice,
      longPositionSize: new Decimal(position.longPositionSize),
      longFee,
      shortEntryPrice: new Decimal(position.shortEntryPrice),
      shortExitPrice,
      shortPositionSize: new Decimal(position.shortPositionSize),
      shortFee,
      leverage: position.longLeverage || 10,
      openedAt: position.openedAt || new Date(),
      closedAt,
      fundingRatePnL: new Decimal(0), // 觸發平倉暫不計算資金費率
    };

    const pnlResult = calculatePnL(pnlInput);

    // 創建 Trade 記錄
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
        triggeredSide,
        closedSide,
        totalPnL: pnlResult.totalPnL.toString(),
        roi: pnlResult.roi.toString(),
      },
      '[條件單監控] Trade 記錄已創建',
    );
  }

  /**
   * 創建 Trade 記錄（雙邊同時觸發）
   *
   * 當兩邊條件單都觸發時，需要查詢兩邊的成交資訊來創建交易記錄
   */
  private async createTradeRecordForBothTriggered(position: Position): Promise<void> {
    const closedAt = new Date();

    // 查詢兩邊的成交資訊
    let longExitPrice: Decimal;
    let longFee: Decimal;
    let shortExitPrice: Decimal;
    let shortFee: Decimal;

    // 查詢 Long 邊
    try {
      const longService = await this.createExchangeService(position.longExchange, position.userId);
      const longOrderId = position.longStopLossOrderId || position.longTakeProfitOrderId;
      if (longOrderId) {
        const history = await longService.fetchOrderHistory(position.symbol, longOrderId);
        if (history && history.triggerPrice) {
          longExitPrice = new Decimal(history.triggerPrice);
          longFee = new Decimal(0);
        } else {
          longExitPrice = new Decimal(position.longStopLossPrice || position.longTakeProfitPrice || position.longEntryPrice);
          longFee = new Decimal(0);
        }
      } else {
        longExitPrice = new Decimal(position.longEntryPrice);
        longFee = new Decimal(0);
      }
      await longService.disconnect();
    } catch {
      longExitPrice = new Decimal(position.longStopLossPrice || position.longTakeProfitPrice || position.longEntryPrice);
      longFee = new Decimal(0);
    }

    // 查詢 Short 邊
    try {
      const shortService = await this.createExchangeService(position.shortExchange, position.userId);
      const shortOrderId = position.shortStopLossOrderId || position.shortTakeProfitOrderId;
      if (shortOrderId) {
        const history = await shortService.fetchOrderHistory(position.symbol, shortOrderId);
        if (history && history.triggerPrice) {
          shortExitPrice = new Decimal(history.triggerPrice);
          shortFee = new Decimal(0);
        } else {
          shortExitPrice = new Decimal(position.shortStopLossPrice || position.shortTakeProfitPrice || position.shortEntryPrice);
          shortFee = new Decimal(0);
        }
      } else {
        shortExitPrice = new Decimal(position.shortEntryPrice);
        shortFee = new Decimal(0);
      }
      await shortService.disconnect();
    } catch {
      shortExitPrice = new Decimal(position.shortStopLossPrice || position.shortTakeProfitPrice || position.shortEntryPrice);
      shortFee = new Decimal(0);
    }

    // 計算 PnL
    const pnlInput: PnLCalculationInput = {
      longEntryPrice: new Decimal(position.longEntryPrice),
      longExitPrice,
      longPositionSize: new Decimal(position.longPositionSize),
      longFee,
      shortEntryPrice: new Decimal(position.shortEntryPrice),
      shortExitPrice,
      shortPositionSize: new Decimal(position.shortPositionSize),
      shortFee,
      leverage: position.longLeverage || 10,
      openedAt: position.openedAt || new Date(),
      closedAt,
      fundingRatePnL: new Decimal(0),
    };

    const pnlResult = calculatePnL(pnlInput);

    // 創建 Trade 記錄
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
      '[條件單監控] Trade 記錄已創建（雙邊觸發）',
    );
  }

  /**
   * 根據觸發類型取得需要平倉的一邊
   */
  private getOppositeSide(triggerType: TriggerType): 'LONG' | 'SHORT' {
    // 如果 LONG 側觸發，需要平倉 SHORT 側
    if (triggerType === 'LONG_SL' || triggerType === 'LONG_TP') {
      return 'SHORT';
    }
    // 如果 SHORT 側觸發，需要平倉 LONG 側
    return 'LONG';
  }

  /**
   * 將觸發類型轉換為平倉原因
   */
  private triggerTypeToCloseReason(triggerType: TriggerType): CloseReason {
    switch (triggerType) {
      case 'LONG_SL':
        return 'LONG_SL_TRIGGERED';
      case 'LONG_TP':
        return 'LONG_TP_TRIGGERED';
      case 'SHORT_SL':
        return 'SHORT_SL_TRIGGERED';
      case 'SHORT_TP':
        return 'SHORT_TP_TRIGGERED';
      case 'BOTH':
        return 'BOTH_TRIGGERED';
      default:
        return 'MANUAL';
    }
  }

  /**
   * 檢查錯誤訊息是否表示「無持倉可平」
   * 各交易所的錯誤訊息不同，需要匹配多種格式
   */
  private isNoPositionError(errorMessage: string): boolean {
    const noPositionPatterns = [
      // BingX
      'No position to close',
      'no position',
      '101205',
      // Binance
      'ReduceOnly Order is rejected',
      'Position side does not match',
      '-2022',
      // OKX
      'Position does not exist',
      '51000',
      // Gate.io
      'position not found',
      'POSITION_NOT_FOUND',
    ];

    const lowerError = errorMessage.toLowerCase();
    return noPositionPatterns.some(
      (pattern) => lowerError.includes(pattern.toLowerCase()),
    );
  }

  // ==================== Phase 5: US3 通知功能 ====================

  /**
   * T030: 發送觸發通知到所有啟用的 Webhooks
   */
  async sendTriggerNotifications(
    position: Position,
    triggerResult: TriggerResult,
    closeResult: CloseSingleSideResult,
  ): Promise<void> {
    try {
      // 獲取用戶啟用的 Webhooks
      const webhooks = await this.prisma.notificationWebhook.findMany({
        where: {
          userId: position.userId,
          isEnabled: true,
        },
      });

      if (webhooks.length === 0) {
        logger.debug(
          { positionId: position.id },
          'No enabled webhooks for trigger notification',
        );
        return;
      }

      // 構建通知訊息
      const sideToClose = this.getOppositeSide(triggerResult.triggerType);
      const closedSideInfo = (closeResult as any).closedSide;

      const message = buildTriggerNotificationMessage({
        positionId: position.id,
        symbol: position.symbol,
        triggerType: triggerResult.triggerType as TriggerNotificationType,
        triggeredExchange: triggerResult.triggeredExchange,
        triggeredSide: triggerResult.triggerType === 'LONG_SL' || triggerResult.triggerType === 'LONG_TP' ? 'LONG' : 'SHORT',
        triggerPrice: undefined, // 目前沒有儲存觸發價格
        closedExchange: sideToClose === 'LONG' ? position.longExchange : position.shortExchange,
        closedSide: sideToClose,
        closePrice: closedSideInfo?.price,
        positionSize: Number(position.longPositionSize),
        leverage: position.longLeverage,
        openedAt: position.openedAt ?? new Date(),
        closedAt: new Date(),
        pnl: {
          priceDiffPnL: 0, // 目前由 closeResult 或 Trade 記錄提供
          fundingRatePnL: 0,
          totalFees: closedSideInfo?.fee ?? 0,
          totalPnL: 0,
          roi: 0,
        },
      });

      // 發送到各 Webhook
      for (const webhook of webhooks) {
        try {
          const notifier = webhook.platform === 'discord'
            ? this.discordNotifier
            : this.slackNotifier;

          await notifier.sendTriggerNotification(webhook.webhookUrl, message);

          logger.info(
            {
              positionId: position.id,
              webhookId: webhook.id,
              platform: webhook.platform,
            },
            'Trigger notification sent',
          );
        } catch (error) {
          logger.error(
            {
              positionId: position.id,
              webhookId: webhook.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to send trigger notification to webhook',
          );
        }
      }
    } catch (error) {
      logger.error(
        {
          positionId: position.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send trigger notifications',
      );
    }
  }

  // ==================== T038: WebSocket 事件推送 ====================

  /**
   * T038: 發送觸發偵測事件
   */
  emitTriggerDetected(
    positionId: string,
    triggerType: TriggerType,
    triggeredExchange: string,
    triggeredSide: 'LONG' | 'SHORT',
  ): void {
    triggerProgressEmitter.emitTriggerDetected({
      positionId,
      triggerType: triggerType as TriggerDetectedEvent['triggerType'],
      triggeredExchange,
      triggeredSide,
      detectedAt: new Date(),
    });
  }

  /**
   * T038: 發送觸發平倉進度事件
   */
  emitTriggerCloseProgress(
    positionId: string,
    step: TriggerCloseStep,
    exchange?: string,
    customMessage?: string,
  ): void {
    triggerProgressEmitter.emitTriggerCloseProgress({
      positionId,
      step,
      message: customMessage,
      exchange,
    });
  }

  /**
   * T038: 發送觸發平倉成功事件
   */
  emitTriggerCloseSuccess(
    positionId: string,
    triggerType: TriggerType,
    closedSide: {
      exchange: string;
      side: 'LONG' | 'SHORT';
      orderId: string;
      price: number;
      quantity: number;
      fee: number;
    },
    pnl: {
      priceDiffPnL: number;
      fundingRatePnL: number;
      totalFees: number;
      totalPnL: number;
      roi: number;
    },
  ): void {
    triggerProgressEmitter.emitTriggerCloseSuccess({
      positionId,
      triggerType: triggerType as TriggerCloseSuccessEvent['triggerType'],
      closedSide,
      pnl,
    });
  }

  /**
   * T038: 發送觸發平倉失敗事件
   */
  emitTriggerCloseFailed(
    positionId: string,
    triggerType: TriggerType,
    error: string,
    errorCode: string,
    requiresManualIntervention: boolean,
  ): void {
    triggerProgressEmitter.emitTriggerCloseFailed({
      positionId,
      triggerType: triggerType as TriggerCloseFailedEvent['triggerType'],
      error,
      errorCode,
      requiresManualIntervention,
    });
  }

  /**
   * T031: 發送緊急通知（平倉失敗時）
   */
  async sendEmergencyNotifications(
    position: Position,
    triggerResult: TriggerResult,
    error: string,
  ): Promise<void> {
    try {
      // 獲取用戶啟用的 Webhooks
      const webhooks = await this.prisma.notificationWebhook.findMany({
        where: {
          userId: position.userId,
          isEnabled: true,
        },
      });

      if (webhooks.length === 0) {
        logger.debug(
          { positionId: position.id },
          'No enabled webhooks for emergency notification',
        );
        return;
      }

      // 構建緊急通知訊息
      const message = buildEmergencyNotificationMessage({
        positionId: position.id,
        symbol: position.symbol,
        triggerType: triggerResult.triggerType as TriggerNotificationType,
        triggeredExchange: triggerResult.triggeredExchange,
        error,
        requiresManualIntervention: true,
      });

      // 發送到各 Webhook
      for (const webhook of webhooks) {
        try {
          const notifier = webhook.platform === 'discord'
            ? this.discordNotifier
            : this.slackNotifier;

          await notifier.sendEmergencyNotification(webhook.webhookUrl, message);

          logger.warn(
            {
              positionId: position.id,
              webhookId: webhook.id,
              platform: webhook.platform,
            },
            'Emergency notification sent',
          );
        } catch (notifyError) {
          logger.error(
            {
              positionId: position.id,
              webhookId: webhook.id,
              error: notifyError instanceof Error ? notifyError.message : String(notifyError),
            },
            'Failed to send emergency notification to webhook',
          );
        }
      }
    } catch (fetchError) {
      logger.error(
        {
          positionId: position.id,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        'Failed to send emergency notifications',
      );
    }
  }
}

export default ConditionalOrderMonitor;
