import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { SimulatedTrackingService } from '@/src/services/tracking/SimulatedTrackingService';
import {
  CreateTrackingSchema,
  TrackingQuerySchema,
} from '@/src/models/SimulatedTracking';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { ratesCache } from '@/src/services/monitor/RatesCache';
import { BadRequestError, NotFoundError } from '@/src/lib/errors';

/**
 * GET /api/simulated-tracking
 * 查詢當前用戶的追蹤列表
 * Feature 029: Simulated APY Tracking (T019)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const queryParams = {
      status: searchParams.get('status') || 'all',
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
    };

    const validatedQuery = TrackingQuerySchema.parse(queryParams);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        query: validatedQuery,
      },
      'Get trackings request received'
    );

    // 3. 查詢追蹤列表
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const result = await trackingService.getTrackingsByUserId(
      user.userId,
      validatedQuery
    );

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          trackings: result.trackings,
          pagination: result.pagination,
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

/**
 * POST /api/simulated-tracking
 * 開始追蹤套利機會
 * Feature 029: Simulated APY Tracking (T012)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析請求 body
    const body = await request.json();

    // 3. 驗證請求資料
    const validatedData = CreateTrackingSchema.parse(body);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol: validatedData.symbol,
        longExchange: validatedData.longExchange,
        shortExchange: validatedData.shortExchange,
      },
      'Start tracking request received'
    );

    // 4. 檢查追蹤數量限制
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const canStart = await trackingService.canStartTracking(user.userId);

    if (!canStart.canStart) {
      throw new BadRequestError(
        `最多只能同時追蹤 ${canStart.maxAllowed} 個機會，目前已有 ${canStart.activeCount} 個`
      );
    }

    // 5. 從快取獲取當前費率數據
    const currentRates = ratesCache.get(validatedData.symbol);

    if (!currentRates) {
      throw new NotFoundError(
        `無法取得 ${validatedData.symbol} 的費率資料，該交易對可能暫時無資料或不在監控範圍內`
      );
    }

    // 6. 驗證所選交易所在費率數據中存在 (exchanges 是 Map)
    const longExchangeExists = currentRates.exchanges.has(
      validatedData.longExchange as 'binance' | 'okx' | 'mexc' | 'gateio'
    );
    const shortExchangeExists = currentRates.exchanges.has(
      validatedData.shortExchange as 'binance' | 'okx' | 'mexc' | 'gateio'
    );

    if (!longExchangeExists) {
      throw new BadRequestError(
        `做多交易所 ${validatedData.longExchange.toUpperCase()} 目前沒有 ${validatedData.symbol} 的費率資料`
      );
    }

    if (!shortExchangeExists) {
      throw new BadRequestError(
        `做空交易所 ${validatedData.shortExchange.toUpperCase()} 目前沒有 ${validatedData.symbol} 的費率資料`
      );
    }

    // 7. 建立追蹤
    const tracking = await trackingService.startTracking(
      user.userId,
      validatedData,
      currentRates
    );

    // 8. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          tracking,
        },
      },
      { status: 201 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        trackingId: tracking.id,
      },
      'Tracking created successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
