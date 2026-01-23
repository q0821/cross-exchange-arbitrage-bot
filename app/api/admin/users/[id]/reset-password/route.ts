/**
 * Admin Reset Password API (Feature 068)
 *
 * POST /api/admin/users/[id]/reset-password - 重設用戶密碼
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { AdminUserService, UserNotFoundError } from '@services/admin/AdminUserService';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

const userService = new AdminUserService();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAdminAuth(async (_request: NextRequest, user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;

    const result = await userService.resetPassword(userId, user.userId);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    logger.error({ error }, 'Failed to reset password');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset password',
        },
      },
      { status: 500 }
    );
  }
});
