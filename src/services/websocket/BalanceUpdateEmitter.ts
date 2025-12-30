/**
 * BalanceUpdateEmitter
 * Feature: 052-specify-scripts-bash
 * Task: T072
 *
 * 推送餘額更新至前端 WebSocket
 */

import type { Server as SocketIOServer } from 'socket.io';
import type { ExchangeName } from '@/connectors/types';
import { logger } from '@/lib/logger';

/** 餘額更新資料 */
export interface BalanceUpdateData {
  exchange: ExchangeName;
  asset: string;
  balance: string;
  change: string;
  timestamp: string;
}

/** 總餘額更新資料 */
export interface TotalBalanceUpdateData {
  asset: string;
  total: string;
  byExchange: Record<string, string>;
  timestamp: string;
}

/** 餘額快照資料 */
export interface BalanceSnapshotData {
  balances: Record<string, Record<string, string>>;
  timestamp: string;
}

/**
 * BalanceUpdateEmitter
 *
 * 將餘額更新事件推送至前端 WebSocket 客戶端
 */
export class BalanceUpdateEmitter {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 發送單一餘額更新
   */
  emitBalanceUpdate(data: BalanceUpdateData): void {
    this.io.emit('balance:update', data);

    logger.debug(
      { exchange: data.exchange, asset: data.asset, balance: data.balance },
      'Balance update emitted'
    );
  }

  /**
   * 發送總餘額更新
   */
  emitTotalBalanceUpdate(data: TotalBalanceUpdateData): void {
    this.io.emit('balance:total', data);

    logger.debug(
      { asset: data.asset, total: data.total },
      'Total balance update emitted'
    );
  }

  /**
   * 發送餘額快照（完整餘額狀態）
   */
  emitBalanceSnapshot(data: BalanceSnapshotData): void {
    this.io.emit('balance:snapshot', data);

    logger.debug('Balance snapshot emitted');
  }

  /**
   * 發送給特定用戶
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);

    logger.debug(
      { userId, event },
      'Balance event emitted to user'
    );
  }

  /**
   * 發送餘額變更通知
   */
  emitBalanceChangeNotification(
    exchange: ExchangeName,
    asset: string,
    change: string,
    reason: string
  ): void {
    this.io.emit('balance:notification', {
      exchange,
      asset,
      change,
      reason,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { exchange, asset, change, reason },
      'Balance change notification emitted'
    );
  }
}

export default BalanceUpdateEmitter;
