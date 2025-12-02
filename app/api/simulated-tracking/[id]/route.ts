import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SimulatedTrackingService } from '@/src/services/tracking/SimulatedTrackingService';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { NotFoundError } from '@/src/lib/errors';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/simulated-tracking/[id]
 * 查詢追蹤詳情
 * Feature 029: Simulated APY Tracking (T020)
 */
export async function GET(
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
      'Get tracking detail request received'
    );

    // 2. 查詢追蹤詳情
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const tracking = await trackingService.getTrackingById(id, user.userId);

    if (!tracking) {
      throw new NotFoundError('Tracking not found');
    }

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

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * DELETE /api/simulated-tracking/[id]
 * 刪除追蹤（僅限非活躍）
 * Feature 029: Simulated APY Tracking (T044)
 */
export async function DELETE(
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
      'Delete tracking request received'
    );

    // 2. 刪除追蹤
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    await trackingService.deleteTracking(id, user.userId);

    // 3. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        message: 'Tracking deleted successfully',
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
      'Tracking deleted successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
