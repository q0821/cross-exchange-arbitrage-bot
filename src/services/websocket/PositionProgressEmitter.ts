/**
 * PositionProgressEmitter
 *
 * WebSocket 開倉進度推送服務
 * Feature: 033-manual-open-position
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../lib/logger';
import type {
  PositionProgressEvent,
  PositionSuccessEvent,
  PositionFailedEvent,
  RollbackFailedEvent,
  OpenPositionStep,
  ClosePositionStep,
  CloseProgressEvent,
  CloseSuccessEvent,
  CloseFailedEvent,
  ClosePartialEvent,
  SupportedExchange,
  TradeSide,
  ConditionalOrderStatus,
} from '../../types/trading';

/**
 * WebSocket 事件名稱
 */
const WS_EVENTS = {
  /** 加入持倉進度房間 */
  JOIN_POSITION_ROOM: 'position:join',
  /** 離開持倉進度房間 */
  LEAVE_POSITION_ROOM: 'position:leave',
  /** 開倉進度更新 */
  POSITION_PROGRESS: 'position:progress',
  /** 開倉成功 */
  POSITION_SUCCESS: 'position:success',
  /** 開倉失敗 */
  POSITION_FAILED: 'position:failed',
  /** 回滾失敗（需手動處理） */
  ROLLBACK_FAILED: 'position:rollback_failed',
  // ============================================================================
  // Close Position Events (Feature: 035-close-position)
  // ============================================================================
  /** 平倉進度更新 */
  CLOSE_PROGRESS: 'position:close:progress',
  /** 平倉成功 */
  CLOSE_SUCCESS: 'position:close:success',
  /** 平倉失敗 */
  CLOSE_FAILED: 'position:close:failed',
  /** 部分平倉（需手動處理） */
  CLOSE_PARTIAL: 'position:close:partial',
  // ============================================================================
  // Conditional Order Events (Feature: 038-specify-scripts-bash)
  // ============================================================================
  /** 條件單設定進度更新 */
  CONDITIONAL_ORDER_PROGRESS: 'position:conditional:progress',
  /** 條件單設定成功 */
  CONDITIONAL_ORDER_SUCCESS: 'position:conditional:success',
  /** 條件單設定失敗 */
  CONDITIONAL_ORDER_FAILED: 'position:conditional:failed',
  /** 條件單部分設定成功 */
  CONDITIONAL_ORDER_PARTIAL: 'position:conditional:partial',
  // ============================================================================
  // Batch Close Events (Feature: 069-position-group-close)
  // ============================================================================
  /** 加入批量平倉房間 */
  JOIN_BATCH_CLOSE_ROOM: 'batch:join',
  /** 離開批量平倉房間 */
  LEAVE_BATCH_CLOSE_ROOM: 'batch:leave',
  /** 批量平倉進度更新 */
  BATCH_CLOSE_PROGRESS: 'batch:close:progress',
  /** 批量平倉單個持倉完成 */
  BATCH_CLOSE_POSITION_COMPLETE: 'batch:close:position:complete',
  /** 批量平倉全部完成 */
  BATCH_CLOSE_COMPLETE: 'batch:close:complete',
  /** 批量平倉失敗 */
  BATCH_CLOSE_FAILED: 'batch:close:failed',
} as const;

/**
 * 進度步驟對應的百分比
 */
const STEP_PROGRESS: Record<OpenPositionStep, number> = {
  validating: 10,
  executing_long: 30,
  executing_short: 60,
  completing: 90,
  rolling_back: 50,
};

/**
 * 進度步驟對應的訊息
 */
const STEP_MESSAGES: Record<OpenPositionStep, string> = {
  validating: '驗證餘額中...',
  executing_long: '執行做多開倉...',
  executing_short: '執行做空開倉...',
  completing: '完成開倉...',
  rolling_back: '執行回滾...',
};

// ============================================================================
// Close Position Progress Constants (Feature: 035-close-position)
// ============================================================================

/**
 * 平倉進度步驟對應的百分比
 */
const CLOSE_STEP_PROGRESS: Record<ClosePositionStep, number> = {
  validating: 10,
  closing_long: 30,
  closing_short: 60,
  calculating_pnl: 80,
  completing: 100,
};

/**
 * 平倉進度步驟對應的訊息
 */
const CLOSE_STEP_MESSAGES: Record<ClosePositionStep, string> = {
  validating: '驗證持倉狀態...',
  closing_long: '正在平倉多頭...',
  closing_short: '正在平倉空頭...',
  calculating_pnl: '計算損益中...',
  completing: '平倉完成',
};

/**
 * PositionProgressEmitter
 *
 * 管理 WebSocket 房間和推送開倉進度
 */
export class PositionProgressEmitter {
  private io: SocketIOServer | null = null;
  private static instance: PositionProgressEmitter | null = null;

  /**
   * 獲取單例實例
   */
  static getInstance(): PositionProgressEmitter {
    if (!PositionProgressEmitter.instance) {
      PositionProgressEmitter.instance = new PositionProgressEmitter();
    }
    return PositionProgressEmitter.instance;
  }

  /**
   * 初始化 Socket.IO 服務器
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupEventHandlers();
    logger.info('PositionProgressEmitter initialized');
  }

  /**
   * 設置事件處理器
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.debug({ socketId: socket.id }, 'Client connected to position namespace');

      // 加入持倉進度房間
      socket.on(WS_EVENTS.JOIN_POSITION_ROOM, (positionId: string) => {
        const roomName = this.getPositionRoomName(positionId);
        socket.join(roomName);
        logger.debug({ socketId: socket.id, positionId, roomName }, 'Client joined position room');
      });

      // 離開持倉進度房間
      socket.on(WS_EVENTS.LEAVE_POSITION_ROOM, (positionId: string) => {
        const roomName = this.getPositionRoomName(positionId);
        socket.leave(roomName);
        logger.debug({ socketId: socket.id, positionId, roomName }, 'Client left position room');
      });

      // Feature 069: 批量平倉房間
      // 加入批量平倉房間
      socket.on(WS_EVENTS.JOIN_BATCH_CLOSE_ROOM, (groupId: string) => {
        const roomName = this.getBatchCloseRoomName(groupId);
        socket.join(roomName);
        logger.debug({ socketId: socket.id, groupId, roomName }, 'Client joined batch close room');
      });

      // 離開批量平倉房間
      socket.on(WS_EVENTS.LEAVE_BATCH_CLOSE_ROOM, (groupId: string) => {
        const roomName = this.getBatchCloseRoomName(groupId);
        socket.leave(roomName);
        logger.debug({ socketId: socket.id, groupId, roomName }, 'Client left batch close room');
      });

      socket.on('disconnect', () => {
        logger.debug({ socketId: socket.id }, 'Client disconnected from position namespace');
      });
    });
  }

  /**
   * 獲取持倉房間名稱
   */
  private getPositionRoomName(positionId: string): string {
    return `position:${positionId}`;
  }

  /**
   * 獲取批量平倉房間名稱
   * Feature: 069-position-group-close
   */
  private getBatchCloseRoomName(groupId: string): string {
    return `batch:${groupId}`;
  }

  /**
   * 發送進度更新
   */
  emitProgress(
    positionId: string,
    step: OpenPositionStep,
    exchange?: SupportedExchange,
    customMessage?: string,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: PositionProgressEvent = {
      positionId,
      step,
      progress: STEP_PROGRESS[step],
      message: customMessage || STEP_MESSAGES[step],
      exchange,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.POSITION_PROGRESS, event);

    logger.debug({ positionId, step, progress: event.progress }, 'Position progress emitted');
  }

  /**
   * 發送開倉成功事件
   */
  emitSuccess(
    positionId: string,
    longTrade: {
      exchange: SupportedExchange;
      orderId: string;
      price: string;
      quantity: string;
      fee: string;
    },
    shortTrade: {
      exchange: SupportedExchange;
      orderId: string;
      price: string;
      quantity: string;
      fee: string;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: PositionSuccessEvent = {
      positionId,
      longTrade,
      shortTrade,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.POSITION_SUCCESS, event);

    logger.info({ positionId }, 'Position success event emitted');
  }

  /**
   * 發送開倉失敗事件
   */
  emitFailed(
    positionId: string,
    error: string,
    errorCode: string,
    details?: {
      exchange?: SupportedExchange;
      rolledBack?: boolean;
      requiresManualIntervention?: boolean;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: PositionFailedEvent = {
      positionId,
      error,
      errorCode,
      details,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.POSITION_FAILED, event);

    logger.warn({ positionId, error, errorCode }, 'Position failed event emitted');
  }

  /**
   * 發送回滾失敗事件（需要手動處理）
   */
  emitRollbackFailed(
    positionId: string,
    exchange: SupportedExchange,
    orderId: string,
    side: 'LONG' | 'SHORT',
    quantity: string,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: RollbackFailedEvent = {
      positionId,
      exchange,
      orderId,
      side,
      quantity,
      message: `無法自動回滾 ${exchange} ${side} 倉位（訂單 ${orderId}），請手動處理`,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.ROLLBACK_FAILED, event);

    logger.error({ positionId, exchange, orderId, side, quantity }, 'Rollback failed event emitted');
  }

  /**
   * 向特定用戶發送事件（通過用戶房間）
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const userRoom = `user:${userId}`;
    this.io.to(userRoom).emit(event, data);
  }

  /**
   * 讓用戶加入其專屬房間
   */
  joinUserRoom(socket: Socket, userId: string): void {
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.debug({ socketId: socket.id, userId, userRoom }, 'Client joined user room');
  }

  /**
   * 檢查是否已初始化
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  // ============================================================================
  // Close Position Events (Feature: 035-close-position)
  // ============================================================================

  /**
   * 發送平倉進度更新
   */
  emitCloseProgress(
    positionId: string,
    step: ClosePositionStep,
    exchange?: SupportedExchange,
    customMessage?: string,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: CloseProgressEvent = {
      positionId,
      step,
      progress: CLOSE_STEP_PROGRESS[step],
      message: customMessage || CLOSE_STEP_MESSAGES[step],
      exchange,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CLOSE_PROGRESS, event);

    logger.debug({ positionId, step, progress: event.progress }, 'Close position progress emitted');
  }

  /**
   * 發送平倉成功事件
   */
  emitCloseSuccess(
    positionId: string,
    trade: {
      id: string;
      priceDiffPnL: string;
      fundingRatePnL: string;
      totalPnL: string;
      roi: string;
      holdingDuration: number;
    },
    longClose: {
      exchange: SupportedExchange;
      orderId: string;
      price: string;
      quantity: string;
      fee: string;
    },
    shortClose: {
      exchange: SupportedExchange;
      orderId: string;
      price: string;
      quantity: string;
      fee: string;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: CloseSuccessEvent = {
      positionId,
      trade,
      longClose,
      shortClose,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CLOSE_SUCCESS, event);

    logger.info({ positionId, tradeId: trade.id, totalPnL: trade.totalPnL }, 'Close success event emitted');
  }

  /**
   * 發送平倉失敗事件
   */
  emitCloseFailed(
    positionId: string,
    error: string,
    errorCode: string,
    details?: {
      exchange?: SupportedExchange;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: CloseFailedEvent = {
      positionId,
      error,
      errorCode,
      details,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CLOSE_FAILED, event);

    logger.warn({ positionId, error, errorCode }, 'Close failed event emitted');
  }

  /**
   * 發送部分平倉事件（一邊成功，另一邊失敗）
   */
  emitClosePartial(
    positionId: string,
    message: string,
    closedSide: {
      exchange: SupportedExchange;
      side: TradeSide;
      orderId: string;
      price: string;
      quantity: string;
      fee: string;
    },
    failedSide: {
      exchange: SupportedExchange;
      side: TradeSide;
      error: string;
      errorCode: string;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event: ClosePartialEvent = {
      positionId,
      message,
      closedSide,
      failedSide,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CLOSE_PARTIAL, event);

    logger.warn(
      { positionId, closedExchange: closedSide.exchange, failedExchange: failedSide.exchange },
      'Close partial event emitted',
    );
  }

  // ============================================================================
  // Conditional Order Events (Feature: 038-specify-scripts-bash)
  // ============================================================================

  /**
   * 發送條件單設定進度更新
   */
  emitConditionalOrderProgress(
    positionId: string,
    status: ConditionalOrderStatus,
    message: string,
    exchange?: SupportedExchange,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      positionId,
      status,
      message,
      exchange,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CONDITIONAL_ORDER_PROGRESS, event);

    logger.debug({ positionId, status, message }, 'Conditional order progress emitted');
  }

  /**
   * 發送條件單設定成功事件
   */
  emitConditionalOrderSuccess(
    positionId: string,
    details: {
      stopLossEnabled: boolean;
      stopLossPercent?: number;
      takeProfitEnabled: boolean;
      takeProfitPercent?: number;
      longStopLossPrice?: number;
      shortStopLossPrice?: number;
      longTakeProfitPrice?: number;
      shortTakeProfitPrice?: number;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      positionId,
      status: 'SET' as ConditionalOrderStatus,
      message: '條件單設定成功',
      ...details,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CONDITIONAL_ORDER_SUCCESS, event);

    logger.info({ positionId }, 'Conditional order success event emitted');
  }

  /**
   * 發送條件單設定失敗事件
   */
  emitConditionalOrderFailed(
    positionId: string,
    error: string,
    details?: {
      exchange?: SupportedExchange;
      side?: TradeSide;
    },
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      positionId,
      status: 'FAILED' as ConditionalOrderStatus,
      error,
      message: `條件單設定失敗: ${error}`,
      details,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CONDITIONAL_ORDER_FAILED, event);

    logger.warn({ positionId, error }, 'Conditional order failed event emitted');
  }

  /**
   * 發送條件單部分設定成功事件
   */
  emitConditionalOrderPartial(
    positionId: string,
    message: string,
    successDetails: Array<{
      exchange: SupportedExchange;
      type: 'stopLoss' | 'takeProfit';
      price?: number;
      orderId?: string;
    }>,
    failedDetails: Array<{
      exchange: SupportedExchange;
      type: 'stopLoss' | 'takeProfit';
      error: string;
    }>,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      positionId,
      status: 'PARTIAL' as ConditionalOrderStatus,
      message,
      successDetails,
      failedDetails,
    };

    const roomName = this.getPositionRoomName(positionId);
    this.io.to(roomName).emit(WS_EVENTS.CONDITIONAL_ORDER_PARTIAL, event);

    logger.warn({ positionId, successCount: successDetails.length, failedCount: failedDetails.length }, 'Conditional order partial event emitted');
  }

  // ============================================================================
  // Batch Close Events (Feature: 069-position-group-close)
  // ============================================================================

  /**
   * 發送批量平倉進度更新
   */
  emitBatchCloseProgress(
    groupId: string,
    current: number,
    total: number,
    positionId: string,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      groupId,
      current,
      total,
      positionId,
      progress: Math.round((current / total) * 100),
      message: `正在平倉第 ${current}/${total} 個持倉...`,
    };

    const roomName = this.getBatchCloseRoomName(groupId);
    this.io.to(roomName).emit(WS_EVENTS.BATCH_CLOSE_PROGRESS, event);

    logger.debug({ groupId, current, total, positionId }, 'Batch close progress emitted');
  }

  /**
   * 發送批量平倉單個持倉完成事件
   */
  emitBatchClosePositionComplete(
    groupId: string,
    positionId: string,
    success: boolean,
    error?: string,
    current?: number,
    total?: number,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      groupId,
      positionId,
      success,
      error,
      current,
      total,
    };

    const roomName = this.getBatchCloseRoomName(groupId);
    this.io.to(roomName).emit(WS_EVENTS.BATCH_CLOSE_POSITION_COMPLETE, event);

    logger.debug({ groupId, positionId, success }, 'Batch close position complete emitted');
  }

  /**
   * 發送批量平倉全部完成事件
   */
  emitBatchCloseComplete(
    groupId: string,
    totalPositions: number,
    closedPositions: number,
    failedPositions: number,
    results: Array<{ positionId: string; success: boolean; error?: string }>,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const success = failedPositions === 0;
    const message = success
      ? `批量平倉完成，共 ${closedPositions} 個持倉已關閉`
      : `批量平倉部分完成，成功 ${closedPositions} 個，失敗 ${failedPositions} 個`;

    const event = {
      groupId,
      success,
      totalPositions,
      closedPositions,
      failedPositions,
      results,
      message,
    };

    const roomName = this.getBatchCloseRoomName(groupId);
    this.io.to(roomName).emit(WS_EVENTS.BATCH_CLOSE_COMPLETE, event);

    logger.info(
      { groupId, totalPositions, closedPositions, failedPositions, success },
      'Batch close complete emitted',
    );
  }

  /**
   * 發送批量平倉失敗事件
   */
  emitBatchCloseFailed(
    groupId: string,
    error: string,
    errorCode: string,
  ): void {
    if (!this.io) {
      logger.warn('PositionProgressEmitter not initialized');
      return;
    }

    const event = {
      groupId,
      error,
      errorCode,
      message: `批量平倉失敗: ${error}`,
    };

    const roomName = this.getBatchCloseRoomName(groupId);
    this.io.to(roomName).emit(WS_EVENTS.BATCH_CLOSE_FAILED, event);

    logger.warn({ groupId, error, errorCode }, 'Batch close failed emitted');
  }
}

/**
 * 導出單例訪問方法
 */
export const positionProgressEmitter = PositionProgressEmitter.getInstance();

export default PositionProgressEmitter;
