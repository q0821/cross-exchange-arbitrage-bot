/**
 * PasswordResetService (Feature 061: 密碼管理)
 *
 * 處理密碼重設流程：
 * - Token 生成與驗證
 * - Rate limiting（每個 email 60 秒限制）
 * - 郵件發送
 * - 審計日誌記錄
 */
import crypto from 'crypto';
import { PrismaClient } from '@/generated/prisma/client';
import { UserRepository } from '@/src/repositories/UserRepository';
import { PasswordResetTokenRepository } from '@/src/repositories/PasswordResetTokenRepository';
import { getEmailService, type EmailService } from '@/src/lib/email/EmailService';
import { generatePasswordResetEmail } from '@/src/lib/email/templates/password-reset';
import { User } from '@/src/models/User';
import { env } from '@/src/lib/env';
import { logger } from '@/src/lib/logger';
import { ValidationError, RateLimitError } from '@/src/lib/errors';
import { meetsMinimumRequirements } from '@/src/lib/password-strength';
import type {
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResult,
  ValidateResetTokenResult,
  PasswordAuditAction,
} from '@/src/types/auth';

/**
 * Token 長度（bytes）
 */
const TOKEN_LENGTH = 32;

export class PasswordResetService {
  private readonly userRepository: UserRepository;
  private readonly tokenRepository: PasswordResetTokenRepository;
  private readonly emailService: EmailService;

  constructor(private readonly prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
    this.tokenRepository = new PasswordResetTokenRepository(prisma);
    this.emailService = getEmailService();
  }

  /**
   * 處理忘記密碼請求
   *
   * 不論 email 是否存在，都返回成功訊息（防止用戶枚舉攻擊）
   */
  async requestPasswordReset(
    email: string,
    ipAddress?: string
  ): Promise<ForgotPasswordResponse> {
    const normalizedEmail = email.toLowerCase().trim();

    logger.info({ email: normalizedEmail }, 'Password reset requested');

    // 查詢用戶
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // 如果用戶不存在，仍然返回成功訊息（安全考量）
    if (!user) {
      logger.info({ email: normalizedEmail }, 'Password reset requested for non-existent email');
      return {
        success: true,
        message: '如果此電子郵件存在，您將收到密碼重設連結',
      };
    }

    // 檢查 rate limiting
    const rateLimitSeconds = env.PASSWORD_RESET_RATE_LIMIT_SECONDS;
    const lastRequestTime = await this.tokenRepository.findLastRequestTime(user.id);

    if (lastRequestTime) {
      const timeSinceLastRequest = (Date.now() - lastRequestTime.getTime()) / 1000;
      if (timeSinceLastRequest < rateLimitSeconds) {
        const waitSeconds = Math.ceil(rateLimitSeconds - timeSinceLastRequest);
        logger.warn(
          { userId: user.id, waitSeconds },
          'Password reset rate limited'
        );
        throw new RateLimitError(
          `請稍候 ${waitSeconds} 秒後再試`,
          waitSeconds
        );
      }
    }

    // 生成安全的隨機 token
    const rawToken = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
    const tokenHash = await this.hashToken(rawToken);

    // 計算過期時間
    const expiryHours = env.PASSWORD_RESET_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // 儲存 token
    const tokenRecord = await this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
    });

    // 記錄審計日誌
    await this.logAudit(user.id, 'PASSWORD_RESET_REQUEST', {
      tokenId: tokenRecord.id,
      email: normalizedEmail,
    }, ipAddress);

    // 發送郵件
    const resetUrl = this.buildResetUrl(rawToken);
    const emailContent = generatePasswordResetEmail({
      resetUrl,
      expiryHours,
      userEmail: normalizedEmail,
    });

    const emailResult = await this.emailService.send({
      to: normalizedEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (!emailResult.success) {
      logger.error(
        { userId: user.id, error: emailResult.error },
        'Failed to send password reset email'
      );
      // 即使郵件發送失敗，也不要暴露給用戶
    } else {
      logger.info(
        { userId: user.id, messageId: emailResult.messageId },
        'Password reset email sent'
      );
    }

    return {
      success: true,
      message: '如果此電子郵件存在，您將收到密碼重設連結',
    };
  }

  /**
   * 驗證重設 Token
   */
  async validateResetToken(token: string): Promise<ValidateResetTokenResult> {
    if (!token || token.length !== TOKEN_LENGTH * 2) {
      return {
        valid: false,
        error: '無效的重設連結',
      };
    }

    const tokenHash = await this.hashToken(token);

    // 查詢所有未使用且未過期的 token
    const allTokens = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // 比對 hash
    const matchingToken = allTokens.find((t) => t.tokenHash === tokenHash);

    if (!matchingToken) {
      logger.warn('Invalid or expired reset token attempted');
      return {
        valid: false,
        error: '重設連結無效或已過期',
      };
    }

    return {
      valid: true,
      expiresAt: matchingToken.expiresAt,
    };
  }

  /**
   * 執行密碼重設
   */
  async resetPassword(
    request: ResetPasswordRequest,
    ipAddress?: string
  ): Promise<ResetPasswordResult> {
    const { token, newPassword, confirmPassword } = request;

    // 驗證密碼一致性
    if (newPassword !== confirmPassword) {
      throw new ValidationError('新密碼與確認密碼不一致');
    }

    // 驗證密碼強度
    if (!meetsMinimumRequirements(newPassword)) {
      throw new ValidationError(
        '密碼不符合安全要求（至少 8 字元，包含大小寫字母和數字）'
      );
    }

    // 驗證 Token
    const tokenValidation = await this.validateResetToken(token);
    if (!tokenValidation.valid) {
      throw new ValidationError(tokenValidation.error || '無效的重設連結');
    }

    // 找到對應的 token 記錄
    const tokenHash = await this.hashToken(token);
    const allTokens = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    const matchingToken = allTokens.find((t) => t.tokenHash === tokenHash);

    if (!matchingToken) {
      throw new ValidationError('重設連結無效或已過期');
    }

    // 雜湊新密碼
    const newPasswordHash = await User.hashPassword(newPassword);

    // 更新密碼
    await this.userRepository.updatePassword(matchingToken.userId, newPasswordHash);

    // 標記 token 為已使用
    await this.tokenRepository.markAsUsed(matchingToken.id);

    // 使所有其他 token 失效
    await this.tokenRepository.invalidateAllForUser(matchingToken.userId);

    // 記錄審計日誌
    await this.logAudit(matchingToken.userId, 'PASSWORD_RESET_COMPLETE', {
      tokenId: matchingToken.id,
      method: 'reset',
    }, ipAddress);

    logger.info(
      { userId: matchingToken.userId },
      'Password reset completed successfully'
    );

    return {
      success: true,
      message: '密碼已成功重設，請使用新密碼登入',
    };
  }

  /**
   * 生成 token 的 hash
   * 使用 SHA-256 而非 bcrypt，因為 token 本身已是高熵隨機值
   */
  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 建立密碼重設 URL
   */
  private buildResetUrl(token: string): string {
    // 使用 NEXT_PUBLIC_API_URL（用戶設定的 URL）或環境變數或預設值
    const baseUrl = env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return `${baseUrl}/reset-password?token=${token}`;
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
}
