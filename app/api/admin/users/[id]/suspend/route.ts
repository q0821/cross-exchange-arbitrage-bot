/**
 * Admin Suspend User API (Feature 068)
 *
 * POST /api/admin/users/[id]/suspend - 停用用戶
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import {
  AdminUserService,
  UserNotFoundError,
  ConfirmationRequiredError,
} from '@services/admin/AdminUserService';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

const userService = new AdminUserService();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAdminAuth(async (request: NextRequest, user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;
    const body = await request.json();

    const result = await userService.suspendUser(userId, body, user.userId);

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

    if (error instanceof ConfirmationRequiredError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Failed to suspend user');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to suspend user',
        },
      },
      { status: 500 }
    );
  }
});
