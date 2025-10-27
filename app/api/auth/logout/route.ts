import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/src/services/auth/SessionManager';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

/**
 * POST /api/auth/logout
 * 用戶登出
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    logger.info(
      {
        correlationId,
      },
      'Logout request received',
    );

    // 清除 Session（刪除 JWT Cookie）
    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      },
      { status: 200 },
    );

    SessionManager.clearSession(response);

    // 設定 Correlation ID header
    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
      },
      'User logged out successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
