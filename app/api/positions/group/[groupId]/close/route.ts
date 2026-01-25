/**
 * POST /api/positions/group/[groupId]/close
 *
 * 批量平倉 API - 關閉指定組內所有持倉
 * Feature: 069-position-group-close (T023)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionCloser } from '@/src/services/trading';
import { PositionGroupService } from '@/src/services/trading/PositionGroupService';
import { positionProgressEmitter } from '@/src/services/websocket/PositionProgressEmitter';
import { TradingError } from '@/src/lib/errors/trading-errors';

/**
 * 批量平倉回應類型
 */
interface BatchCloseResponse {
  success: boolean;
  groupId: string;
  totalPositions: number;
  closedPositions: number;
  failedPositions: number;
  results: Array<{
    positionId: string;
    success: boolean;
    error?: string;
  }>;
  message: string;
}

/**
 * POST /api/positions/group/[groupId]/close
 *
 * 關閉指定組內所有持倉
 *
 * Path Parameters:
 * - groupId: 組 ID (UUID)
 *
 * Response (Success - All closed):
 * {
 *   success: true,
 *   groupId: "...",
 *   totalPositions: 3,
 *   closedPositions: 3,
 *   failedPositions: 0,
 *   results: [...],
 *   message: "批量平倉完成，共 3 個持倉已關閉"
 * }
 *
 * Response (Partial Success):
 * {
 *   success: false,
 *   groupId: "...",
 *   totalPositions: 3,
 *   closedPositions: 2,
 *   failedPositions: 1,
 *   results: [...],
 *   message: "批量平倉部分完成，成功 2 個，失敗 1 個"
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);
    const { groupId } = await context.params;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        groupId,
      },
      'Batch close request received',
    );

    // 2. 驗證用戶擁有這個組
    const groupService = new PositionGroupService(prisma);
    const isOwner = await groupService.validateGroupOwnership(groupId, user.userId);

    if (!isOwner) {
      throw new TradingError(
        '無權操作此持倉組',
        'GROUP_ACCESS_DENIED',
        false,
        { groupId, userId: user.userId },
      );
    }

    // 3. 執行批量平倉
    const positionCloser = new PositionCloser(prisma);
    const result = await positionCloser.closeBatchPositions({
      userId: user.userId,
      groupId,
      onProgress: (progress) => {
        // T024: 透過 WebSocket 發送進度
        positionProgressEmitter.emitBatchCloseProgress(
          groupId,
          progress.current,
          progress.total,
          progress.positionId,
        );
        logger.debug(
          {
            correlationId,
            groupId,
            current: progress.current,
            total: progress.total,
            positionId: progress.positionId,
          },
          'Batch close progress',
        );
      },
    });

    // 4. 發送批量平倉完成事件
    positionProgressEmitter.emitBatchCloseComplete(
      groupId,
      result.totalPositions,
      result.closedPositions,
      result.failedPositions,
      result.results,
    );

    // 5. 構建回應
    const message = result.success
      ? `批量平倉完成，共 ${result.closedPositions} 個持倉已關閉`
      : result.totalPositions === 0
        ? '此組沒有待平倉的持倉'
        : `批量平倉部分完成，成功 ${result.closedPositions} 個，失敗 ${result.failedPositions} 個`;

    const response: BatchCloseResponse = {
      success: result.success,
      groupId,
      totalPositions: result.totalPositions,
      closedPositions: result.closedPositions,
      failedPositions: result.failedPositions,
      results: result.results.map((r) => ({
        positionId: r.positionId,
        success: r.success,
        error: r.error,
      })),
      message,
    };

    logger.info(
      {
        correlationId,
        userId: user.userId,
        groupId,
        totalPositions: result.totalPositions,
        closedPositions: result.closedPositions,
        failedPositions: result.failedPositions,
        success: result.success,
      },
      'Batch close request completed',
    );

    // 6. 返回適當的 HTTP 狀態碼
    // 全部成功: 200
    // 部分成功: 207 Multi-Status
    // 全部失敗: 500
    // 沒有持倉: 200 (空操作也算成功)
    const statusCode =
      result.totalPositions === 0
        ? 200
        : result.success
          ? 200
          : result.closedPositions > 0
            ? 207
            : 500;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    const { groupId } = await context.params;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof TradingError ? error.code : 'BATCH_CLOSE_ERROR';

    // 發送批量平倉失敗事件
    positionProgressEmitter.emitBatchCloseFailed(groupId, errorMessage, errorCode);

    logger.error(
      {
        correlationId,
        groupId,
        error: errorMessage,
      },
      'Batch close request failed',
    );

    return handleError(error, correlationId);
  }
}
