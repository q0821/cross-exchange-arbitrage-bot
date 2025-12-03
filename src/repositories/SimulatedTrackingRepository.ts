import {
  PrismaClient,
  SimulatedTracking as PrismaTracking,
  TrackingStatus,
} from '@prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError, NotFoundError } from '@lib/errors';
import type {
  CreateTrackingInput,
  TrackingResponse,
  TrackingWithUser,
  TrackingQueryInput,
  PaginationInfo,
} from '../models/SimulatedTracking';
import { MAX_ACTIVE_TRACKINGS } from '../models/SimulatedTracking';

/**
 * SimulatedTrackingRepository
 * 處理模擬套利追蹤的持久化操作
 * Feature 029: Simulated APY Tracking
 */
export class SimulatedTrackingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 將 Prisma 模型轉換為 TrackingWithUser
   */
  private toTrackingWithUser(tracking: PrismaTracking): TrackingWithUser {
    return {
      id: tracking.id,
      userId: tracking.userId,
      symbol: tracking.symbol,
      longExchange: tracking.longExchange,
      shortExchange: tracking.shortExchange,
      simulatedCapital: Number(tracking.simulatedCapital),
      autoStopOnExpire: tracking.autoStopOnExpire,
      initialSpread: Number(tracking.initialSpread),
      initialAPY: Number(tracking.initialAPY),
      initialLongRate: Number(tracking.initialLongRate),
      initialShortRate: Number(tracking.initialShortRate),
      // 開倉價格和固定顆數
      initialLongPrice: tracking.initialLongPrice ? Number(tracking.initialLongPrice) : null,
      initialShortPrice: tracking.initialShortPrice ? Number(tracking.initialShortPrice) : null,
      positionQuantity: tracking.positionQuantity ? Number(tracking.positionQuantity) : null,
      // 平倉價格和損益
      exitLongPrice: tracking.exitLongPrice ? Number(tracking.exitLongPrice) : null,
      exitShortPrice: tracking.exitShortPrice ? Number(tracking.exitShortPrice) : null,
      pricePnl: tracking.pricePnl ? Number(tracking.pricePnl) : null,
      fundingPnl: tracking.fundingPnl ? Number(tracking.fundingPnl) : null,
      totalPnl: tracking.totalPnl ? Number(tracking.totalPnl) : null,
      longIntervalHours: tracking.longIntervalHours,
      shortIntervalHours: tracking.shortIntervalHours,
      status: tracking.status as TrackingWithUser['status'],
      startedAt: tracking.startedAt,
      stoppedAt: tracking.stoppedAt,
      totalFundingProfit: Number(tracking.totalFundingProfit),
      totalSettlements: tracking.totalSettlements,
      maxSpread: Number(tracking.maxSpread),
      minSpread: Number(tracking.minSpread),
    };
  }

  /**
   * 轉換為 API 回應格式
   */
  toResponse(tracking: TrackingWithUser): TrackingResponse {
    const durationMs = tracking.stoppedAt
      ? tracking.stoppedAt.getTime() - tracking.startedAt.getTime()
      : Date.now() - tracking.startedAt.getTime();

    return {
      id: tracking.id,
      symbol: tracking.symbol,
      longExchange: tracking.longExchange,
      shortExchange: tracking.shortExchange,
      simulatedCapital: tracking.simulatedCapital,
      autoStopOnExpire: tracking.autoStopOnExpire,
      initialSpread: tracking.initialSpread,
      initialAPY: tracking.initialAPY,
      initialLongRate: tracking.initialLongRate,
      initialShortRate: tracking.initialShortRate,
      // 開倉價格和固定顆數
      initialLongPrice: tracking.initialLongPrice,
      initialShortPrice: tracking.initialShortPrice,
      positionQuantity: tracking.positionQuantity,
      // 平倉價格和損益
      exitLongPrice: tracking.exitLongPrice,
      exitShortPrice: tracking.exitShortPrice,
      pricePnl: tracking.pricePnl,
      fundingPnl: tracking.fundingPnl,
      totalPnl: tracking.totalPnl,
      longIntervalHours: tracking.longIntervalHours,
      shortIntervalHours: tracking.shortIntervalHours,
      status: tracking.status,
      startedAt: tracking.startedAt.toISOString(),
      stoppedAt: tracking.stoppedAt?.toISOString() || null,
      totalFundingProfit: tracking.totalFundingProfit,
      totalSettlements: tracking.totalSettlements,
      maxSpread: tracking.maxSpread,
      minSpread: tracking.minSpread,
      durationFormatted: this.formatDuration(durationMs),
    };
  }

  /**
   * 格式化持續時間
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days} 天 ${remainingHours} 小時`;
    }

    if (hours > 0) {
      return `${hours} 小時 ${minutes} 分鐘`;
    }

    return `${minutes} 分鐘`;
  }

  /**
   * 計算用戶活躍追蹤數量
   */
  async countActiveByUserId(userId: string): Promise<number> {
    try {
      return await this.prisma.simulatedTracking.count({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count active trackings');
      throw new DatabaseError('Failed to count active trackings', { userId });
    }
  }

  /**
   * 檢查是否已存在相同的活躍追蹤
   */
  async existsActiveTracking(
    userId: string,
    symbol: string,
    longExchange: string,
    shortExchange: string
  ): Promise<boolean> {
    try {
      const count = await this.prisma.simulatedTracking.count({
        where: {
          userId,
          symbol,
          longExchange,
          shortExchange,
          status: 'ACTIVE',
        },
      });
      return count > 0;
    } catch (error) {
      logger.error(
        { error, userId, symbol },
        'Failed to check existing tracking'
      );
      throw new DatabaseError('Failed to check existing tracking', { userId });
    }
  }

  /**
   * 建立新的追蹤
   */
  async create(
    userId: string,
    data: CreateTrackingInput & {
      initialSpread: number;
      initialAPY: number;
      initialLongRate: number;
      initialShortRate: number;
      longIntervalHours: number;
      shortIntervalHours: number;
      // 開倉價格和固定顆數
      initialLongPrice?: number;
      initialShortPrice?: number;
      positionQuantity?: number;
    }
  ): Promise<TrackingWithUser> {
    try {
      // 檢查活躍追蹤數量限制
      const activeCount = await this.countActiveByUserId(userId);
      if (activeCount >= MAX_ACTIVE_TRACKINGS) {
        throw new Error(
          `Maximum ${MAX_ACTIVE_TRACKINGS} active trackings allowed`
        );
      }

      // 檢查重複追蹤
      const exists = await this.existsActiveTracking(
        userId,
        data.symbol,
        data.longExchange,
        data.shortExchange
      );
      if (exists) {
        throw new Error('Already tracking this opportunity');
      }

      const tracking = await this.prisma.simulatedTracking.create({
        data: {
          userId,
          symbol: data.symbol,
          longExchange: data.longExchange,
          shortExchange: data.shortExchange,
          simulatedCapital: data.simulatedCapital,
          autoStopOnExpire: data.autoStopOnExpire,
          initialSpread: data.initialSpread,
          initialAPY: data.initialAPY,
          initialLongRate: data.initialLongRate,
          initialShortRate: data.initialShortRate,
          longIntervalHours: data.longIntervalHours,
          shortIntervalHours: data.shortIntervalHours,
          // 開倉價格和固定顆數
          initialLongPrice: data.initialLongPrice,
          initialShortPrice: data.initialShortPrice,
          positionQuantity: data.positionQuantity,
          minSpread: data.initialSpread,
          maxSpread: data.initialSpread,
        },
      });

      logger.info(
        { trackingId: tracking.id, userId, symbol: data.symbol },
        'Tracking created successfully'
      );

      return this.toTrackingWithUser(tracking);
    } catch (error) {
      // 保留業務邏輯錯誤
      if (error instanceof Error && error.message.includes('Maximum')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('Already tracking')) {
        throw error;
      }

      // 解析 Prisma 錯誤並提供友好訊息
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 外鍵約束錯誤 (P2003) - 用戶不存在
      if (errorMessage.includes('Foreign key constraint') || errorMessage.includes('P2003')) {
        logger.error({ error, userId, symbol: data.symbol }, 'User not found in database');
        throw new DatabaseError('用戶帳號不存在，請重新登入', { userId });
      }

      // 唯一性約束錯誤 (P2002) - 重複追蹤
      if (errorMessage.includes('Unique constraint') || errorMessage.includes('P2002')) {
        logger.error({ error, userId, symbol: data.symbol }, 'Duplicate tracking attempt');
        throw new DatabaseError('此套利機會已在追蹤中', { userId });
      }

      // 其他錯誤：記錄完整訊息以便排查
      logger.error(
        {
          error,
          errorMessage,
          userId,
          symbol: data.symbol,
          data: {
            longExchange: data.longExchange,
            shortExchange: data.shortExchange,
            simulatedCapital: data.simulatedCapital,
          },
        },
        'Failed to create tracking'
      );
      throw new DatabaseError(`建立追蹤失敗: ${errorMessage}`, { userId });
    }
  }

  /**
   * 根據 ID 查詢追蹤
   */
  async findById(id: string): Promise<TrackingWithUser | null> {
    try {
      const tracking = await this.prisma.simulatedTracking.findUnique({
        where: { id },
      });

      if (!tracking) {
        return null;
      }

      return this.toTrackingWithUser(tracking);
    } catch (error) {
      logger.error({ error, trackingId: id }, 'Failed to find tracking by ID');
      throw new DatabaseError('Failed to find tracking', { trackingId: id });
    }
  }

  /**
   * 查詢用戶的追蹤列表
   */
  async findByUserId(
    userId: string,
    options: TrackingQueryInput
  ): Promise<{ trackings: TrackingWithUser[]; pagination: PaginationInfo }> {
    try {
      const where: { userId: string; status?: TrackingStatus } = { userId };

      if (options.status !== 'all') {
        where.status = options.status as TrackingStatus;
      }

      const [trackings, total] = await Promise.all([
        this.prisma.simulatedTracking.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          take: options.limit,
          skip: options.offset,
        }),
        this.prisma.simulatedTracking.count({ where }),
      ]);

      return {
        trackings: trackings.map((t) => this.toTrackingWithUser(t)),
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + trackings.length < total,
        },
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find trackings by user ID');
      throw new DatabaseError('Failed to find trackings', { userId });
    }
  }

  /**
   * 查詢所有活躍的追蹤（供快照服務使用）
   */
  async findAllActive(): Promise<TrackingWithUser[]> {
    try {
      const trackings = await this.prisma.simulatedTracking.findMany({
        where: { status: 'ACTIVE' },
      });

      return trackings.map((t) => this.toTrackingWithUser(t));
    } catch (error) {
      logger.error({ error }, 'Failed to find all active trackings');
      throw new DatabaseError('Failed to find active trackings');
    }
  }

  /**
   * 停止追蹤
   */
  async stop(
    id: string,
    userId: string,
    pnlData?: {
      exitLongPrice: number;
      exitShortPrice: number;
      pricePnl: number;
      fundingPnl: number;
      totalPnl: number;
    }
  ): Promise<TrackingWithUser> {
    try {
      const existing = await this.prisma.simulatedTracking.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Tracking not found');
      }

      if (existing.status !== 'ACTIVE') {
        throw new Error('Tracking is already stopped');
      }

      const tracking = await this.prisma.simulatedTracking.update({
        where: { id },
        data: {
          status: 'STOPPED',
          stoppedAt: new Date(),
          // 平倉價格和損益
          ...(pnlData && {
            exitLongPrice: pnlData.exitLongPrice,
            exitShortPrice: pnlData.exitShortPrice,
            pricePnl: pnlData.pricePnl,
            fundingPnl: pnlData.fundingPnl,
            totalPnl: pnlData.totalPnl,
          }),
        },
      });

      logger.info(
        {
          trackingId: id,
          userId,
          pricePnl: pnlData?.pricePnl,
          fundingPnl: pnlData?.fundingPnl,
          totalPnl: pnlData?.totalPnl,
        },
        'Tracking stopped successfully'
      );

      return this.toTrackingWithUser(tracking);
    } catch (error) {
      if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('already stopped'))) {
        throw error;
      }
      logger.error({ error, trackingId: id, userId }, 'Failed to stop tracking');
      throw new DatabaseError('Failed to stop tracking', { trackingId: id });
    }
  }

  /**
   * 將追蹤標記為過期
   */
  async expire(id: string): Promise<TrackingWithUser> {
    try {
      const tracking = await this.prisma.simulatedTracking.update({
        where: { id },
        data: {
          status: 'EXPIRED',
          stoppedAt: new Date(),
        },
      });

      logger.info({ trackingId: id }, 'Tracking expired');

      return this.toTrackingWithUser(tracking);
    } catch (error) {
      logger.error({ error, trackingId: id }, 'Failed to expire tracking');
      throw new DatabaseError('Failed to expire tracking', { trackingId: id });
    }
  }

  /**
   * 更新累計統計
   */
  async updateStatistics(
    id: string,
    stats: {
      totalFundingProfit: number;
      totalSettlements: number;
      maxSpread: number;
      minSpread: number;
    }
  ): Promise<void> {
    try {
      await this.prisma.simulatedTracking.update({
        where: { id },
        data: {
          totalFundingProfit: stats.totalFundingProfit,
          totalSettlements: stats.totalSettlements,
          maxSpread: stats.maxSpread,
          minSpread: stats.minSpread,
        },
      });
    } catch (error) {
      logger.error({ error, trackingId: id }, 'Failed to update statistics');
      throw new DatabaseError('Failed to update statistics', { trackingId: id });
    }
  }

  /**
   * 刪除追蹤（僅限非活躍）
   */
  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.simulatedTracking.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Tracking not found');
      }

      if (existing.status === 'ACTIVE') {
        throw new Error('Cannot delete active tracking');
      }

      await this.prisma.simulatedTracking.delete({
        where: { id },
      });

      logger.info({ trackingId: id, userId }, 'Tracking deleted successfully');

      return true;
    } catch (error) {
      if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('Cannot delete'))) {
        throw error;
      }
      logger.error({ error, trackingId: id, userId }, 'Failed to delete tracking');
      throw new DatabaseError('Failed to delete tracking', { trackingId: id });
    }
  }

  /**
   * 清理過期資料（30 天前停止的追蹤）
   */
  async cleanupExpired(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.prisma.simulatedTracking.deleteMany({
        where: {
          status: { not: 'ACTIVE' },
          stoppedAt: { lt: cutoffDate },
        },
      });

      logger.info(
        { deletedCount: result.count, cutoffDate },
        'Expired trackings cleaned up'
      );

      return result.count;
    } catch (error) {
      logger.error({ error, daysOld }, 'Failed to cleanup expired trackings');
      throw new DatabaseError('Failed to cleanup expired trackings');
    }
  }
}
