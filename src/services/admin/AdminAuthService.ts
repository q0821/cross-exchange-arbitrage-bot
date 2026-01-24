/**
 * Admin Auth Service (Feature 068)
 *
 * 管理員認證服務
 */

import bcrypt from 'bcrypt';
import { prisma } from '@lib/db';
import { generateToken } from '@lib/jwt';
import { BaseError } from '@lib/errors';
import { calculateLockoutDuration, formatRemainingLockTime } from '@lib/admin/auth';
import type { UserRole } from '@/generated/prisma/client';

// ===== Error Classes =====

export class AdminLoginError extends BaseError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 'ADMIN_LOGIN_ERROR', 401);
  }
}

export class AdminAccountNotFoundError extends BaseError {
  constructor(message: string = 'Admin account not found') {
    super(message, 'ADMIN_ACCOUNT_NOT_FOUND', 401);
  }
}

export class AdminAccountLockedError extends BaseError {
  public readonly lockedUntil: Date;
  public readonly remainingSeconds: number;

  constructor(lockedUntil: Date, remainingSeconds: number) {
    const formattedTime = formatRemainingLockTime(remainingSeconds);
    super(`帳戶已鎖定，請在 ${formattedTime} 後再試`, 'ADMIN_ACCOUNT_LOCKED', 423);
    this.lockedUntil = lockedUntil;
    this.remainingSeconds = remainingSeconds;
  }
}

export class AdminAccountInactiveError extends BaseError {
  constructor(message: string = '帳戶已被停用') {
    super(message, 'ADMIN_ACCOUNT_INACTIVE', 403);
  }
}

// ===== Service =====

interface AdminLoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

const MAX_FAILED_ATTEMPTS = 5;

export class AdminAuthService {
  /**
   * 管理員登入
   * @param email 管理員 email
   * @param password 密碼
   * @param ipAddress IP 位址（用於審計日誌）
   * @returns 登入結果（token 和用戶資訊）
   */
  async login(email: string, password: string, ipAddress?: string): Promise<AdminLoginResult> {
    // 1. 查詢用戶
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        tokenVersion: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      throw new AdminAccountNotFoundError();
    }

    // 2. 驗證 ADMIN 角色
    if (user.role !== 'ADMIN') {
      throw new AdminLoginError('此帳戶不是管理員帳戶');
    }

    // 3. 驗證帳戶啟用狀態
    if (!user.isActive) {
      throw new AdminAccountInactiveError();
    }

    // 4. 檢查帳戶鎖定狀態
    if (user.lockedUntil) {
      const now = new Date();
      if (user.lockedUntil > now) {
        const remainingSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
        throw new AdminAccountLockedError(user.lockedUntil, remainingSeconds);
      }

      // 鎖定已過期，重置狀態
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // 5. 驗證密碼
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // 記錄失敗嘗試
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;

      const updateData: {
        failedLoginAttempts: number;
        lockedUntil?: Date | null;
      } = {
        failedLoginAttempts: newFailedAttempts,
      };

      // 檢查是否需要鎖定帳戶
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockoutSeconds = calculateLockoutDuration(newFailedAttempts);
        updateData.lockedUntil = new Date(Date.now() + lockoutSeconds * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new AdminLoginError('Invalid email or password');
    }

    // 6. 登入成功，重置失敗計數
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 7. 產生 JWT Token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      role: user.role,
    });

    // 8. 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_LOGIN',
        resource: 'admin/auth',
        details: { email: user.email },
        ipAddress: ipAddress || null,
      },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
