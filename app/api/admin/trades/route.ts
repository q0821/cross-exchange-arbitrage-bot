/**
 * Admin Platform Trades API (Feature 068)
 *
 * GET /api/admin/trades - 獲取平台所有交易記錄
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { AdminTradeService } from '@services/admin/AdminTradeService';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

const tradeService = new AdminTradeService();

/**
 * GET /api/admin/trades - 獲取平台所有交易記錄
 *
 * Query Parameters:
 * - page: 頁碼 (預設 1)
 * - limit: 每頁數量 (預設 20)
 * - userId: 按用戶篩選
 * - symbol: 按交易對篩選
 * - startDate: 開始日期 (ISO 8601)
 * - endDate: 結束日期 (ISO 8601)
 * - sortBy: 排序欄位 ('closedAt' | 'totalPnL')
 * - sortOrder: 排序方向 ('asc' | 'desc')
 */
export const GET = withAdminAuth(async (request: NextRequest, _user: JwtPayload) => {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const userId = searchParams.get('userId') || undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const sortBy = (searchParams.get('sortBy') as 'closedAt' | 'totalPnL') || 'closedAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const result = await tradeService.listAllTrades({
      page,
      limit,
      userId,
      symbol,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to get platform trades');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch platform trades',
        },
      },
      { status: 500 }
    );
  }
});
