import { NextRequest, NextResponse } from 'next/server';
import { ArbitrageOpportunityRepository } from '@/src/repositories/ArbitrageOpportunityRepository';
import { PublicOpportunityQuerySchema } from '@/src/models/PublicOpportunity';
import { rateLimitMiddleware } from '@/src/middleware/rateLimitMiddleware';
import { logger } from '@/src/lib/logger';
import type { PublicOpportunitiesResponse } from '@/src/types/public-opportunity';

/**
 * 公開 API: 查詢套利機會歷史
 * GET /api/public/opportunities
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - days: 7 | 30 | 90 (default: 90)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    // 1. 速率限制檢查
    const rateLimitResult = rateLimitMiddleware(request);
    if (rateLimitResult) {
      logger.warn(
        {
          requestId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
        'Public API rate limit exceeded'
      );
      return rateLimitResult;
    }

    // 2. 參數驗證
    const url = new URL(request.url);
    const params = PublicOpportunityQuerySchema.safeParse({
      page: url.searchParams.get('page') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      days: url.searchParams.get('days') || undefined,
      status: url.searchParams.get('status') || undefined,
    });

    if (!params.success) {
      logger.warn(
        {
          requestId,
          errors: params.error.issues,
          query: Object.fromEntries(url.searchParams),
        },
        'Invalid query parameters for public API'
      );

      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: params.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, days, status } = params.data;

    // 3. 獲取資料
    const repository = new ArbitrageOpportunityRepository();

    const { data, total } = await repository.getPublicOpportunities({
      days,
      page,
      limit,
      status,
    });

    // 4. 計算分頁資訊
    const totalPages = Math.ceil(total / limit);

    const response: PublicOpportunitiesResponse = {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filter: {
        days,
      },
    };

    logger.info(
      {
        requestId,
        page,
        limit,
        days,
        total,
        count: data.length,
      },
      'Public API request successful'
    );

    // 5. 設定 rate limit headers（即使請求成功）
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': '29', // 簡化實作，實際應從 RateLimiter 獲取
      },
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        error,
      },
      'Failed to fetch public opportunities'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
