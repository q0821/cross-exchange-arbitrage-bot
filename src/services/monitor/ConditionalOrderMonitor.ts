/**
 * ConditionalOrderMonitor
 * Feature: 050-sl-tp-trigger-monitor
 *
 * 條件單觸發偵測監控服務
 * 每 30 秒檢查所有 OPEN 持倉的條件單狀態，偵測觸發事件
 */

import { PrismaClient, Position, CloseReason } from '@prisma/client';
import { logger } from '@/lib/logger';
import { ExchangeQueryService, DecryptedApiKey } from '@/lib/exchange-query-service';
import { decrypt } from '@/lib/encryption';
import { PositionCloser, CloseSingleSideResult } from '@/services/trading/PositionCloser';
import { DiscordNotifier } from '@/services/notification/DiscordNotifier';
import { SlackNotifier } from '@/services/notification/SlackNotifier';
import {
  buildTriggerNotificationMessage,
  buildEmergencyNotificationMessage,
  type BuildTriggerNotificationInput,
} from '@/services/notification/utils';
import type {
  TriggerNotificationMessage,
  EmergencyNotificationMessage,
  TriggerNotificationType,
} from '@/services/notification/types';
import {
  triggerProgressEmitter,
  type TriggerDetectedEvent,
  type TriggerCloseProgressEvent,
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
        logger.debug({}, 'No positions to check');
        return;
      }

      logger.debug(
        { count: positions.length },
        'Checking positions for conditional order triggers',
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
              'Conditional order trigger detected',
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
    // 檢查各個條件單是否存在
    const orderStatus = await this.checkAllOrdersExist(position);

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
      return null;
    }

    // 確認觸發
    const isLongSide = triggerType === 'LONG_SL' || triggerType === 'LONG_TP';
    const exchange = isLongSide ? position.longExchange : position.shortExchange;
    const orderId = this.getTriggeredOrderId(position, triggerType);

    const confirmed = await this.confirmTriggerWithHistory(
      exchange,
      position.userId,
      position.symbol,
      orderId,
    );

    if (!confirmed) {
      logger.debug(
        { positionId: position.id, triggerType, orderId },
        'Trigger not confirmed by order history',
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
        logger.warn(
          {
            positionId: position.id,
            exchange: position.longExchange,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to check long side orders',
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
        logger.warn(
          {
            positionId: position.id,
            exchange: position.shortExchange,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to check short side orders',
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
   */
  async confirmTriggerWithHistory(
    exchange: string,
    userId: string,
    symbol: string,
    orderId: string,
  ): Promise<boolean> {
    try {
      const service = await this.createExchangeService(exchange, userId);
      const history = await service.fetchOrderHistory(symbol, orderId);
      await service.disconnect();

      if (!history) {
        return false;
      }

      return history.status === 'TRIGGERED';
    } catch (error) {
      logger.warn(
        {
          exchange,
          orderId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to confirm trigger with order history',
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
      );
    }
    if (!orderStatus.longTakeProfitExists && position.longTakeProfitOrderId) {
      return await this.confirmTriggerWithHistory(
        position.longExchange,
        position.userId,
        position.symbol,
        position.longTakeProfitOrderId,
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
      );
    }
    if (!orderStatus.shortTakeProfitExists && position.shortTakeProfitOrderId) {
      return await this.confirmTriggerWithHistory(
        position.shortExchange,
        position.userId,
        position.symbol,
        position.shortTakeProfitOrderId,
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
        sideToClose,
        closeReason,
      },
      'Handling trigger: closing opposite side',
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

    // 取消另一邊的條件單
    try {
      await this.positionCloser.cancelSingleSideConditionalOrders(position, sideToClose);
      logger.info(
        { positionId: position.id, side: sideToClose },
        'Canceled conditional orders on closed side',
      );
    } catch (error) {
      logger.warn(
        {
          positionId: position.id,
          side: sideToClose,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to cancel conditional orders (non-fatal)',
      );
    }

    logger.info(
      {
        positionId: position.id,
        triggerType: triggerResult.triggerType,
        closedSide: sideToClose,
      },
      'Trigger handled successfully',
    );

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
    triggerResult: TriggerResult,
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

    return { success: true };
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
        openedAt: position.openedAt,
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
