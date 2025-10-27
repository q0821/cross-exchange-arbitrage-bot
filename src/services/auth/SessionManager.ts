import { NextResponse } from 'next/server';
import { generateToken, JwtPayload, decodeToken } from '@lib/jwt';
import { logger } from '@lib/logger';

/**
 * SessionManager
 * 管理 JWT Token 的產生、設定、清除
 */

export interface CreateSessionOptions {
  userId: string;
  email: string;
}

export class SessionManager {
  private static readonly COOKIE_NAME = 'token';
  private static readonly COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

  /**
   * 建立 Session（產生 JWT Token 並設定 Cookie）
   */
  static createSession(
    response: NextResponse,
    options: CreateSessionOptions,
  ): NextResponse {
    const payload: JwtPayload = {
      userId: options.userId,
      email: options.email,
    };

    const token = generateToken(payload);

    // 設定 HttpOnly Cookie
    response.cookies.set(this.COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: this.COOKIE_MAX_AGE,
      path: '/',
    });

    logger.info(
      {
        userId: options.userId,
        email: options.email,
      },
      'Session created successfully',
    );

    return response;
  }

  /**
   * 清除 Session（刪除 Cookie）
   */
  static clearSession(response: NextResponse): NextResponse {
    response.cookies.delete(this.COOKIE_NAME);

    logger.info('Session cleared successfully');

    return response;
  }

  /**
   * 從 Token 字串中提取 Payload（不驗證簽名）
   * 用於快速讀取 Token 資訊，不應用於認證
   */
  static extractPayload(token: string): JwtPayload | null {
    try {
      return decodeToken(token);
    } catch (error) {
      logger.warn({ error }, 'Failed to extract payload from token');
      return null;
    }
  }

  /**
   * 更新 Session（刷新 Token 的過期時間）
   */
  static refreshSession(
    response: NextResponse,
    currentToken: string,
  ): NextResponse {
    const payload = this.extractPayload(currentToken);

    if (!payload) {
      logger.warn('Failed to refresh session: invalid token');
      return response;
    }

    // 重新產生 Token（更新過期時間）
    return this.createSession(response, {
      userId: payload.userId,
      email: payload.email,
    });
  }
}
