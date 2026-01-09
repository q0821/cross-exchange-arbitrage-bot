import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { PasswordResetService } from '@/src/services/auth/PasswordResetService';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const passwordResetService = new PasswordResetService(prisma);

/**
 * GET /api/auth/validate-reset-token?token=xxx
 * 驗證密碼重設 Token 是否有效
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 從 URL 取得 token
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺少 token 參數',
          },
        },
        { status: 400 }
      );
    }

    logger.info(
      {
        correlationId,
      },
      'Validate reset token request received'
    );

    // 2. 驗證 Token
    const result = await passwordResetService.validateResetToken(token);

    // 3. 建立回應
    const response = NextResponse.json(
      {
        success: result.valid,
        data: result.valid
          ? { valid: true, expiresAt: result.expiresAt }
          : { valid: false, error: result.error },
      },
      { status: result.valid ? 200 : 400 }
    );

    // 4. 設定 Correlation ID header
    response.headers.set('X-Correlation-Id', correlationId);

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
