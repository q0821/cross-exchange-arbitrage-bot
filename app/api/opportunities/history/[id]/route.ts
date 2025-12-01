import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { OpportunityEndHistoryRepository } from '@/src/repositories/OpportunityEndHistoryRepository';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();
const historyRepository = new OpportunityEndHistoryRepository(prisma);

/**
 * GET /api/opportunities/history/[id]
 * 取得單一機會歷史記錄（含完整結算記錄）
 * Feature 027: 套利機會結束監測和通知
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id: historyId } = await context.params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        historyId,
      },
      'Get opportunity history detail request received'
    );

    // 2. 查詢歷史記錄
    const history = await historyRepository.findById(historyId);

    if (!history) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: '找不到指定的歷史記錄',
        },
        { status: 404 }
      );
    }

    // 3. 返回結果（含完整結算記錄）
    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: history.id,
          symbol: history.symbol,
          longExchange: history.longExchange,
          shortExchange: history.shortExchange,
          detectedAt: history.detectedAt.toISOString(),
          disappearedAt: history.disappearedAt.toISOString(),
          durationMs: Number(history.durationMs),
          durationFormatted: history.durationFormatted,
          initialSpread: history.initialSpread,
          maxSpread: history.maxSpread,
          maxSpreadAt: history.maxSpreadAt.toISOString(),
          finalSpread: history.finalSpread,
          longIntervalHours: history.longIntervalHours,
          shortIntervalHours: history.shortIntervalHours,
          settlementRecords: history.settlementRecords,
          longSettlementCount: history.longSettlementCount,
          shortSettlementCount: history.shortSettlementCount,
          totalFundingProfit: history.totalFundingProfit,
          totalCost: history.totalCost,
          netProfit: history.netProfit,
          realizedAPY: history.realizedAPY,
          notificationCount: history.notificationCount,
          createdAt: history.createdAt.toISOString(),
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);
    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
