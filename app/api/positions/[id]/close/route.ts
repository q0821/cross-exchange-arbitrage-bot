/**
 * POST /api/positions/[id]/close
 *
 * 平倉 API - 關閉指定持倉的雙邊對沖倉位
 * Feature: 035-close-position (T007)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionCloser, AuditLogger } from '@/src/services/trading';
import { positionProgressEmitter } from '@/src/services/websocket/PositionProgressEmitter';
import { TradingError } from '@/src/lib/errors/trading-errors';
import type {
  ClosePositionResponse,
  PartialCloseResponse,
  SupportedExchange,
  TradePerformanceInfo,
} from '@/src/types/trading';

/**
 * POST /api/positions/[id]/close
 *
 * 關閉指定持倉的雙邊對沖倉位
 *
 * Path Parameters:
 * - id: 持倉 ID
 *
 * Response (Success):
 * {
 *   success: true,
 *   position: {...},
 *   trade: {...},
 *   message: "平倉成功"
 * }
 *
 * Response (Partial Close):
 * {
 *   success: false,
 *   error: "PARTIAL_CLOSE",
 *   message: "部分平倉成功，請手動處理...",
 *   position: {...},
 *   partialClosed: {...},
 *   failedSide: {...}
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);
    const { id: positionId } = await context.params;

    // 獲取 IP 地址（用於審計日誌）
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionId,
      },
      'Close position request received',
    );

    // 2. 獲取持倉詳情（用於審計日誌）
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new TradingError('持倉不存在', 'POSITION_NOT_FOUND', false, { positionId });
    }

    // 3. 記錄平倉開始審計日誌
    const auditLogger = new AuditLogger(prisma);
    await auditLogger.logPositionCloseStarted(
      user.userId,
      positionId,
      position.symbol,
      position.longExchange as SupportedExchange,
      position.shortExchange as SupportedExchange,
      ipAddress,
    );

    // 4. 發送驗證進度
    positionProgressEmitter.emitCloseProgress(positionId, 'validating');

    // 5. 執行平倉
    const positionCloser = new PositionCloser(prisma);
    const result = await positionCloser.closePosition({
      userId: user.userId,
      positionId,
    });

    // 6. 處理結果
    if (result.success) {
      // 平倉成功
      const { position: updatedPosition, trade, longClose, shortClose } = result;

      // 記錄成功審計日誌
      await auditLogger.logPositionCloseSuccess(
        user.userId,
        positionId,
        position.symbol,
        position.longExchange as SupportedExchange,
        position.shortExchange as SupportedExchange,
        longClose.price.toString(),
        shortClose.price.toString(),
        longClose.fee.toString(),
        shortClose.fee.toString(),
        trade.priceDiffPnL.toString(),
        trade.fundingRatePnL.toString(),
        trade.totalPnL.toString(),
        trade.roi.toString(),
        trade.holdingDuration,
        ipAddress,
      );

      // 發送成功 WebSocket 事件
      positionProgressEmitter.emitCloseSuccess(
        positionId,
        {
          id: trade.id,
          priceDiffPnL: trade.priceDiffPnL.toString(),
          fundingRatePnL: trade.fundingRatePnL.toString(),
          totalPnL: trade.totalPnL.toString(),
          roi: trade.roi.toString(),
          holdingDuration: trade.holdingDuration,
        },
        {
          exchange: position.longExchange as SupportedExchange,
          orderId: longClose.orderId,
          price: longClose.price.toString(),
          quantity: longClose.quantity.toString(),
          fee: longClose.fee.toString(),
        },
        {
          exchange: position.shortExchange as SupportedExchange,
          orderId: shortClose.orderId,
          price: shortClose.price.toString(),
          quantity: shortClose.quantity.toString(),
          fee: shortClose.fee.toString(),
        },
      );

      logger.info(
        {
          correlationId,
          userId: user.userId,
          positionId,
          tradeId: trade.id,
          totalPnL: trade.totalPnL,
          roi: trade.roi,
        },
        'Close position request completed successfully',
      );

      // 格式化 Trade 績效資訊
      const tradeInfo: TradePerformanceInfo = {
        id: trade.id,
        positionId: trade.positionId,
        symbol: trade.symbol,
        longExchange: trade.longExchange,
        shortExchange: trade.shortExchange,
        longEntryPrice: trade.longEntryPrice.toString(),
        longExitPrice: trade.longExitPrice.toString(),
        shortEntryPrice: trade.shortEntryPrice.toString(),
        shortExitPrice: trade.shortExitPrice.toString(),
        longPositionSize: trade.longPositionSize.toString(),
        shortPositionSize: trade.shortPositionSize.toString(),
        openedAt: trade.openedAt.toISOString(),
        closedAt: trade.closedAt.toISOString(),
        holdingDuration: trade.holdingDuration,
        priceDiffPnL: trade.priceDiffPnL.toString(),
        fundingRatePnL: trade.fundingRatePnL.toString(),
        totalPnL: trade.totalPnL.toString(),
        roi: trade.roi.toString(),
        status: trade.status as 'SUCCESS' | 'PARTIAL',
        createdAt: trade.createdAt.toISOString(),
      };

      const response: ClosePositionResponse = {
        success: true,
        position: {
          id: updatedPosition.id,
          userId: updatedPosition.userId,
          symbol: updatedPosition.symbol,
          longExchange: updatedPosition.longExchange as SupportedExchange,
          shortExchange: updatedPosition.shortExchange as SupportedExchange,
          leverage: updatedPosition.longLeverage,
          status: updatedPosition.status as any,
          createdAt: updatedPosition.createdAt.toISOString(),
          updatedAt: updatedPosition.updatedAt.toISOString(),
          groupId: updatedPosition.groupId,
        },
        trade: tradeInfo,
        message: '平倉成功',
      };

      return NextResponse.json(response, { status: 200 });
    } else {
      // 部分平倉
      const { position: updatedPosition, closedSide, failedSide } = result;

      // 記錄部分平倉審計日誌
      await auditLogger.logPositionClosePartial(
        user.userId,
        positionId,
        position.symbol,
        closedSide.side,
        closedSide.exchange,
        closedSide.orderId,
        closedSide.price.toString(),
        closedSide.fee.toString(),
        failedSide.side,
        failedSide.exchange,
        'EXCHANGE_ERROR',
        failedSide.error.message,
        ipAddress,
      );

      // 發送部分平倉 WebSocket 事件
      positionProgressEmitter.emitClosePartial(
        positionId,
        `部分平倉成功，請手動處理 ${failedSide.exchange} ${failedSide.side} 倉位`,
        {
          exchange: closedSide.exchange,
          side: closedSide.side,
          orderId: closedSide.orderId,
          price: closedSide.price.toString(),
          quantity: closedSide.quantity.toString(),
          fee: closedSide.fee.toString(),
        },
        {
          exchange: failedSide.exchange,
          side: failedSide.side,
          error: failedSide.error.message,
          errorCode: 'EXCHANGE_ERROR',
        },
      );

      logger.warn(
        {
          correlationId,
          userId: user.userId,
          positionId,
          closedExchange: closedSide.exchange,
          failedExchange: failedSide.exchange,
          failedError: failedSide.error.message,
        },
        'Close position request completed with partial close',
      );

      const response: PartialCloseResponse = {
        success: false,
        error: 'PARTIAL_CLOSE',
        message: `${closedSide.side === 'LONG' ? '多頭' : '空頭'}已平倉，但${failedSide.side === 'LONG' ? '多頭' : '空頭'}平倉失敗。請手動處理 ${failedSide.exchange} 倉位。`,
        position: {
          id: updatedPosition.id,
          userId: updatedPosition.userId,
          symbol: updatedPosition.symbol,
          longExchange: updatedPosition.longExchange as SupportedExchange,
          shortExchange: updatedPosition.shortExchange as SupportedExchange,
          leverage: updatedPosition.longLeverage,
          status: updatedPosition.status as any,
          createdAt: updatedPosition.createdAt.toISOString(),
          updatedAt: updatedPosition.updatedAt.toISOString(),
          groupId: updatedPosition.groupId,
        },
        partialClosed: {
          exchange: closedSide.exchange,
          orderId: closedSide.orderId,
          side: closedSide.side,
          price: closedSide.price.toString(),
          quantity: closedSide.quantity.toString(),
          fee: closedSide.fee.toString(),
        },
        failedSide: {
          exchange: failedSide.exchange,
          error: failedSide.error.message,
          errorCode: 'EXCHANGE_ERROR',
        },
      };

      return NextResponse.json(response, { status: 207 }); // 207 Multi-Status
    }
  } catch (error) {
    // 發送失敗 WebSocket 事件
    const { id: positionId } = await context.params;
    if (positionId) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof TradingError ? error.code : 'UNKNOWN';
      positionProgressEmitter.emitCloseFailed(positionId, errorMessage, errorCode);

      // 記錄失敗審計日誌
      try {
        const user = await authenticate(request);
        const position = await prisma.position.findUnique({
          where: { id: positionId },
        });

        if (position) {
          const auditLogger = new AuditLogger(prisma);
          await auditLogger.logPositionCloseFailed(
            user.userId,
            positionId,
            position.symbol,
            errorCode,
            errorMessage,
          );
        }
      } catch {
        // 忽略審計日誌錯誤
      }
    }

    return handleError(error, correlationId);
  }
}
