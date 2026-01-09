/**
 * PasswordResetTokenRepository (Feature 061: 密碼管理)
 *
 * 處理密碼重設 Token 的持久化操作
 */
import { PrismaClient, PasswordResetToken } from '@/generated/prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError, NotFoundError } from '@lib/errors';

export interface CreateTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
}

export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 建立密碼重設 Token
   */
  async create(data: CreateTokenData): Promise<PasswordResetToken> {
    try {
      const token = await this.prisma.passwordResetToken.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
        },
      });

      logger.info({ tokenId: token.id, userId: data.userId }, 'Password reset token created');

      return token;
    } catch (error) {
      logger.error({ error, userId: data.userId }, 'Failed to create password reset token');
      throw new DatabaseError('Failed to create password reset token', { userId: data.userId });
    }
  }

  /**
   * 根據 ID 查詢 Token
   */
  async findById(id: string): Promise<PasswordResetToken | null> {
    try {
      return await this.prisma.passwordResetToken.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, tokenId: id }, 'Failed to find password reset token');
      throw new DatabaseError('Failed to find password reset token', { tokenId: id });
    }
  }

  /**
   * 查詢用戶最新的有效 Token（未使用、未過期）
   */
  async findLatestValidToken(userId: string): Promise<PasswordResetToken | null> {
    try {
      return await this.prisma.passwordResetToken.findFirst({
        where: {
          userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find latest valid token');
      throw new DatabaseError('Failed to find latest valid token', { userId });
    }
  }

  /**
   * 查詢用戶最近一次的 Token 請求時間
   */
  async findLastRequestTime(userId: string): Promise<Date | null> {
    try {
      const token = await this.prisma.passwordResetToken.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      return token?.createdAt ?? null;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find last request time');
      throw new DatabaseError('Failed to find last request time', { userId });
    }
  }

  /**
   * 根據 tokenHash 查詢 Token（用於驗證重設連結）
   */
  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    try {
      // 因為我們存儲的是 hash，需要查詢所有未使用的 token 並比對
      // 這裡假設前端傳來的是原始 token，需要重新 hash 比對
      // 由於 bcrypt 不支援直接查詢，我們需要在 service 層處理
      // 這個方法僅用於根據已知的 hash 查詢
      const tokens = await this.prisma.passwordResetToken.findMany({
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      // 返回符合的 token（實際比對在 service 層進行）
      return tokens.find((t) => t.tokenHash === tokenHash) ?? null;
    } catch (error) {
      logger.error({ error }, 'Failed to find token by hash');
      throw new DatabaseError('Failed to find token by hash');
    }
  }

  /**
   * 查詢所有用戶未使用的 Token（用於 bcrypt 比對）
   */
  async findAllValidTokensForUser(userId: string): Promise<PasswordResetToken[]> {
    try {
      return await this.prisma.passwordResetToken.findMany({
        where: {
          userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find valid tokens for user');
      throw new DatabaseError('Failed to find valid tokens for user', { userId });
    }
  }

  /**
   * 標記 Token 為已使用
   */
  async markAsUsed(id: string): Promise<void> {
    try {
      await this.prisma.passwordResetToken.update({
        where: { id },
        data: { usedAt: new Date() },
      });

      logger.info({ tokenId: id }, 'Password reset token marked as used');
    } catch (error) {
      logger.error({ error, tokenId: id }, 'Failed to mark token as used');

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        throw new NotFoundError('PasswordResetToken', id);
      }

      throw new DatabaseError('Failed to mark token as used', { tokenId: id });
    }
  }

  /**
   * 使所有用戶的 Token 失效（密碼變更後使用）
   */
  async invalidateAllForUser(userId: string): Promise<number> {
    try {
      const result = await this.prisma.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      if (result.count > 0) {
        logger.info({ userId, count: result.count }, 'Invalidated all password reset tokens for user');
      }

      return result.count;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to invalidate tokens for user');
      throw new DatabaseError('Failed to invalidate tokens for user', { userId });
    }
  }

  /**
   * 清理過期的 Token（定期任務使用）
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        logger.info({ count: result.count }, 'Cleaned up expired password reset tokens');
      }

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired tokens');
      throw new DatabaseError('Failed to cleanup expired tokens');
    }
  }

  /**
   * 計算用戶在指定時間內的請求次數（用於 rate limiting）
   */
  async countRecentRequests(userId: string, sinceDate: Date): Promise<number> {
    try {
      return await this.prisma.passwordResetToken.count({
        where: {
          userId,
          createdAt: { gte: sinceDate },
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count recent requests');
      throw new DatabaseError('Failed to count recent requests', { userId });
    }
  }
}
