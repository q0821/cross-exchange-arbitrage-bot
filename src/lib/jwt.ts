import jwt from 'jsonwebtoken';
import { env } from './env';
import type { UserRole } from '@/generated/prisma/client';

/**
 * JWT Token 工具
 */

export interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number; // Feature 061: 密碼變更後遞增以使舊 session 失效
  role: UserRole; // Feature 068: 用戶角色
}

/**
 * 獲取 JWT 密鑰
 * 使用統一環境變數驗證模組（已在載入時驗證）
 */
function getJwtSecret(): string {
  return env.JWT_SECRET;
}

/**
 * 獲取 JWT 過期時間
 */
function getJwtExpiresIn(): string {
  return env.JWT_EXPIRES_IN;
}

/**
 * 生成 JWT Token
 * @param payload Token 載荷
 * @returns JWT Token 字串
 */
export function generateToken(payload: JwtPayload): string {
  const secret = getJwtSecret();
  const expiresIn = getJwtExpiresIn();

  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as string | number,
    issuer: 'arbitrage-platform',
    audience: 'arbitrage-users',
  } as jwt.SignOptions);
}

/**
 * 驗證並解析 JWT Token
 * @param token JWT Token 字串
 * @returns Token 載荷
 * @throws Error 如果 Token 無效或過期
 */
export function verifyToken(token: string): JwtPayload {
  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'arbitrage-platform',
      audience: 'arbitrage-users',
    });

    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload');
    }

    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * 解析 Token（不驗證簽名）
 * @param token JWT Token 字串
 * @returns Token 載荷或 null
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      return null;
    }
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 檢查 Token 是否即將過期（< 1 小時）
 * @param token JWT Token 字串
 * @returns 是否即將過期
 */
export function isTokenExpiringSoon(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !('exp' in decoded)) {
    return false;
  }

  const exp = (decoded as jwt.JwtPayload).exp;
  if (!exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const oneHour = 60 * 60;

  return exp - now < oneHour;
}
