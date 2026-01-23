/**
 * Admin User Trades API (Feature 068)
 *
 * GET /api/admin/users/[id]/trades - 獲取用戶持倉/交易記錄
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { AdminTradeService, UserNotFoundError } from '@services/admin/AdminTradeService';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

const tradeService = new AdminTradeService();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]/trades - 獲取用戶持倉和交易記錄
 *
 * Query Parameters:
 * - page: 頁碼 (預設 1)
 * - limit: 每頁數量 (預設 20)
 * - status: 'all' | 'open' | 'closed' (預設 'all')
 * - format: 'json' | 'csv' (預設 'json')
 * - startDate: 開始日期 (ISO 8601)
 * - endDate: 結束日期 (ISO 8601)
 */
export const GET = withAdminAuth(async (request: NextRequest, _user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;
    const { searchParams } = new URL(request.url);

    const format = searchParams.get('format') || 'json';

    // CSV 匯出
    if (format === 'csv') {
      const startDateStr = searchParams.get('startDate');
      const endDateStr = searchParams.get('endDate');
      const symbol = searchParams.get('symbol') || undefined;

      const csv = await tradeService.exportUserTrades(userId, {
        startDate: startDateStr ? new Date(startDateStr) : undefined,
        endDate: endDateStr ? new Date(endDateStr) : undefined,
        symbol,
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="trades-${userId}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON 格式（持倉列表）
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = (searchParams.get('status') as 'all' | 'open' | 'closed') || 'all';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const result = await tradeService.getUserPositions(userId, {
      page,
      limit,
      status,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    logger.error({ error }, 'Failed to get user trades');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user trades',
        },
      },
      { status: 500 }
    );
  }
});
