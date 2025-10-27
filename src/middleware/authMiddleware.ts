import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { UnauthorizedError, InvalidTokenError } from '../lib/errors.js';

/**
 * 認證中介軟體
 * 驗證 JWT Token（從 Cookie 讀取）
 */

export interface AuthenticatedRequest extends NextRequest {
  user?: JwtPayload;
}

/**
 * 從請求中提取 JWT Token
 */
export function extractToken(request: NextRequest): string | null {
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
 * 驗證請求是否已認證
 * @param request Next.js 請求對象
 * @returns JWT Payload
 * @throws UnauthorizedError 如果未提供 Token
 * @throws InvalidTokenError 如果 Token 無效
 */
export async function authenticate(request: NextRequest): Promise<JwtPayload> {
  const token = extractToken(request);

  if (!token) {
    throw new UnauthorizedError('No authentication token provided');
  }

  try {
    const payload = verifyToken(token);
    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw new InvalidTokenError(error.message);
    }
    throw new InvalidTokenError('Invalid authentication token');
  }
}

/**
 * 認證中介軟體工廠函式
 * 用於 API Routes
 */
export function withAuth(
  handler: (request: NextRequest, user: JwtPayload) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const user = await authenticate(request);
      return await handler(request, user);
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof InvalidTokenError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: error.statusCode },
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
