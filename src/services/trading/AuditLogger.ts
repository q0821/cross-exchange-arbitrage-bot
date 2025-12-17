/**
 * AuditLogger
 *
 * 審計日誌服務，記錄所有交易相關操作
 * Feature: 033-manual-open-position
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import type { AuditAction, AuditLogDetails, SupportedExchange } from '../../types/trading';

/**
 * AuditLogger
 *
 * 記錄交易操作的審計日誌
 */
export class AuditLogger {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 記錄開倉開始
   */
  async logPositionOpenStarted(
    userId: string,
    positionId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    quantity: string,
    leverage: number,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_OPEN_STARTED', positionId, {
      positionId,
      symbol,
      longExchange,
      shortExchange,
      quantity,
      leverage,
    }, ipAddress);
  }

  /**
   * 記錄開倉成功
   */
  async logPositionOpenSuccess(
    userId: string,
    positionId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    quantity: string,
    longOrderId: string,
    shortOrderId: string,
    longPrice: string,
    shortPrice: string,
    longFee: string,
    shortFee: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_OPEN_SUCCESS', positionId, {
      positionId,
      symbol,
      longExchange,
      shortExchange,
      quantity,
      longOrderId,
      shortOrderId,
      longPrice,
      shortPrice,
      longFee,
      shortFee,
    }, ipAddress);
  }

  /**
   * 記錄開倉失敗
   */
  async logPositionOpenFailed(
    userId: string,
    positionId: string,
    symbol: string,
    errorCode: string,
    errorMessage: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_OPEN_FAILED', positionId, {
      positionId,
      symbol,
      errorCode,
      errorMessage,
    }, ipAddress);
  }

  /**
   * 記錄回滾開始
   */
  async logRollbackStarted(
    userId: string,
    positionId: string,
    exchange: SupportedExchange,
    orderId: string,
    quantity: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_ROLLBACK_STARTED', positionId, {
      positionId,
      longExchange: exchange,
      longOrderId: orderId,
      quantity,
    }, ipAddress);
  }

  /**
   * 記錄回滾成功
   */
  async logRollbackSuccess(
    userId: string,
    positionId: string,
    exchange: SupportedExchange,
    orderId: string,
    rollbackAttempts: number,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_ROLLBACK_SUCCESS', positionId, {
      positionId,
      longExchange: exchange,
      longOrderId: orderId,
      rollbackAttempts,
    }, ipAddress);
  }

  /**
   * 記錄回滾失敗
   */
  async logRollbackFailed(
    userId: string,
    positionId: string,
    exchange: SupportedExchange,
    orderId: string,
    rollbackAttempts: number,
    errorMessage: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_ROLLBACK_FAILED', positionId, {
      positionId,
      longExchange: exchange,
      longOrderId: orderId,
      rollbackAttempts,
      errorMessage,
    }, ipAddress);
  }

  // ============================================================================
  // Close Position Audit Methods (Feature: 035-close-position)
  // ============================================================================

  /**
   * 記錄平倉開始
   */
  async logPositionCloseStarted(
    userId: string,
    positionId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_CLOSE_STARTED', positionId, {
      positionId,
      symbol,
      longExchange,
      shortExchange,
    }, ipAddress);
  }

  /**
   * 記錄平倉成功
   */
  async logPositionCloseSuccess(
    userId: string,
    positionId: string,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    longExitPrice: string,
    shortExitPrice: string,
    longFee: string,
    shortFee: string,
    priceDiffPnL: string,
    fundingRatePnL: string,
    totalPnL: string,
    roi: string,
    holdingDuration: number,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_CLOSE_SUCCESS', positionId, {
      positionId,
      symbol,
      longExchange,
      shortExchange,
      longExitPrice,
      shortExitPrice,
      longFee,
      shortFee,
      priceDiffPnL,
      fundingRatePnL,
      totalPnL,
      roi,
      holdingDuration,
    }, ipAddress);
  }

  /**
   * 記錄平倉失敗
   */
  async logPositionCloseFailed(
    userId: string,
    positionId: string,
    symbol: string,
    errorCode: string,
    errorMessage: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_CLOSE_FAILED', positionId, {
      positionId,
      symbol,
      errorCode,
      errorMessage,
    }, ipAddress);
  }

  /**
   * 記錄部分平倉（一邊成功一邊失敗）
   */
  async logPositionClosePartial(
    userId: string,
    positionId: string,
    symbol: string,
    closedSide: 'LONG' | 'SHORT',
    closedExchange: SupportedExchange,
    closedOrderId: string,
    closedPrice: string,
    closedFee: string,
    failedSide: 'LONG' | 'SHORT',
    failedExchange: SupportedExchange,
    failedErrorCode: string,
    failedErrorMessage: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog(userId, 'POSITION_CLOSE_PARTIAL', positionId, {
      positionId,
      symbol,
      closedSide,
      closedExchange,
      closedOrderId,
      closedPrice,
      closedFee,
      failedSide,
      failedExchange,
      errorCode: failedErrorCode,
      errorMessage: failedErrorMessage,
    }, ipAddress);
  }

  /**
   * 創建審計日誌記錄
   */
  private async createAuditLog(
    userId: string,
    action: AuditAction,
    positionId: string,
    details: AuditLogDetails,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource: `position:${positionId}`,
          details: details as object,
          ipAddress,
        },
      });

      logger.info(
        { userId, action, positionId, details },
        `Audit log created: ${action}`,
      );
    } catch (error) {
      // 審計日誌創建失敗不應該阻止主要操作
      logger.error(
        { error, userId, action, positionId },
        'Failed to create audit log',
      );
    }
  }

  /**
   * 查詢用戶的審計日誌
   */
  async getUserAuditLogs(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      positionId?: string;
    } = {},
  ) {
    const { limit = 50, offset = 0, action, positionId } = options;

    const where: {
      userId: string;
      action?: string;
      resource?: string;
    } = { userId };

    if (action) {
      where.action = action;
    }

    if (positionId) {
      where.resource = `position:${positionId}`;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}

export default AuditLogger;
