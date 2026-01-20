/**
 * PositionExitEmitter
 *
 * Feature: 067-position-exit-monitor
 *
 * WebSocket 推送服務：發送平倉建議事件到指定用戶
 * - position:exit:suggested - 平倉建議
 * - position:exit:canceled - 建議取消（APY 回升）
 */

import { getIo } from '@/lib/socket-manager';
import { logger } from '@/lib/logger';
import type { ExitSuggestedEvent, ExitCanceledEvent } from '@/services/monitor/types';

/**
 * 平倉建議 WebSocket 推送服務
 */
export class PositionExitEmitter {
  /**
   * 發送平倉建議事件
   *
   * @param userId - 目標用戶 ID
   * @param event - 平倉建議事件資料
   */
  emitExitSuggested(userId: string, event: ExitSuggestedEvent): void {
    const io = getIo();

    if (!io) {
      logger.warn(
        { userId, positionId: event.positionId },
        '[Feature 067] Socket.io not initialized, cannot emit exit suggested'
      );
      return;
    }

    io.to(`user:${userId}`).emit('position:exit:suggested', event);

    logger.info(
      {
        userId,
        positionId: event.positionId,
        symbol: event.symbol,
        reason: event.reason,
      },
      '[Feature 067] Emitted position:exit:suggested'
    );
  }

  /**
   * 發送建議取消事件（APY 回升）
   *
   * @param userId - 目標用戶 ID
   * @param event - 建議取消事件資料
   */
  emitExitCanceled(userId: string, event: ExitCanceledEvent): void {
    const io = getIo();

    if (!io) {
      logger.warn(
        { userId, positionId: event.positionId },
        '[Feature 067] Socket.io not initialized, cannot emit exit canceled'
      );
      return;
    }

    io.to(`user:${userId}`).emit('position:exit:canceled', event);

    logger.info(
      {
        userId,
        positionId: event.positionId,
        symbol: event.symbol,
        currentAPY: event.currentAPY,
      },
      '[Feature 067] Emitted position:exit:canceled'
    );
  }
}

/**
 * Singleton 實例
 */
export const positionExitEmitter = new PositionExitEmitter();
