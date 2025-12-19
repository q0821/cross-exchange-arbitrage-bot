import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { AuthService } from '@/src/services/auth/AuthService';
import { SessionManager } from '@/src/services/auth/SessionManager';
import { registerSchema } from '@/src/lib/validation';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const authService = new AuthService(prisma);

/**
 * POST /api/auth/register
 * 用戶註冊
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 解析請求 body
    const body = await request.json();

    // 2. 驗證請求資料
    const validatedData = registerSchema.parse(body);

    logger.info(
      {
        correlationId,
        email: validatedData.email,
      },
      'Register request received',
    );

    // 3. 執行註冊
    const user = await authService.register({
      email: validatedData.email,
      password: validatedData.password,
    });

    // 4. 建立 Session（設定 JWT Cookie）
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: user.toDTO(),
        },
      },
      { status: 201 },
    );

    SessionManager.createSession(response, {
      userId: user.id,
      email: user.email,
    });

    // 5. 設定 Correlation ID header
    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.id,
        email: user.email,
      },
      'User registered and logged in successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
