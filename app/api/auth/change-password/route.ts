import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { AuthService } from '@/src/services/auth/AuthService';
import { changePasswordSchema } from '@/src/lib/validation';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const authService = new AuthService(prisma);

/**
 * POST /api/auth/change-password
 * 變更密碼（已登入用戶）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份（包含 tokenVersion 驗證）
    const user = await authenticate(request, true);

    logger.info(
      {
        correlationId,
        userId: user.userId,
      },
      'Change password request received'
    );

    // 2. 解析請求 body
    const body = await request.json();

    // 3. 驗證請求資料
    const validatedData = changePasswordSchema.parse(body);

    // 4. 執行密碼變更
    const result = await authService.changePassword(user.userId, {
      currentPassword: validatedData.currentPassword,
      newPassword: validatedData.newPassword,
      confirmPassword: validatedData.confirmPassword,
    });

    // 5. 清除 Session Cookie（密碼變更後需要重新登入）
    const response = NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );

    // 清除 Cookie
    response.cookies.delete('token');

    // 6. 設定 Correlation ID header
    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
      },
      'Password changed successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
