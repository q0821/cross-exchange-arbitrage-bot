/**
 * Admin User Service (Feature 068)
 *
 * 用戶管理服務
 */

import bcrypt from 'bcrypt';
import { prisma } from '@lib/db';
import { generateSecurePassword, validateEmail } from '@lib/admin/auth';
import { BaseError } from '@lib/errors';
import type {
  AdminUserListItem,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserDetail,
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRequest,
  ResetPasswordResponse,
  SuspendUserRequest,
  SuspendUserResponse,
  DeleteUserRequest,
} from '@/src/types/admin';

// ===== Error Classes =====

export class UserNotFoundError extends BaseError {
  constructor(message: string = 'User not found') {
    super(message, 'USER_NOT_FOUND', 404);
  }
}

export class EmailAlreadyExistsError extends BaseError {
  constructor(message: string = 'Email already exists') {
    super(message, 'EMAIL_ALREADY_EXISTS', 409);
  }
}

export class InvalidEmailError extends BaseError {
  constructor(message: string = 'Invalid email format') {
    super(message, 'INVALID_EMAIL', 400);
  }
}

export class ConfirmationRequiredError extends BaseError {
  constructor(message: string = 'Confirmation required') {
    super(message, 'CONFIRMATION_REQUIRED', 400);
  }
}

export class ActivePositionsError extends BaseError {
  constructor(message: string = 'Cannot delete user with active positions') {
    super(message, 'ACTIVE_POSITIONS', 409);
  }
}

export class SelfDeleteError extends BaseError {
  constructor(message: string = 'Cannot delete yourself') {
    super(message, 'SELF_DELETE', 403);
  }
}

// ===== Service =====

export class AdminUserService {
  /**
   * 獲取用戶列表（支援分頁、搜尋、篩選）
   */
  async listUsers(query: AdminUserListQuery): Promise<AdminUserListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // 構建查詢條件
    const where: {
      email?: { contains: string; mode: 'insensitive' };
      isActive?: boolean;
    } = {};

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // 查詢用戶
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              positions: { where: { status: { in: ['OPEN', 'OPENING'] } } },
              trades: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // 獲取最後登入時間
    const items: AdminUserListItem[] = await Promise.all(
      users.map(async (user) => {
        const lastLogin = await prisma.auditLog.findFirst({
          where: { userId: user.id, action: 'LOGIN' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLoginAt: lastLogin?.createdAt,
          positionCount: user._count.positions,
          tradeCount: user._count.trades,
        };
      })
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  /**
   * 獲取用戶詳細資料
   */
  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        passwordChangedAt: true,
        timeBasisPreference: true,
        _count: {
          select: {
            positions: { where: { status: { in: ['OPEN', 'OPENING'] } } },
            trades: true,
          },
        },
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    // 獲取 API Key 數量
    const apiKeyCount = await prisma.apiKey.count({
      where: { userId },
    });

    // 獲取總損益
    const tradeAgg = await prisma.trade.aggregate({
      where: { userId },
      _sum: { totalPnL: true },
    });

    const totalPnL = tradeAgg._sum.totalPnL
      ? (typeof tradeAgg._sum.totalPnL === 'object' && 'toNumber' in tradeAgg._sum.totalPnL
          ? (tradeAgg._sum.totalPnL as { toNumber: () => number }).toNumber()
          : Number(tradeAgg._sum.totalPnL))
      : 0;

    // 獲取最後登入時間
    const lastLogin = await prisma.auditLog.findFirst({
      where: { userId, action: 'LOGIN' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: lastLogin?.createdAt,
      positionCount: user._count.positions,
      tradeCount: user._count.trades,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil ?? undefined,
      passwordChangedAt: user.passwordChangedAt ?? undefined,
      timeBasisPreference: user.timeBasisPreference,
      apiKeyCount,
      totalPnL: totalPnL.toFixed(2),
    };
  }

  /**
   * 建立新用戶
   */
  async createUser(
    request: CreateUserRequest,
    adminUserId: string
  ): Promise<CreateUserResponse> {
    const { email, role = 'USER' } = request;

    // 驗證 email 格式
    if (!validateEmail(email)) {
      throw new InvalidEmailError();
    }

    // 檢查 email 是否已存在
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    // 產生安全密碼
    const initialPassword = generateSecurePassword();
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // 建立用戶
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            positions: true,
            trades: true,
          },
        },
      },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_CREATE',
        resource: `admin/users/${user.id}`,
        details: {
          targetUserId: user.id,
          targetEmail: email,
          role,
        },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        positionCount: user._count.positions,
        tradeCount: user._count.trades,
      },
      initialPassword,
    };
  }

  /**
   * 更新用戶資料
   */
  async updateUser(
    userId: string,
    request: UpdateUserRequest,
    adminUserId: string
  ): Promise<AdminUserListItem> {
    const { email } = request;

    // 查找用戶
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    // 如果要更新 email，檢查是否已被使用
    if (email && email !== user.email) {
      if (!validateEmail(email)) {
        throw new InvalidEmailError();
      }

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing && existing.id !== userId) {
        throw new BaseError('Email already in use', 'EMAIL_IN_USE', 409);
      }
    }

    // 更新用戶
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: email ? { email } : {},
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            positions: { where: { status: { in: ['OPEN', 'OPENING'] } } },
            trades: true,
          },
        },
      },
    });

    // 記錄審計日誌
    if (email && email !== user.email) {
      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_USER_UPDATE',
          resource: `admin/users/${userId}`,
          details: {
            targetUserId: userId,
            changes: {
              email: { from: user.email, to: email },
            },
          },
        },
      });
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      positionCount: updatedUser._count.positions,
      tradeCount: updatedUser._count.trades,
    };
  }

  /**
   * 重設用戶密碼
   */
  async resetPassword(userId: string, adminUserId: string): Promise<ResetPasswordResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    // 產生新密碼
    const newPassword = generateSecurePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密碼並遞增 tokenVersion 使舊 session 失效
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_RESET_PASSWORD',
        resource: `admin/users/${userId}`,
        details: {
          targetUserId: userId,
          targetEmail: user.email,
        },
      },
    });

    return { newPassword };
  }

  /**
   * 停用用戶
   */
  async suspendUser(
    userId: string,
    request: SuspendUserRequest,
    adminUserId: string
  ): Promise<SuspendUserResponse> {
    if (!request.confirm) {
      throw new ConfirmationRequiredError();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    // 檢查是否有活躍持倉
    const activePositions = await prisma.position.count({
      where: { userId, status: { in: ['OPEN', 'OPENING'] } },
    });

    // 停用用戶並遞增 tokenVersion 使 session 立即失效
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_SUSPEND',
        resource: `admin/users/${userId}`,
        details: {
          targetUserId: userId,
          targetEmail: user.email,
          hadActivePositions: activePositions > 0,
          confirmedWithWarning: activePositions > 0,
        },
      },
    });

    return {
      id: userId,
      isActive: false,
      warning: activePositions > 0
        ? `User has ${activePositions} active positions that will remain open`
        : undefined,
    };
  }

  /**
   * 啟用用戶
   */
  async enableUser(userId: string, adminUserId: string): Promise<{ id: string; isActive: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_ENABLE',
        resource: `admin/users/${userId}`,
        details: {
          targetUserId: userId,
          targetEmail: user.email,
        },
      },
    });

    return { id: userId, isActive: true };
  }

  /**
   * 刪除用戶
   */
  async deleteUser(
    userId: string,
    request: DeleteUserRequest,
    adminUserId: string
  ): Promise<void> {
    // 防止自我刪除
    if (userId === adminUserId) {
      throw new SelfDeleteError();
    }

    // 驗證確認文字
    if (request.confirmText !== 'DELETE') {
      throw new BaseError('Invalid confirmation', 'INVALID_CONFIRMATION', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    // 檢查是否有活躍持倉
    const activePositions = await prisma.position.count({
      where: { userId, status: { in: ['OPEN', 'OPENING'] } },
    });

    if (activePositions > 0) {
      throw new ActivePositionsError();
    }

    // 在 transaction 中刪除用戶及相關資料
    await prisma.$transaction(async (tx) => {
      // 統計要刪除的資料
      const [positionCount, tradeCount, apiKeyCount] = await Promise.all([
        tx.position.count({ where: { userId } }),
        tx.trade.count({ where: { userId } }),
        tx.apiKey.count({ where: { userId } }),
      ]);

      // 刪除相關資料（順序很重要，因為有外鍵約束）
      await tx.trade.deleteMany({ where: { userId } });
      await tx.position.deleteMany({ where: { userId } });
      await tx.apiKey.deleteMany({ where: { userId } });

      // 刪除用戶
      await tx.user.delete({ where: { id: userId } });

      // 記錄審計日誌
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_USER_DELETE',
          resource: `admin/users/${userId}`,
          details: {
            targetUserId: userId,
            targetEmail: user.email,
            relatedDataDeleted: {
              positions: positionCount,
              trades: tradeCount,
              apiKeys: apiKeyCount,
            },
          },
        },
      });
    });
  }
}
