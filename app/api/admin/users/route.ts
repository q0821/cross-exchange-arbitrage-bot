/**
 * Admin Users API (Feature 068)
 *
 * GET /api/admin/users - 獲取用戶列表
 * POST /api/admin/users - 建立新用戶
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { AdminUserService, EmailAlreadyExistsError, InvalidEmailError } from '@services/admin/AdminUserService';
import { ValidationError } from '@lib/errors';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';
import type { AdminUserListQuery } from '@/src/types/admin';

const userService = new AdminUserService();

/**
 * GET /api/admin/users - 獲取用戶列表
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: AdminUserListQuery = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as 'all' | 'active' | 'inactive') || undefined,
      sortBy: (searchParams.get('sortBy') as 'createdAt' | 'email') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    };

    const result = await userService.listUsers(query);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to list users');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch users',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/users - 建立新用戶
 */
export const POST = withAdminAuth(async (request: NextRequest, user: JwtPayload) => {
  try {
    const body = await request.json();
    const { email, role } = body;

    // 驗證輸入
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required', 'email');
    }

    const result = await userService.createUser({ email, role }, user.userId);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        },
        { status: 400 }
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

    if (error instanceof EmailAlreadyExistsError) {
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

    logger.error({ error }, 'Failed to create user');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user',
        },
      },
      { status: 500 }
    );
  }
});
