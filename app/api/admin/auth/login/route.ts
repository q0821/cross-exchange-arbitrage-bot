/**
 * Admin Login API (Feature 068)
 *
 * POST /api/admin/auth/login - 管理員登入
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AdminAuthService,
  AdminLoginError,
  AdminAccountNotFoundError,
  AdminAccountLockedError,
  AdminAccountInactiveError,
} from '@services/admin/AdminAuthService';
import { ValidationError } from '@lib/errors';
import { logger } from '@lib/logger';

const adminAuthService = new AdminAuthService();

/**
 * 從請求中提取 IP 地址
 */
function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 驗證輸入
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required', 'email');
    }
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required', 'password');
    }

    const ipAddress = getClientIp(request);

    // 執行登入
    const result = await adminAuthService.login(email, password, ipAddress);

    // 設置 Cookie
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
        },
      },
      { status: 200 }
    );

    // 設置 httpOnly Cookie（7 天有效）
    response.cookies.set('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
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

    if (error instanceof AdminAccountNotFoundError || error instanceof AdminLoginError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    if (error instanceof AdminAccountInactiveError) {
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

    if (error instanceof AdminAccountLockedError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 423 }
      );
    }

    logger.error({ error }, 'Admin login failed');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
