import { PrismaClient, User as PrismaUser } from '@prisma/client';
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
}
