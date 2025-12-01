import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { OpportunityEndHistoryRepository } from '@/src/repositories/OpportunityEndHistoryRepository';
import { HistoryQuerySchema } from '@/src/models/OpportunityEndHistory';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();
const historyRepository = new OpportunityEndHistoryRepository(prisma);

/**
 * GET /api/opportunities/history
 * 查詢用戶的套利機會歷史記錄
 * Feature 027: 套利機會結束監測和通知
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const queryParams = {
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      symbol: searchParams.get('symbol') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 3. 驗證查詢參數
    const validatedQuery = HistoryQuerySchema.parse(queryParams);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        query: validatedQuery,
      },
      'Get opportunity histories request received'
    );

    // 4. 查詢歷史記錄
    const { histories, total } = await historyRepository.findByUserId(user.userId, {
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      symbol: validatedQuery.symbol,
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
    });

    // 5. 轉換為回應格式
    const historiesDTO = histories.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      longExchange: h.longExchange,
      shortExchange: h.shortExchange,
      detectedAt: h.detectedAt.toISOString(),
      disappearedAt: h.disappearedAt.toISOString(),
      durationMs: Number(h.durationMs),
      durationFormatted: h.durationFormatted,
      initialSpread: h.initialSpread,
      maxSpread: h.maxSpread,
      maxSpreadAt: h.maxSpreadAt.toISOString(),
      finalSpread: h.finalSpread,
      longIntervalHours: h.longIntervalHours,
      shortIntervalHours: h.shortIntervalHours,
      longSettlementCount: h.longSettlementCount,
      shortSettlementCount: h.shortSettlementCount,
      totalFundingProfit: h.totalFundingProfit,
      totalCost: h.totalCost,
      netProfit: h.netProfit,
      realizedAPY: h.realizedAPY,
      notificationCount: h.notificationCount,
      createdAt: h.createdAt.toISOString(),
    }));

    // 6. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          histories: historiesDTO,
          pagination: {
            total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            hasMore: validatedQuery.offset + validatedQuery.limit < total,
          },
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
