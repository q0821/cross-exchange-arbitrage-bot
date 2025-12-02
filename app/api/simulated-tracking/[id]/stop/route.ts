import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SimulatedTrackingService } from '@/src/services/tracking/SimulatedTrackingService';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/simulated-tracking/[id]/stop
 * 停止追蹤
 * Feature 029: Simulated APY Tracking (T032)
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

    // 2. 停止追蹤
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const tracking = await trackingService.stopTracking(id, user.userId);

    // 3. 返回結果
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
      },
      'Tracking stopped successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
