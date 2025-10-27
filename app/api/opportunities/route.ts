import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ArbitrageOpportunityRepository } from '@/src/repositories/ArbitrageOpportunityRepository';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();
const opportunityRepository = new ArbitrageOpportunityRepository(prisma);

/**
 * GET /api/opportunities
 * 查詢活躍的套利機會列表
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol,
        limit,
      },
      'Get opportunities request received',
    );

    // 3. 查詢機會
    let opportunities;
    if (symbol) {
      opportunities = await opportunityRepository.findActiveBySymbol(symbol);
    } else {
      opportunities = await opportunityRepository.findAllActive(limit);
    }

    // 4. 轉換為 DTO（添加計算欄位）
    const opportunitiesDTO = opportunities.map((opp) => {
      const now = new Date();
      const durationMs = now.getTime() - opp.detected_at.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);

      return {
        id: opp.id,
        symbol: opp.symbol,
        longExchange: opp.long_exchange,
        shortExchange: opp.short_exchange,
        longFundingRate: opp.long_funding_rate.toString(),
        shortFundingRate: opp.short_funding_rate.toString(),
        rateDifference: opp.rate_difference.toString(),
        expectedReturnRate: opp.expected_return_rate.toString(),
        status: opp.status,
        detectedAt: opp.detected_at.toISOString(),
        durationMinutes,
        maxRateDifference: opp.max_rate_difference?.toString(),
        notificationCount: opp.notification_count,
      };
    });

    // 5. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          opportunities: opportunitiesDTO,
          total: opportunitiesDTO.length,
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        count: opportunitiesDTO.length,
      },
      'Opportunities retrieved successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
