import { PrismaClient, User as PrismaUser } from '@/generated/prisma/client';
import { User, CreateUserData } from '@models/User';
import { logger } from '@lib/logger';
import { DatabaseError, NotFoundError } from '@lib/errors';

/**
 * UserRepository
 * 處理用戶資料的持久化操作
 */

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 根據 ID 查詢用戶
   */
  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return null;
      }

      return User.fromPrisma(user);
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to find user by ID');
      throw new DatabaseError('Failed to find user', { userId: id });
    }
  }

  /**
   * 根據 Email 查詢用戶
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return null;
      }

      return User.fromPrisma(user);
    } catch (error) {
      logger.error({ error, email }, 'Failed to find user by email');
      throw new DatabaseError('Failed to find user', { email });
    }
  }

  /**
   * 建立新用戶
   */
  async create(data: CreateUserData, passwordHash: string): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          password: passwordHash,
        },
      });

      logger.info({ userId: user.id, email: user.email }, 'User created successfully');

      return User.fromPrisma(user);
    } catch (error) {
      logger.error({ error, email: data.email }, 'Failed to create user');

      // 檢查是否為唯一性約束錯誤
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new DatabaseError('Email already exists', { email: data.email });
      }

      throw new DatabaseError('Failed to create user', { email: data.email });
    }
  }

  /**
   * 更新用戶
   */
  async update(id: string, data: Partial<PrismaUser>): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      logger.info({ userId: id }, 'User updated successfully');

      return User.fromPrisma(user);
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update user');

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        throw new NotFoundError('User', id);
      }

      throw new DatabaseError('Failed to update user', { userId: id });
    }
  }

  /**
   * 刪除用戶（Cascade 會自動刪除關聯的 API Keys, Positions, Trades）
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });

      logger.info({ userId: id }, 'User deleted successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to delete user');

      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new NotFoundError('User', id);
      }

      throw new DatabaseError('Failed to delete user', { userId: id });
    }
  }

  /**
   * 檢查 Email 是否已存在
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const count = await this.prisma.user.count({
        where: { email: email.toLowerCase() },
      });

      return count > 0;
    } catch (error) {
      logger.error({ error, email }, 'Failed to check email existence');
      throw new DatabaseError('Failed to check email existence', { email });
    }
  }

  /**
   * 查詢所有用戶（管理用途）
   */
  async findAll(limit = 100, offset = 0): Promise<User[]> {
    try {
      const users = await this.prisma.user.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return users.map(User.fromPrisma);
    } catch (error) {
      logger.error({ error }, 'Failed to find all users');
      throw new DatabaseError('Failed to find all users');
    }
  }

  // =========================================================================
  // 帳戶鎖定相關方法 (Feature 061)
  // =========================================================================

  /**
   * 增加登入失敗次數
   */
  async incrementFailedAttempts(userId: string): Promise<number> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
        select: { failedLoginAttempts: true },
      });

      logger.debug({ userId, failedAttempts: user.failedLoginAttempts }, 'Incremented failed login attempts');

      return user.failedLoginAttempts;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to increment failed attempts');
      throw new DatabaseError('Failed to increment failed attempts', { userId });
    }
  }

  /**
   * 重置登入失敗次數（登入成功時呼叫）
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      logger.debug({ userId }, 'Reset failed login attempts');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to reset failed attempts');
      throw new DatabaseError('Failed to reset failed attempts', { userId });
    }
  }

  /**
   * 鎖定帳戶
   */
  async lockAccount(userId: string, lockedUntil: Date): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });

      logger.warn({ userId, lockedUntil }, 'Account locked');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to lock account');
      throw new DatabaseError('Failed to lock account', { userId });
    }
  }

  /**
   * 解鎖帳戶
   */
  async unlockAccount(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });

      logger.info({ userId }, 'Account unlocked');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to unlock account');
      throw new DatabaseError('Failed to unlock account', { userId });
    }
  }

  /**
   * 檢查帳戶是否被鎖定
   */
  async isAccountLocked(userId: string): Promise<{ isLocked: boolean; lockedUntil: Date | null }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { lockedUntil: true },
      });

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const isLocked = user.lockedUntil !== null && user.lockedUntil > new Date();

      return { isLocked, lockedUntil: user.lockedUntil };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error({ error, userId }, 'Failed to check account lock status');
      throw new DatabaseError('Failed to check account lock status', { userId });
    }
  }

  /**
   * 取得帳戶鎖定狀態詳情
   */
  async getLockStatus(
    userId: string
  ): Promise<{ isLocked: boolean; lockedUntil: Date | null; failedAttempts: number }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { lockedUntil: true, failedLoginAttempts: true },
      });

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const isLocked = user.lockedUntil !== null && user.lockedUntil > new Date();

      return {
        isLocked,
        lockedUntil: user.lockedUntil,
        failedAttempts: user.failedLoginAttempts,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error({ error, userId }, 'Failed to get lock status');
      throw new DatabaseError('Failed to get lock status', { userId });
    }
  }

  // =========================================================================
  // 密碼管理相關方法 (Feature 061)
  // =========================================================================

  /**
   * 更新密碼並遞增 tokenVersion（讓所有現有 session 失效）
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          tokenVersion: { increment: 1 },
          passwordChangedAt: new Date(),
          // 密碼變更成功時重置鎖定狀態
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      logger.info({ userId }, 'Password updated successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update password');
      throw new DatabaseError('Failed to update password', { userId });
    }
  }

  /**
   * 取得用戶的 tokenVersion（用於 JWT 驗證）
   */
  async getTokenVersion(userId: string): Promise<number> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      });

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      return user.tokenVersion;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error({ error, userId }, 'Failed to get token version');
      throw new DatabaseError('Failed to get token version', { userId });
    }
  }
}
