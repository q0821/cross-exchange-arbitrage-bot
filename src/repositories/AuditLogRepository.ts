/**
 * AuditLogRepository
 *
 * Repository for managing audit logs (Constitution Principle II: Complete Observability)
 * Tracks all critical user operations for security and compliance
 *
 * Based on FR-053: Record all key operations (login, API key changes, trades)
 */

import { PrismaClient, AuditLog, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';

export class AuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new audit log entry
   *
   * @param data Audit log data
   * @returns Created audit log
   */
  async create(
    data: Omit<Prisma.AuditLogCreateInput, 'createdAt'> & {
      user?: { connect: { id: string } };
    },
  ): Promise<AuditLog> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          action: data.action,
          resource: data.resource,
          details: data.details as Prisma.JsonObject,
          ipAddress: data.ipAddress,
          user: data.user,
        },
      });

      logger.info(
        {
          auditLogId: auditLog.id,
          userId: auditLog.userId,
          action: auditLog.action,
        },
        'Audit log created',
      );

      return auditLog;
    } catch (error) {
      logger.error(
        { error, action: data.action },
        'Failed to create audit log',
      );
      throw error;
    }
  }

  /**
   * Log user login
   */
  async logLogin(userId: string, ipAddress?: string): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'LOGIN',
      resource: 'auth',
      ipAddress,
    });
  }

  /**
   * Log user logout
   */
  async logLogout(userId: string, ipAddress?: string): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'LOGOUT',
      resource: 'auth',
      ipAddress,
    });
  }

  /**
   * Log API key addition
   */
  async logApiKeyAdd(
    userId: string,
    apiKeyId: string,
    exchange: string,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'APIKEY_ADD',
      resource: `apikey:${apiKeyId}`,
      details: { exchange },
      ipAddress,
    });
  }

  /**
   * Log API key deletion
   */
  async logApiKeyDelete(
    userId: string,
    apiKeyId: string,
    exchange: string,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'APIKEY_DELETE',
      resource: `apikey:${apiKeyId}`,
      details: { exchange },
      ipAddress,
    });
  }

  /**
   * Log API key status change
   */
  async logApiKeyStatusChange(
    userId: string,
    apiKeyId: string,
    isActive: boolean,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'APIKEY_STATUS_CHANGE',
      resource: `apikey:${apiKeyId}`,
      details: { isActive },
      ipAddress,
    });
  }

  /**
   * Log position open
   */
  async logPositionOpen(
    userId: string,
    positionId: string,
    symbol: string,
    positionSize: number,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'POSITION_OPEN',
      resource: `position:${positionId}`,
      details: { symbol, positionSize },
      ipAddress,
    });
  }

  /**
   * Log position close
   */
  async logPositionClose(
    userId: string,
    positionId: string,
    symbol: string,
    pnl: number,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: userId } },
      action: 'POSITION_CLOSE',
      resource: `position:${positionId}`,
      details: { symbol, pnl },
      ipAddress,
    });
  }

  /**
   * Log suspicious activity (FR-054)
   */
  async logSuspiciousActivity(
    userId: string | null,
    activityType: string,
    details: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return this.create({
      user: userId ? { connect: { id: userId } } : undefined,
      action: 'SUSPICIOUS_ACTIVITY',
      resource: activityType,
      details,
      ipAddress,
    });
  }

  /**
   * Get audit logs for a user
   *
   * @param userId User ID
   * @param options Query options
   * @returns Paginated audit logs
   */
  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{ items: AuditLog[]; total: number }> {
    try {
      const where: Prisma.AuditLogWhereInput = {
        userId,
        ...(options?.action && { action: options.action }),
        ...(options?.startDate &&
          options?.endDate && {
            createdAt: {
              gte: options.startDate,
              lte: options.endDate,
            },
          }),
      };

      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip: options?.skip || 0,
          take: options?.take || 20,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return { items, total };
    } catch (error) {
      logger.error(
        { error, userId, options },
        'Failed to fetch audit logs for user',
      );
      throw error;
    }
  }

  /**
   * Get recent audit logs (admin view)
   *
   * @param options Query options
   * @returns Paginated audit logs
   */
  async findRecent(options?: {
    skip?: number;
    take?: number;
    action?: string;
  }): Promise<{ items: AuditLog[]; total: number }> {
    try {
      const where: Prisma.AuditLogWhereInput = {
        ...(options?.action && { action: options.action }),
      };

      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip: options?.skip || 0,
          take: options?.take || 100,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return { items, total };
    } catch (error) {
      logger.error({ error, options }, 'Failed to fetch recent audit logs');
      throw error;
    }
  }

  /**
   * Count suspicious activities in time window (for FR-054 detection)
   *
   * @param userId User ID
   * @param minutesWindow Time window in minutes
   * @returns Count of suspicious activities
   */
  async countSuspiciousActivities(
    userId: string,
    minutesWindow: number = 5,
  ): Promise<number> {
    try {
      const since = new Date(Date.now() - minutesWindow * 60 * 1000);

      const count = await this.prisma.auditLog.count({
        where: {
          userId,
          action: 'SUSPICIOUS_ACTIVITY',
          createdAt: {
            gte: since,
          },
        },
      });

      return count;
    } catch (error) {
      logger.error(
        { error, userId, minutesWindow },
        'Failed to count suspicious activities',
      );
      throw error;
    }
  }
}

// Export singleton instance
export const auditLogRepository = new AuditLogRepository(new PrismaClient());
