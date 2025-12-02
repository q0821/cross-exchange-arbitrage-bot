import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SimulatedTrackingService } from '@/src/services/tracking/SimulatedTrackingService';
import { SnapshotQuerySchema } from '@/src/models/SimulatedTracking';
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
 * GET /api/simulated-tracking/[id]/snapshots
 * 查詢追蹤的快照歷史
 * Feature 029: Simulated APY Tracking (T036)
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

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get('type') || 'all',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    };

    const validatedQuery = SnapshotQuerySchema.parse(queryParams);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        trackingId: id,
        query: validatedQuery,
      },
      'Get snapshots request received'
    );

    // 3. 查詢快照
    const trackingService = SimulatedTrackingService.getInstance(prisma);
    const result = await trackingService.getSnapshotsByTrackingId(
      id,
      user.userId,
      validatedQuery
    );

    if (!result) {
      throw new NotFoundError('Tracking not found');
    }

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          snapshots: result.snapshots,
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
