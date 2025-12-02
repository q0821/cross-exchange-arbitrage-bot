import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SimulatedTrackingService } from '@/src/services/tracking/SimulatedTrackingService';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { ratesCache } from '@/src/services/monitor/RatesCache';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/simulated-tracking/[id]/stop
 * 停止追蹤
 * Feature 029: Simulated APY Tracking (T032)
 *
 * 更新：停止時記錄平倉價格和損益計算
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id } = await params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        trackingId: id,
      },
      'Stop tracking request received'
    );

    // 2. 獲取追蹤記錄以確定 symbol 和交易所
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const existingTracking = await trackingService.getTrackingById(
      id,
      user.userId
    );

    // 3. 嘗試獲取當前價格（用於計算損益）
    let currentPrices: { longPrice: number; shortPrice: number } | undefined;

    if (existingTracking) {
      const rateData = ratesCache.get(existingTracking.symbol);
      if (rateData) {
        // exchanges 是 Map<ExchangeName, ExchangeRateData>
        type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';
        const longExchangeData = rateData.exchanges.get(
          existingTracking.longExchange.toLowerCase() as ExchangeName
        );
        const shortExchangeData = rateData.exchanges.get(
          existingTracking.shortExchange.toLowerCase() as ExchangeName
        );

        if (longExchangeData?.price && shortExchangeData?.price) {
          currentPrices = {
            longPrice: longExchangeData.price,
            shortPrice: shortExchangeData.price,
          };
        }
      }
    }

    // 4. 停止追蹤（傳入當前價格以計算損益）
    const tracking = await trackingService.stopTracking(
      id,
      user.userId,
      currentPrices
    );

    // 5. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          tracking,
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        trackingId: id,
        pricePnl: tracking.pricePnl,
        fundingPnl: tracking.fundingPnl,
        totalPnl: tracking.totalPnl,
      },
      'Tracking stopped successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
