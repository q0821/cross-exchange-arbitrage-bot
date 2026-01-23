/**
 * Admin User Detail API (Feature 068)
 *
 * GET /api/admin/users/[id] - 獲取用戶詳細資料
 * PATCH /api/admin/users/[id] - 更新用戶資料
 * DELETE /api/admin/users/[id] - 刪除用戶
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import {
  AdminUserService,
  UserNotFoundError,
  InvalidEmailError,
  ActivePositionsError,
  SelfDeleteError,
} from '@services/admin/AdminUserService';
import { BaseError } from '@lib/errors';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

const userService = new AdminUserService();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id] - 獲取用戶詳細資料
 */
export const GET = withAdminAuth(async (_request: NextRequest, _user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;

    const result = await userService.getUserDetail(userId);

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

    logger.error({ error }, 'Failed to get user detail');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user details',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/users/[id] - 更新用戶資料
 */
export const PATCH = withAdminAuth(async (request: NextRequest, user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;
    const body = await request.json();

    const result = await userService.updateUser(userId, body, user.userId);

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

    if (error instanceof InvalidEmailError) {
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

    if (error instanceof BaseError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }

    logger.error({ error }, 'Failed to update user');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/users/[id] - 刪除用戶
 */
export const DELETE = withAdminAuth(async (request: NextRequest, user: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;
    const body = await request.json();

    await userService.deleteUser(userId, body, user.userId);

    return NextResponse.json(
      {
        success: true,
        message: 'User deleted successfully',
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

    if (error instanceof SelfDeleteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 403 }
      );
    }

    if (error instanceof ActivePositionsError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 409 }
      );
    }

    if (error instanceof BaseError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }

    logger.error({ error }, 'Failed to delete user');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user',
        },
      },
      { status: 500 }
    );
  }
});
