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
}

/**
 * 導出單例訪問方法
 */
export const positionProgressEmitter = PositionProgressEmitter.getInstance();

export default PositionProgressEmitter;
