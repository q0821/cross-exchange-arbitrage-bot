/**
 * TriggerProgressEmitter
 * Feature: 050-sl-tp-trigger-monitor (Phase 6: US4)
 *
 * 觸發事件 WebSocket 推送服務
 * 當條件單觸發時，向前端推送即時狀態更新
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../lib/logger';

// ==================== T032: WebSocket 事件類型定義 ====================

/**
 * 觸發類型
 */
export type TriggerType = 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP' | 'BOTH';

/**
 * 觸發平倉步驟
 */
export type TriggerCloseStep =
  | 'detected'           // 偵測到觸發
  | 'closing_opposite'   // 正在平倉對沖方
  | 'canceling_orders'   // 正在取消剩餘條件單
  | 'completing'         // 完成中
  | 'completed';         // 完成

/**
 * 觸發偵測事件
 */
export interface TriggerDetectedEvent {
  positionId: string;
  triggerType: TriggerType;
  triggeredExchange: string;
  triggeredSide: 'LONG' | 'SHORT';
  detectedAt: Date;
}

/**
 * 觸發平倉進度事件
 */
export interface TriggerCloseProgressEvent {
  positionId: string;
  step: TriggerCloseStep;
  progress: number;
  message: string;
  exchange?: string;
}

/**
 * 觸發平倉成功事件
 */
export interface TriggerCloseSuccessEvent {
  positionId: string;
  triggerType: TriggerType;
  closedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    orderId: string;
    price: number;
    quantity: number;
    fee: number;
  };
  pnl: {
    priceDiffPnL: number;
    fundingRatePnL: number;
    totalFees: number;
    totalPnL: number;
    roi: number;
  };
}

/**
 * 觸發平倉失敗事件
 */
export interface TriggerCloseFailedEvent {
  positionId: string;
  triggerType: TriggerType;
  error: string;
  errorCode: string;
  requiresManualIntervention: boolean;
}

/**
 * WebSocket 事件名稱
 */
export const TRIGGER_WS_EVENTS = {
  /** 觸發偵測到 */
  TRIGGER_DETECTED: 'position:trigger:detected',
  /** 觸發平倉進度 */
  TRIGGER_CLOSE_PROGRESS: 'position:trigger:close:progress',
  /** 觸發平倉成功 */
  TRIGGER_CLOSE_SUCCESS: 'position:trigger:close:success',
  /** 觸發平倉失敗 */
  TRIGGER_CLOSE_FAILED: 'position:trigger:close:failed',
} as const;

/**
 * 進度步驟對應的百分比
 */
const STEP_PROGRESS: Record<TriggerCloseStep, number> = {
  detected: 10,
  closing_opposite: 40,
  canceling_orders: 70,
  completing: 90,
  completed: 100,
};

/**
 * 進度步驟對應的訊息
 */
const STEP_MESSAGES: Record<TriggerCloseStep, string> = {
  detected: '偵測到條件單觸發',
  closing_opposite: '正在平倉對沖方...',
  canceling_orders: '正在取消剩餘條件單...',
  completing: '完成平倉處理中...',
  completed: '觸發平倉完成',
};

// ==================== T033: TriggerProgressEmitter 類別 ====================

/**
 * TriggerProgressEmitter
 *
 * 管理觸發事件的 WebSocket 推送
 */
export class TriggerProgressEmitter {
  private io: SocketIOServer | null = null;
  private static instance: TriggerProgressEmitter | null = null;

  /**
   * 獲取單例實例
   */
  static getInstance(): TriggerProgressEmitter {
    if (!TriggerProgressEmitter.instance) {
      TriggerProgressEmitter.instance = new TriggerProgressEmitter();
    }
    return TriggerProgressEmitter.instance;
  }

  /**
   * 初始化 Socket.IO 服務器
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('TriggerProgressEmitter initialized');
  }

  /**
   * 檢查是否已初始化
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * 獲取持倉房間名稱
   */
  private getPositionRoomName(positionId: string): string {
    return `position:${positionId}`;
  }

  // ==================== T034: emitTriggerDetected ====================

  /**
   * 發送觸發偵測事件
   */
  emitTriggerDetected(event: TriggerDetectedEvent): void {
    if (!this.io) {
      logger.warn('TriggerProgressEmitter not initialized');
      return;
    }

    const roomName = this.getPositionRoomName(event.positionId);
    this.io.to(roomName).emit(TRIGGER_WS_EVENTS.TRIGGER_DETECTED, event);

    logger.debug(
      {
        positionId: event.positionId,
        triggerType: event.triggerType,
        triggeredExchange: event.triggeredExchange,
      },
      'Trigger detected event emitted',
    );
  }

  // ==================== T035: emitTriggerCloseProgress ====================

  /**
   * 發送觸發平倉進度事件
   */
  emitTriggerCloseProgress(event: {
    positionId: string;
    step: TriggerCloseStep;
    progress?: number;
    message?: string;
    exchange?: string;
  }): void {
    if (!this.io) {
      logger.warn('TriggerProgressEmitter not initialized');
      return;
    }

    const progressEvent: TriggerCloseProgressEvent = {
      positionId: event.positionId,
      step: event.step,
      progress: event.progress ?? STEP_PROGRESS[event.step],
      message: event.message ?? STEP_MESSAGES[event.step],
      exchange: event.exchange,
    };

    const roomName = this.getPositionRoomName(event.positionId);
    this.io.to(roomName).emit(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS, progressEvent);

    logger.debug(
      {
        positionId: event.positionId,
        step: event.step,
        progress: progressEvent.progress,
      },
      'Trigger close progress emitted',
    );
  }

  // ==================== T036: emitTriggerCloseSuccess ====================

  /**
   * 發送觸發平倉成功事件
   */
  emitTriggerCloseSuccess(event: TriggerCloseSuccessEvent): void {
    if (!this.io) {
      logger.warn('TriggerProgressEmitter not initialized');
      return;
    }

    const roomName = this.getPositionRoomName(event.positionId);
    this.io.to(roomName).emit(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_SUCCESS, event);

    logger.info(
      {
        positionId: event.positionId,
        triggerType: event.triggerType,
        closedExchange: event.closedSide.exchange,
        totalPnL: event.pnl.totalPnL,
      },
      'Trigger close success event emitted',
    );
  }

  // ==================== T037: emitTriggerCloseFailed ====================

  /**
   * 發送觸發平倉失敗事件
   */
  emitTriggerCloseFailed(event: TriggerCloseFailedEvent): void {
    if (!this.io) {
      logger.warn('TriggerProgressEmitter not initialized');
      return;
    }

    const roomName = this.getPositionRoomName(event.positionId);
    this.io.to(roomName).emit(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_FAILED, event);

    logger.warn(
      {
        positionId: event.positionId,
        triggerType: event.triggerType,
        error: event.error,
        requiresManualIntervention: event.requiresManualIntervention,
      },
      'Trigger close failed event emitted',
    );
  }

  /**
   * 向特定用戶發送事件（通過用戶房間）
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('TriggerProgressEmitter not initialized');
      return;
    }

    const userRoom = `user:${userId}`;
    this.io.to(userRoom).emit(event, data);
  }
}

/**
 * 導出單例訪問方法
 */
export const triggerProgressEmitter = TriggerProgressEmitter.getInstance();

export default TriggerProgressEmitter;
