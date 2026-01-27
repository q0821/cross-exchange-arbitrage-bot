/**
 * TriggerDetector
 * Feature: 052-specify-scripts-bash
 * Task: T045, T046
 *
 * 從 WebSocket 事件偵測停損/停利觸發
 * - 監聯 ORDER_TRADE_UPDATE 事件
 * - 比對本地 Position 記錄
 * - 偵測到觸發時發送通知並啟動對沖腿平倉
 *
 * T046: 整合 PositionCloser 自動平倉
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import { logger } from '../../lib/logger';
import type { ExchangeName } from '../../connectors/types';
import type {
  OrderStatusChanged,
  TriggerDetected,
  TriggerType,
  TriggerCloseProgress,
} from '../../types/internal-events';
import type { DataStructureStats, Monitorable } from '../../types/memory-stats';
import type { CloseReason } from '@/generated/prisma/client';
import type { PositionCloser } from '../trading/PositionCloser';

// ==================== 類型定義 ====================

/**
 * 監控的持倉記錄
 */
export interface MonitoredPosition {
  id: string;
  userId: string;  // T046: 用於自動平倉
  symbol: string;
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  longSize: Decimal;
  shortSize: Decimal;
  longEntryPrice: Decimal;
  shortEntryPrice: Decimal;
  stopLossEnabled: boolean;
  takeProfitEnabled: boolean;
  longStopLossPrice?: Decimal;
  longTakeProfitPrice?: Decimal;
  shortStopLossPrice?: Decimal;
  shortTakeProfitPrice?: Decimal;
  conditionalOrderStatus: 'PENDING' | 'SET' | 'PARTIAL' | 'FAILED';
}

/**
 * TriggerDetector 選項
 */
export interface TriggerDetectorOptions {
  /** 價格容忍度 (百分比) */
  priceTolerance?: number;
  /** 是否去重複 */
  deduplicateTriggers?: boolean;
  /** 去重複時間窗口 (毫秒) */
  deduplicateWindowMs?: number;
  /** T046: PositionCloser 實例（用於自動平倉） */
  positionCloser?: PositionCloser;
  /** T046: 是否啟用自動平倉 */
  autoCloseEnabled?: boolean;
}

// ==================== TriggerDetector 類別 ====================

/**
 * TriggerDetector
 *
 * 從 WebSocket 訂單事件偵測停損/停利觸發
 */
export class TriggerDetector extends EventEmitter implements Monitorable {
  private static instance: TriggerDetector | null = null;
  private positions: Map<string, MonitoredPosition> = new Map();
  private processedOrders: Map<string, number> = new Map(); // orderId -> timestamp
  private closingPositions: Set<string> = new Set(); // 正在平倉的持倉 ID
  private options: Required<Omit<TriggerDetectorOptions, 'positionCloser'>> & { positionCloser?: PositionCloser };
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor(options?: TriggerDetectorOptions) {
    super();
    this.options = {
      priceTolerance: options?.priceTolerance ?? 0.01, // 1%
      deduplicateTriggers: options?.deduplicateTriggers ?? true,
      deduplicateWindowMs: options?.deduplicateWindowMs ?? 60000, // 1 分鐘
      positionCloser: options?.positionCloser,
      autoCloseEnabled: options?.autoCloseEnabled ?? true,
    };

    // 定期清理過期的處理記錄
    this.cleanupTimer = setInterval(() => this.cleanupProcessedOrders(), 60000);
  }

  /**
   * 獲取單例實例
   */
  static getInstance(options?: TriggerDetectorOptions): TriggerDetector {
    if (!TriggerDetector.instance) {
      TriggerDetector.instance = new TriggerDetector(options);
    }
    return TriggerDetector.instance;
  }

  /**
   * 重置單例 (僅用於測試)
   */
  static resetInstance(): void {
    if (TriggerDetector.instance) {
      TriggerDetector.instance.destroy();
      TriggerDetector.instance = null;
    }
  }

  /**
   * 註冊要監控的持倉
   */
  registerPosition(position: MonitoredPosition): void {
    this.positions.set(position.id, position);

    logger.debug(
      {
        positionId: position.id,
        symbol: position.symbol,
        stopLossEnabled: position.stopLossEnabled,
        takeProfitEnabled: position.takeProfitEnabled,
      },
      'Position registered for trigger monitoring'
    );
  }

  /**
   * 取消註冊持倉
   */
  unregisterPosition(positionId: string): void {
    this.positions.delete(positionId);
    logger.debug({ positionId }, 'Position unregistered from trigger monitoring');
  }

  /**
   * 處理訂單狀態變更事件
   */
  handleOrderStatusChanged(event: OrderStatusChanged): TriggerDetected | null {
    // 檢查是否已處理
    const orderKey = `${event.exchange}:${event.orderId}`;
    if (this.isOrderProcessed(orderKey)) {
      return null;
    }

    // 只處理已成交的訂單
    if (event.status !== 'FILLED') {
      return null;
    }

    // 只處理條件單
    if (!this.isConditionalOrder(event.orderType)) {
      return null;
    }

    // 尋找匹配的持倉
    const matchingPosition = this.findMatchingPosition(event);
    if (!matchingPosition) {
      logger.debug(
        {
          exchange: event.exchange,
          symbol: event.symbol,
          orderId: event.orderId,
          orderType: event.orderType,
        },
        'No matching position found for conditional order'
      );
      return null;
    }

    // 確定觸發類型
    const triggerType = this.determineTriggerType(event, matchingPosition);
    if (!triggerType) {
      return null;
    }

    // 標記為已處理
    this.markOrderProcessed(orderKey);

    // 建立觸發事件
    const triggerEvent: TriggerDetected = {
      positionId: matchingPosition.id,
      exchange: event.exchange,
      symbol: event.symbol,
      triggerType,
      triggerPrice: event.stopPrice || event.avgPrice,
      currentMarkPrice: event.avgPrice,
      detectedAt: new Date(),
      source: event.source,
    };

    logger.info(
      {
        positionId: matchingPosition.id,
        triggerType,
        exchange: event.exchange,
        symbol: event.symbol,
        triggerPrice: triggerEvent.triggerPrice.toString(),
      },
      'Trigger detected via WebSocket'
    );

    this.emit('triggerDetected', triggerEvent);

    // T046: 自動平倉對沖腿
    if (this.options.autoCloseEnabled && this.options.positionCloser) {
      this.executeAutoClose(matchingPosition, triggerType, triggerEvent).catch((error) => {
        logger.error(
          {
            positionId: matchingPosition.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Auto close failed'
        );
      });
    }

    return triggerEvent;
  }

  /**
   * 設定 PositionCloser (用於依賴注入)
   * Feature: T046
   */
  setPositionCloser(positionCloser: PositionCloser): void {
    this.options.positionCloser = positionCloser;
    logger.info('PositionCloser set for TriggerDetector auto-close');
  }

  /**
   * 設定自動平倉開關
   * Feature: T046
   */
  setAutoCloseEnabled(enabled: boolean): void {
    this.options.autoCloseEnabled = enabled;
    logger.info({ enabled }, 'Auto-close enabled state changed');
  }

  /**
   * 執行自動平倉
   * Feature: T046
   */
  private async executeAutoClose(
    position: MonitoredPosition,
    triggerType: TriggerType,
    triggerEvent: TriggerDetected
  ): Promise<void> {
    const positionId = position.id;

    // 避免重複平倉
    if (this.closingPositions.has(positionId)) {
      logger.warn({ positionId }, 'Position is already being closed, skipping');
      return;
    }

    if (!this.options.positionCloser) {
      logger.warn({ positionId }, 'PositionCloser not configured, skipping auto-close');
      return;
    }

    this.closingPositions.add(positionId);

    try {
      // 發送開始平倉進度事件
      this.emitCloseProgress(positionId, 'detecting', 10, '觸發偵測完成，準備平倉對沖腿', triggerEvent);

      // 確定需要平倉的對沖腿
      const hedgeSide = this.getHedgeSide(triggerType);
      const closeReason = this.mapTriggerTypeToCloseReason(triggerType);

      this.emitCloseProgress(positionId, 'closing_hedge_leg', 30, `正在平倉${hedgeSide}腿...`, triggerEvent);

      // 執行對沖腿平倉
      const result = await this.options.positionCloser.closeSingleSide({
        userId: position.userId,
        positionId,
        side: hedgeSide,
        closeReason,
      });

      if (result.success) {
        this.emitCloseProgress(positionId, 'completed', 100, '對沖腿平倉成功', triggerEvent);

        logger.info(
          {
            positionId,
            side: hedgeSide,
            triggerType,
          },
          'Auto-close hedge leg completed successfully'
        );
      } else {
        this.emitCloseProgress(positionId, 'failed', 100, `對沖腿平倉失敗: ${result.error}`, triggerEvent);

        logger.error(
          {
            positionId,
            side: hedgeSide,
            error: result.error,
          },
          'Auto-close hedge leg failed'
        );
      }

      // 從監控中移除已處理的持倉
      this.unregisterPosition(positionId);

    } finally {
      this.closingPositions.delete(positionId);
    }
  }

  /**
   * 根據觸發類型獲取對沖腿
   */
  private getHedgeSide(triggerType: TriggerType): 'LONG' | 'SHORT' {
    // LONG_SL/LONG_TP 表示 LONG 腿觸發，需要平 SHORT 腿
    // SHORT_SL/SHORT_TP 表示 SHORT 腿觸發，需要平 LONG 腿
    if (triggerType === 'LONG_SL' || triggerType === 'LONG_TP') {
      return 'SHORT';
    }
    return 'LONG';
  }

  /**
   * 映射觸發類型到關閉原因
   */
  private mapTriggerTypeToCloseReason(triggerType: TriggerType): CloseReason {
    switch (triggerType) {
      case 'LONG_SL':
        return 'LONG_SL_TRIGGERED';
      case 'LONG_TP':
        return 'LONG_TP_TRIGGERED';
      case 'SHORT_SL':
        return 'SHORT_SL_TRIGGERED';
      case 'SHORT_TP':
        return 'SHORT_TP_TRIGGERED';
    }
  }

  /**
   * 發送平倉進度事件
   */
  private emitCloseProgress(
    positionId: string,
    step: TriggerCloseProgress['step'],
    progress: number,
    message: string,
    triggerEvent: TriggerDetected
  ): void {
    const progressEvent: TriggerCloseProgress = {
      positionId,
      step,
      progress,
      message,
      details: {
        triggeredLeg: {
          exchange: triggerEvent.exchange,
          symbol: triggerEvent.symbol,
          side: triggerEvent.triggerType.startsWith('LONG') ? 'LONG' : 'SHORT',
          status: 'triggered',
        },
      },
      timestamp: new Date(),
    };

    this.emit('closeProgress', progressEvent);
  }

  /**
   * 尋找匹配的持倉
   */
  private findMatchingPosition(event: OrderStatusChanged): MonitoredPosition | null {
    for (const [, position] of this.positions) {
      // 符號必須匹配
      if (position.symbol !== event.symbol) {
        continue;
      }

      // 交易所必須是持倉的一腿
      const isLongLeg = position.longExchange === event.exchange;
      const isShortLeg = position.shortExchange === event.exchange;

      if (!isLongLeg && !isShortLeg) {
        continue;
      }

      // 條件單狀態必須是 SET
      if (position.conditionalOrderStatus !== 'SET') {
        continue;
      }

      return position;
    }

    return null;
  }

  /**
   * 確定觸發類型
   */
  private determineTriggerType(
    event: OrderStatusChanged,
    position: MonitoredPosition
  ): TriggerType | null {
    const isLongLeg = position.longExchange === event.exchange;
    const isShortLeg = position.shortExchange === event.exchange;

    const isStopLoss = this.isStopLossOrder(event);
    const isTakeProfit = this.isTakeProfitOrder(event);

    // LONG 腿觸發
    if (isLongLeg && event.positionSide === 'LONG') {
      if (isStopLoss && position.stopLossEnabled) {
        return 'LONG_SL';
      }
      if (isTakeProfit && position.takeProfitEnabled) {
        return 'LONG_TP';
      }
    }

    // SHORT 腿觸發
    if (isShortLeg && event.positionSide === 'SHORT') {
      if (isStopLoss && position.stopLossEnabled) {
        return 'SHORT_SL';
      }
      if (isTakeProfit && position.takeProfitEnabled) {
        return 'SHORT_TP';
      }
    }

    return null;
  }

  /**
   * 檢查是否為條件單
   */
  private isConditionalOrder(orderType: string): boolean {
    const conditionalTypes = [
      'STOP_MARKET',
      'TAKE_PROFIT_MARKET',
      'STOP',
      'TAKE_PROFIT',
      'stop_loss',
      'take_profit',
      'trigger',
      'conditional',
    ];

    return conditionalTypes.includes(orderType.toLowerCase()) ||
           conditionalTypes.includes(orderType);
  }

  /**
   * 檢查是否為停損單
   */
  private isStopLossOrder(event: OrderStatusChanged): boolean {
    const orderType = event.orderType.toLowerCase();

    // 明確的停損單類型
    if (
      orderType === 'stop_market' ||
      orderType === 'stop_loss' ||
      orderType === 'stop'
    ) {
      return true;
    }

    // 透過實現損益判斷 (虧損)
    if (orderType === 'trigger' && event.realizedPnl && event.realizedPnl.lt(0)) {
      return true;
    }

    return false;
  }

  /**
   * 檢查是否為停利單
   */
  private isTakeProfitOrder(event: OrderStatusChanged): boolean {
    const orderType = event.orderType.toLowerCase();

    // 明確的停利單類型
    if (
      orderType === 'take_profit_market' ||
      orderType === 'take_profit'
    ) {
      return true;
    }

    // 透過實現損益判斷 (獲利)
    if (orderType === 'trigger' && event.realizedPnl && event.realizedPnl.gte(0)) {
      return true;
    }

    return false;
  }

  /**
   * 驗證觸發價格
   */
  validateTriggerPrice(
    event: OrderStatusChanged,
    position: MonitoredPosition,
    triggerType: TriggerType
  ): boolean {
    let expectedPrice: Decimal | undefined;

    switch (triggerType) {
      case 'LONG_SL':
        expectedPrice = position.longStopLossPrice;
        break;
      case 'LONG_TP':
        expectedPrice = position.longTakeProfitPrice;
        break;
      case 'SHORT_SL':
        expectedPrice = position.shortStopLossPrice;
        break;
      case 'SHORT_TP':
        expectedPrice = position.shortTakeProfitPrice;
        break;
    }

    if (!expectedPrice || !event.stopPrice) {
      return false;
    }

    const diff = event.stopPrice.minus(expectedPrice).abs();
    const percentDiff = diff.div(expectedPrice);

    return percentDiff.lte(this.options.priceTolerance);
  }

  /**
   * 檢查訂單是否已處理
   */
  private isOrderProcessed(orderKey: string): boolean {
    if (!this.options.deduplicateTriggers) {
      return false;
    }

    const timestamp = this.processedOrders.get(orderKey);
    if (!timestamp) {
      return false;
    }

    // 檢查是否在去重視窗內
    return Date.now() - timestamp < this.options.deduplicateWindowMs;
  }

  /**
   * 標記訂單為已處理
   */
  private markOrderProcessed(orderKey: string): void {
    if (this.options.deduplicateTriggers) {
      this.processedOrders.set(orderKey, Date.now());
    }
  }

  /**
   * 清理過期的處理記錄
   */
  private cleanupProcessedOrders(): void {
    const now = Date.now();
    const expireThreshold = this.options.deduplicateWindowMs * 2;

    for (const [key, timestamp] of this.processedOrders) {
      if (now - timestamp > expireThreshold) {
        this.processedOrders.delete(key);
      }
    }
  }

  /**
   * 取得已註冊的持倉
   */
  getRegisteredPositions(): MonitoredPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * 取得已註冊持倉數量
   */
  getRegisteredPositionCount(): number {
    return this.positions.size;
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const positionsSize = this.positions.size;
    const processedOrdersSize = this.processedOrders.size;
    const closingPositionsSize = this.closingPositions.size;

    return {
      name: 'TriggerDetector',
      sizes: {
        positions: positionsSize,
        processedOrders: processedOrdersSize,
        closingPositions: closingPositionsSize,
      },
      totalItems: positionsSize + processedOrdersSize + closingPositionsSize,
    };
  }

  /**
   * 清除所有狀態
   */
  clear(): void {
    this.positions.clear();
    this.processedOrders.clear();
  }

  /**
   * 銷毀偵測器
   */
  destroy(): void {
    // 清理定時器以防止記憶體泄漏
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
    this.removeAllListeners();
    logger.debug('TriggerDetector destroyed');
  }
}

/**
 * 導出單例訪問方法
 */
export const triggerDetector = TriggerDetector.getInstance();

export default TriggerDetector;
