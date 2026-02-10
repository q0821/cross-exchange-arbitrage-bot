/**
 * PATCH /api/positions/group/[groupId]/mark-closed
 *
 * 批量標記已平倉 API - 將組內符合條件的持倉標記為 CLOSED
 * 僅更新資料庫，不會在交易所執行任何操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionGroupService } from '@/src/services/trading/PositionGroupService';
import { TradingError } from '@/src/lib/errors/trading-errors';

export async function PATCH(
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
      'Batch mark closed request received',
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

    // 3. 查詢組內符合條件的持倉（OPEN, PARTIAL, FAILED）
    const eligiblePositions = await prisma.position.findMany({
      where: {
        groupId,
        userId: user.userId,
        status: { in: ['OPEN', 'PARTIAL', 'FAILED'] },
      },
      select: { id: true, status: true },
    });

    if (eligiblePositions.length === 0) {
      throw new TradingError(
        '此組沒有可標記的持倉',
        'NO_ELIGIBLE_POSITIONS',
        false,
        { groupId },
      );
    }

    // 4. 批量更新
    const now = new Date();
    const positionIds = eligiblePositions.map((p) => p.id);

    const updateResult = await prisma.$transaction(async (tx) => {
      const result = await tx.position.updateMany({
        where: {
          id: { in: positionIds },
          userId: user.userId,
        },
        data: {
          status: 'CLOSED',
          closedAt: now,
          closeReason: 'MANUAL',
        },
      });
      return result;
    });

    logger.info(
      {
        correlationId,
        userId: user.userId,
        groupId,
        totalUpdated: updateResult.count,
        positionIds,
      },
      'Batch mark closed completed',
    );

    return NextResponse.json({
      success: true,
      data: {
        groupId,
        totalUpdated: updateResult.count,
        updatedPositions: positionIds,
      },
    });
  } catch (error) {
    const { groupId } = await context.params;

    logger.error(
      {
        correlationId,
        groupId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Batch mark closed request failed',
    );

    return handleError(error, correlationId);
  }
}
