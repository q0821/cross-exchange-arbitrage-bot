/**
 * Admin Auth Middleware (Feature 068)
 *
 * 管理員認證中介軟體，驗證 JWT Token 並確認 ADMIN 角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JwtPayload } from '@lib/jwt';
import { prisma } from '@lib/db';
import { ForbiddenError, UnauthorizedError, InvalidTokenError } from '@lib/errors';

/**
 * Admin 專用錯誤：權限不足
 */
export class AdminForbiddenError extends ForbiddenError {
  constructor(message: string = 'Admin access required') {
    super(message);
    this.code = 'FORBIDDEN';
  }
}

/**
 * Admin 專用錯誤：帳戶已停用
 */
export class AdminAccountSuspendedError extends ForbiddenError {
  constructor(message: string = 'Account has been suspended') {
    super(message);
    this.code = 'ACCOUNT_SUSPENDED';
  }
}

/**
 * 從請求中提取 JWT Token
 */
function extractToken(request: NextRequest): string | null {
  // 優先從 Cookie 讀取
  const tokenFromCookie = request.cookies.get('token')?.value;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  // 備用：從 Authorization header 讀取
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * 驗證是否為 Admin 角色
 * @throws AdminForbiddenError 如果不是 ADMIN 角色
 */
export function requireAdmin(payload: JwtPayload): void {
  if (payload.role !== 'ADMIN') {
    throw new AdminForbiddenError('Admin access required');
  }
}

/**
 * Route context for dynamic routes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<any> };

/**
 * Admin 認證中介軟體工廠函式
 * 用於 Admin API Routes
 *
 * 驗證流程：
 * 1. 提取 Token
 * 2. 驗證 Token 有效性
 * 3. 確認 role 為 ADMIN
 * 4. 確認 isActive 為 true
 * 5. 確認 tokenVersion 一致（密碼未變更）
 */
export function withAdminAuth(
  handler: (request: NextRequest, user: JwtPayload, context?: RouteContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    try {
      const token = extractToken(request);

      if (!token) {
        throw new UnauthorizedError('No authentication token provided');
      }

      // 驗證 Token
      let payload: JwtPayload;
      try {
        payload = verifyToken(token);
      } catch {
        throw new InvalidTokenError('Invalid authentication token');
      }

      // 從資料庫查詢最新用戶狀態
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        throw new InvalidTokenError('User not found');
      }

      // 驗證 tokenVersion（密碼變更後會遞增）
      if (user.tokenVersion !== payload.tokenVersion) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TOKEN_VERSION_MISMATCH',
              message: '登入已過期，請重新登入',
            },
          },
          { status: 401 },
        );
      }

      // 驗證 ADMIN 角色
      if (user.role !== 'ADMIN') {
        throw new AdminForbiddenError('Admin access required');
      }

      // 驗證帳戶啟用狀態
      if (!user.isActive) {
        throw new AdminAccountSuspendedError('Account has been suspended');
      }

      return await handler(request, payload, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: 401 },
        );
      }

      if (error instanceof InvalidTokenError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: 401 },
        );
      }

      if (error instanceof AdminAccountSuspendedError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: 403 },
        );
      }

      if (error instanceof AdminForbiddenError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: 403 },
        );
      }

      // 其他未知錯誤
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 },
      );
    }
  };
}
