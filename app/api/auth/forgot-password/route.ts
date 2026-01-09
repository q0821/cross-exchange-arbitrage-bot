import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { PasswordResetService } from '@/src/services/auth/PasswordResetService';
import { forgotPasswordSchema } from '@/src/lib/validation';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const passwordResetService = new PasswordResetService(prisma);

/**
 * POST /api/auth/forgot-password
 * 請求密碼重設（忘記密碼）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 解析請求 body
    const body = await request.json();

    // 2. 驗證請求資料
    const validatedData = forgotPasswordSchema.parse(body);

    logger.info(
      {
        correlationId,
        email: validatedData.email,
      },
      'Forgot password request received'
    );

    // 3. 取得客戶端 IP
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    // 4. 執行密碼重設請求
    const result = await passwordResetService.requestPasswordReset(
      validatedData.email,
      ipAddress
    );

    // 5. 建立回應
    const response = NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );

    // 6. 設定 Correlation ID header
    response.headers.set('X-Correlation-Id', correlationId);

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
