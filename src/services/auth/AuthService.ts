import { PrismaClient } from '@/generated/prisma/client';
import { User, CreateUserData } from '@models/User';
import { UserRepository } from '../../repositories/UserRepository';
import { logger } from '@lib/logger';
import { AuthError, ValidationError, AccountLockedError } from '@lib/errors';
import { env } from '@lib/env';
import { meetsMinimumRequirements } from '@lib/password-strength';
import type { ChangePasswordRequest, ChangePasswordResult, PasswordAuditAction } from '@/types/auth';

/**
 * AuthService
 * 處理用戶認證相關的業務邏輯
 */

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export class AuthService {
  private readonly userRepository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
  }

  /**
   * 用戶註冊
   */
  async register(request: RegisterRequest): Promise<User> {
    const { email, password } = request;

    // 1. 驗證 Email 格式
    const emailValidation = User.validateEmail(email);
    if (!emailValidation.valid) {
      logger.warn({ email }, 'Invalid email format during registration');
      throw new ValidationError(emailValidation.message || 'Invalid email format');
    }

    // 2. 驗證密碼強度
    const passwordValidation = User.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      logger.warn({ email }, 'Weak password during registration');
      throw new ValidationError(passwordValidation.message || 'Weak password');
    }

    // 3. 檢查 Email 是否已存在
    const emailExists = await this.userRepository.emailExists(email);
    if (emailExists) {
      logger.warn({ email }, 'Email already exists during registration');
      throw new AuthError('Email already exists');
    }

    // 4. 雜湊密碼
    const passwordHash = await User.hashPassword(password);

    // 5. 建立用戶
    const userData: CreateUserData = { email, password };
    const user = await this.userRepository.create(userData, passwordHash);

    logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      'User registered successfully',
    );

    return user;
  }

  /**
   * 用戶登入（含 Brute Force Protection）
   */
  async login(request: LoginRequest, ipAddress?: string): Promise<User> {
    const { email, password } = request;

    // 1. 根據 Email 查詢用戶
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      logger.warn({ email }, 'User not found during login');
      throw new AuthError('Invalid email or password');
    }

    // 2. 檢查帳戶是否被鎖定
    if (user.isLocked()) {
      const remainingTime = user.getRemainingLockTime();
      logger.warn(
        { userId: user.id, email, remainingTime },
        'Login attempted on locked account'
      );
      throw new AccountLockedError(
        '帳戶已被暫時鎖定，請稍後再試',
        user.lockedUntil!,
        remainingTime
      );
    }

    // 3. 驗證密碼
    const isPasswordValid = await user.verifyPassword(password);

    if (!isPasswordValid) {
      // 增加失敗次數
      const failedAttempts = await this.userRepository.incrementFailedAttempts(user.id);

      // 記錄審計日誌
      await this.logAudit(user.id, 'LOGIN_FAILED', {
        reason: 'invalid_password',
        failedAttempts,
        ipAddress,
      }, ipAddress);

      // 檢查是否需要鎖定帳戶
      const lockoutThreshold = env.ACCOUNT_LOCKOUT_THRESHOLD;
      if (failedAttempts >= lockoutThreshold) {
        const lockDurationMinutes = env.ACCOUNT_LOCKOUT_DURATION_MINUTES;
        const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        await this.userRepository.lockAccount(user.id, lockedUntil);

        // 記錄審計日誌
        await this.logAudit(user.id, 'ACCOUNT_LOCKED', {
          failedAttempts,
          lockedUntil: lockedUntil.toISOString(),
          reason: 'brute_force_protection',
          ipAddress,
        }, ipAddress);

        logger.warn(
          { userId: user.id, email, failedAttempts },
          'Account locked due to failed login attempts'
        );

        // 發送帳戶鎖定通知郵件（異步，不影響回應）
        this.sendAccountLockedEmail(user.email, lockedUntil, failedAttempts, ipAddress).catch(
          (err) => logger.error({ error: err, userId: user.id }, 'Failed to send account locked email')
        );

        throw new AccountLockedError(
          `帳戶因多次登入失敗已被暫時鎖定 ${lockDurationMinutes} 分鐘`,
          lockedUntil,
          lockDurationMinutes * 60
        );
      }

      logger.warn(
        { userId: user.id, email, failedAttempts },
        'Invalid password during login'
      );
      throw new AuthError('Invalid email or password');
    }

    // 4. 登入成功，重置失敗次數
    if (user.failedLoginAttempts > 0) {
      await this.userRepository.resetFailedAttempts(user.id);
    }

    logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      'User logged in successfully',
    );

    return user;
  }

  /**
   * 發送帳戶鎖定通知郵件
   */
  private async sendAccountLockedEmail(
    email: string,
    lockedUntil: Date,
    failedAttempts: number,
    ipAddress?: string
  ): Promise<void> {
    const { getEmailService } = await import('@/src/lib/email/EmailService');
    const { generateAccountLockedEmail } = await import('@/src/lib/email/templates/account-locked');

    const emailService = getEmailService();
    if (!emailService.isAvailable()) {
      logger.warn({ email }, 'Email service not available for account locked notification');
      return;
    }

    const baseUrl = env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetPasswordUrl = `${baseUrl}/forgot-password`;

    const emailContent = generateAccountLockedEmail({
      userEmail: email,
      lockedUntil,
      failedAttempts,
      ipAddress,
      resetPasswordUrl,
    });

    await emailService.send({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    logger.info({ email }, 'Account locked notification email sent');
  }

  /**
   * 根據 ID 查詢用戶（用於驗證 JWT Token）
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  /**
   * 根據 Email 查詢用戶
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // =========================================================================
  // 密碼管理 (Feature 061)
  // =========================================================================

  /**
   * 變更密碼
   *
   * @param userId 用戶 ID
   * @param request 變更密碼請求
   * @returns 變更結果
   */
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<ChangePasswordResult> {
    const { currentPassword, newPassword, confirmPassword } = request;

    // 1. 驗證新密碼與確認密碼是否一致
    if (newPassword !== confirmPassword) {
      throw new ValidationError('新密碼與確認密碼不一致');
    }

    // 2. 驗證新密碼強度
    if (!meetsMinimumRequirements(newPassword)) {
      throw new ValidationError('新密碼不符合安全要求（至少 8 字元，包含大小寫字母和數字）');
    }

    // 3. 查詢用戶
    const user = await this.userRepository.findById(userId);
    if (!user) {
      logger.warn({ userId }, 'User not found during password change');
      throw new AuthError('用戶不存在');
    }

    // 4. 檢查帳戶是否被鎖定
    if (user.isLocked()) {
      throw new AccountLockedError('帳戶已被暫時鎖定', user.lockedUntil!, user.getRemainingLockTime());
    }

    // 5. 驗證目前密碼
    const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      // 增加失敗次數
      const failedAttempts = await this.userRepository.incrementFailedAttempts(userId);

      // 檢查是否需要鎖定帳戶
      const lockoutThreshold = env.ACCOUNT_LOCKOUT_THRESHOLD;
      if (failedAttempts >= lockoutThreshold) {
        const lockDurationMinutes = env.ACCOUNT_LOCKOUT_DURATION_MINUTES;
        const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        await this.userRepository.lockAccount(userId, lockedUntil);

        await this.logAudit(userId, 'ACCOUNT_LOCKED', {
          failedAttempts,
          lockedUntil: lockedUntil.toISOString(),
          reason: 'password_change_failed',
        });

        logger.warn({ userId, failedAttempts }, 'Account locked due to failed password change attempts');

        throw new AccountLockedError(
          `帳戶因多次失敗嘗試已被暫時鎖定 ${lockDurationMinutes} 分鐘`,
          lockedUntil,
          lockDurationMinutes * 60
        );
      }

      await this.logAudit(userId, 'LOGIN_FAILED', {
        reason: 'invalid_password',
        context: 'password_change',
      });

      logger.warn({ userId, failedAttempts }, 'Invalid current password during password change');
      throw new AuthError('目前密碼不正確');
    }

    // 6. 檢查新密碼是否與目前密碼相同
    const isSamePassword = await user.verifyPassword(newPassword);
    if (isSamePassword) {
      throw new ValidationError('新密碼不能與目前密碼相同');
    }

    // 7. 雜湊新密碼並更新
    const newPasswordHash = await User.hashPassword(newPassword);
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // 8. 記錄審計日誌
    await this.logAudit(userId, 'PASSWORD_CHANGE', { method: 'change' });

    logger.info({ userId }, 'Password changed successfully');

    return {
      success: true,
      message: '密碼已成功變更，請重新登入',
    };
  }

  /**
   * 取得用戶的 tokenVersion（用於 JWT 驗證）
   */
  async getTokenVersion(userId: string): Promise<number> {
    return this.userRepository.getTokenVersion(userId);
  }

  /**
   * 檢查帳戶鎖定狀態
   */
  async getLockStatus(userId: string) {
    return this.userRepository.getLockStatus(userId);
  }

  /**
   * 記錄審計日誌
   */
  private async logAudit(
    userId: string | null,
    action: PasswordAuditAction,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          ipAddress,
        },
      });
    } catch (error) {
      logger.error({ error, userId, action }, 'Failed to log audit');
    }
  }

  // Expose prisma for internal use
  private get prisma(): PrismaClient {
    return (this.userRepository as unknown as { prisma: PrismaClient }).prisma;
  }
}
