import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { AssetSnapshotService } from '@/src/services/assets/AssetSnapshotService';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { TooManyRequestsError } from '@/src/lib/errors';

// 簡易 Rate Limiting (用戶 -> 上次刷新時間)
const refreshRateLimits = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 30 * 1000; // 30 秒

/**
 * GET /api/assets
 * 查詢用戶各交易所資產餘額
 * Feature 031: Asset Tracking History (T013)
 *
 * Query Parameters:
 * - refresh: 'true' | 'false' - 是否從交易所 API 即時查詢（預設 false，使用最新快照）
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     exchanges: [
 *       { exchange: 'binance', status: 'success', balanceUSD: 1000.50 },
 *       { exchange: 'okx', status: 'no_api_key', balanceUSD: null },
 *       ...
 *     ],
 *     totalBalanceUSD: 1000.50,
 *     lastUpdated: '2025-12-11T00:00:00.000Z'
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
    const refresh = searchParams.get('refresh') === 'true';

    logger.info(
      {
        correlationId,
        userId: user.userId,
        refresh,
      },
      'Get assets request received'
    );

    // 3. Rate Limiting 檢查（僅刷新時）
    if (refresh) {
      const lastRefresh = refreshRateLimits.get(user.userId);
      const now = Date.now();

      if (lastRefresh && now - lastRefresh < REFRESH_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil(
          (REFRESH_COOLDOWN_MS - (now - lastRefresh)) / 1000
        );
        logger.warn(
          { userId: user.userId, remainingSeconds },
          'Rate limit exceeded for asset refresh'
        );
        throw new TooManyRequestsError(
          `請等待 ${remainingSeconds} 秒後再刷新`
        );
      }

      // 記錄刷新時間
      refreshRateLimits.set(user.userId, now);
    }

    // 4. 查詢餘額
    const assetService = new AssetSnapshotService(prisma);

    let result;
    if (refresh) {
      // 從交易所 API 即時查詢
      result = await assetService.getRealtimeBalances(user.userId);
    } else {
      // 從資料庫查詢最新快照
      const snapshot = await assetService.getLatestSnapshot(user.userId);

      if (snapshot) {
        result = assetService.snapshotToBalanceResult(snapshot);
      } else {
        // 沒有快照時，即時查詢一次
        result = await assetService.getRealtimeBalances(user.userId);
      }
    }

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          exchanges: result.exchanges,
          totalBalanceUSD: result.totalBalanceUSD,
          lastUpdated: result.lastUpdated.toISOString(),
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
