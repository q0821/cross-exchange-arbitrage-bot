/**
 * PATCH /api/positions/[id]
 *
 * 手動更新持倉狀態 - 允許用戶將持倉標記為已平倉
 * Feature: 037-mark-position-closed
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { PositionWebStatus } from '@/generated/prisma/client';
import { z } from 'zod';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

/**
 * 請求驗證 Schema
 */
const MarkAsClosedSchema = z.object({
  action: z.literal('markAsClosed'),
});

/**
 * 允許手動標記為已平倉的狀態
 */
const ALLOWED_STATUSES_FOR_MANUAL_CLOSE: PositionWebStatus[] = [
  PositionWebStatus.OPEN,
  PositionWebStatus.PARTIAL,
  PositionWebStatus.FAILED,
];

/**
 * PATCH /api/positions/[id]
 *
 * 手動更新持倉狀態
 *
 * Request Body:
 * {
 *   "action": "markAsClosed"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "...",
 *     "status": "CLOSED",
 *     "closedAt": "2025-12-19T..."
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);
    const { id: positionId } = await context.params;

    // 2. 解析並驗證請求
    const body = await request.json();
    const parseResult = MarkAsClosedSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          positionId,
          errors: parseResult.error.issues,
        },
        'Invalid request body for mark as closed',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid action specified. Expected: { "action": "markAsClosed" }',
          },
        },
        { status: 400 },
      );
    }

    // 3. 獲取持倉詳情
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          positionId,
        },
        'Position not found',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Position not found',
          },
        },
        { status: 404 },
      );
    }

    // 4. 驗證所有權
    if (position.userId !== user.userId) {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          positionId,
          positionOwnerId: position.userId,
        },
        'Unauthorized: Position belongs to another user',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to modify this position',
          },
        },
        { status: 403 },
      );
    }

    // 5. 驗證狀態轉換規則
    const currentStatus = position.status as PositionWebStatus;

    if (!ALLOWED_STATUSES_FOR_MANUAL_CLOSE.includes(currentStatus)) {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          positionId,
          currentStatus,
          allowedStatuses: ALLOWED_STATUSES_FOR_MANUAL_CLOSE,
        },
        'Invalid status transition for manual close',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot mark position with status "${currentStatus}" as closed. Only OPEN, PARTIAL, or FAILED positions can be manually marked as closed.`,
          },
        },
        { status: 400 },
      );
    }

    // 6. 更新持倉狀態
    const previousStatus = currentStatus;
    const closedAt = new Date();

    const updatedPosition = await prisma.position.update({
      where: { id: positionId },
      data: {
        status: PositionWebStatus.CLOSED,
        closedAt,
      },
    });

    // 7. 記錄操作日誌
    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionId,
        previousStatus,
        newStatus: PositionWebStatus.CLOSED,
        closedAt: closedAt.toISOString(),
        symbol: position.symbol,
        longExchange: position.longExchange,
        shortExchange: position.shortExchange,
      },
      'Position manually marked as closed',
    );

    // 8. 返回成功回應
    return NextResponse.json(
      {
        success: true,
        data: {
          id: updatedPosition.id,
          status: updatedPosition.status,
          closedAt: updatedPosition.closedAt?.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}
