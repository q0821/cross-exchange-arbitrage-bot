import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AssetSnapshotService } from '@/src/services/assets/AssetSnapshotService';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { BadRequestError } from '@/src/lib/errors';

const prisma = new PrismaClient();

/**
 * GET /api/assets/history
 * 查詢用戶資產歷史曲線資料
 * Feature 031: Asset Tracking History (T021)
 *
 * Query Parameters:
 * - days: 7 | 14 | 30 - 歷史天數（預設 7）
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     snapshots: [
 *       { timestamp: '...', binance: 100, okx: 200, mexc: null, gate: null, total: 300 },
 *       ...
 *     ],
 *     period: { days: 7, from: '...', to: '...' },
 *     summary: { startTotal: 300, endTotal: 350, changeUSD: 50, changePercent: 16.67 }
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    // 驗證 days 參數
    if (![7, 14, 30].includes(days)) {
      throw new BadRequestError('days 參數必須是 7, 14, 或 30');
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        days,
      },
      'Get asset history request received'
    );

    // 3. 查詢歷史資料
    const assetService = new AssetSnapshotService(prisma);
    const result = await assetService.getHistory(user.userId, days);

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          snapshots: result.snapshots,
          period: {
            days: result.period.days,
            from: result.period.from.toISOString(),
            to: result.period.to.toISOString(),
          },
          summary: result.summary,
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
