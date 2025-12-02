import {
  PrismaClient,
  TrackingSnapshot as PrismaSnapshot,
  SnapshotType as PrismaSnapshotType,
} from '@prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError } from '@lib/errors';
import type {
  CreateSnapshotInput,
  SnapshotResponse,
  SnapshotQueryInput,
  PaginationInfo,
  SnapshotType,
  SettlementSide,
} from '../models/SimulatedTracking';

/**
 * TrackingSnapshotRepository
 * 處理追蹤快照的持久化操作
 * Feature 029: Simulated APY Tracking
 */
export class TrackingSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 將 Prisma 模型轉換為 SnapshotResponse
   */
  private toSnapshotResponse(snapshot: PrismaSnapshot): SnapshotResponse {
    return {
      id: snapshot.id,
      snapshotType: snapshot.snapshotType as SnapshotType,
      longRate: Number(snapshot.longRate),
      shortRate: Number(snapshot.shortRate),
      spread: Number(snapshot.spread),
      annualizedReturn: Number(snapshot.annualizedReturn),
      longPrice: snapshot.longPrice ? Number(snapshot.longPrice) : null,
      shortPrice: snapshot.shortPrice ? Number(snapshot.shortPrice) : null,
      priceDiffPercent: snapshot.priceDiffPercent
        ? Number(snapshot.priceDiffPercent)
        : null,
      settlementSide: snapshot.settlementSide as SettlementSide | null,
      fundingProfit: snapshot.fundingProfit
        ? Number(snapshot.fundingProfit)
        : null,
      cumulativeProfit: Number(snapshot.cumulativeProfit),
      recordedAt: snapshot.recordedAt.toISOString(),
    };
  }

  /**
   * 建立快照
   */
  async create(data: CreateSnapshotInput): Promise<SnapshotResponse> {
    try {
      const snapshot = await this.prisma.trackingSnapshot.create({
        data: {
          trackingId: data.trackingId,
          snapshotType: data.snapshotType,
          longRate: data.longRate,
          shortRate: data.shortRate,
          spread: data.spread,
          annualizedReturn: data.annualizedReturn,
          longPrice: data.longPrice,
          shortPrice: data.shortPrice,
          priceDiffPercent: data.priceDiffPercent,
          settlementSide: data.settlementSide,
          fundingProfit: data.fundingProfit,
          cumulativeProfit: data.cumulativeProfit,
        },
      });

      logger.debug(
        { snapshotId: snapshot.id, trackingId: data.trackingId },
        'Snapshot created'
      );

      return this.toSnapshotResponse(snapshot);
    } catch (error) {
      logger.error(
        { error, trackingId: data.trackingId },
        'Failed to create snapshot'
      );
      throw new DatabaseError('Failed to create snapshot', {
        trackingId: data.trackingId,
      });
    }
  }

  /**
   * 批量建立快照
   */
  async createMany(snapshots: CreateSnapshotInput[]): Promise<number> {
    try {
      const result = await this.prisma.trackingSnapshot.createMany({
        data: snapshots.map((s) => ({
          trackingId: s.trackingId,
          snapshotType: s.snapshotType,
          longRate: s.longRate,
          shortRate: s.shortRate,
          spread: s.spread,
          annualizedReturn: s.annualizedReturn,
          longPrice: s.longPrice,
          shortPrice: s.shortPrice,
          priceDiffPercent: s.priceDiffPercent,
          settlementSide: s.settlementSide,
          fundingProfit: s.fundingProfit,
          cumulativeProfit: s.cumulativeProfit,
        })),
      });

      logger.info({ count: result.count }, 'Batch snapshots created');

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to create batch snapshots');
      throw new DatabaseError('Failed to create batch snapshots');
    }
  }

  /**
   * 根據追蹤 ID 查詢快照列表
   */
  async findByTrackingId(
    trackingId: string,
    options: SnapshotQueryInput
  ): Promise<{ snapshots: SnapshotResponse[]; pagination: PaginationInfo }> {
    try {
      const where: { trackingId: string; snapshotType?: PrismaSnapshotType } = {
        trackingId,
      };

      if (options.type !== 'all') {
        where.snapshotType = options.type as PrismaSnapshotType;
      }

      const [snapshots, total] = await Promise.all([
        this.prisma.trackingSnapshot.findMany({
          where,
          orderBy: { recordedAt: 'desc' },
          take: options.limit,
          skip: options.offset,
        }),
        this.prisma.trackingSnapshot.count({ where }),
      ]);

      return {
        snapshots: snapshots.map((s) => this.toSnapshotResponse(s)),
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + snapshots.length < total,
        },
      };
    } catch (error) {
      logger.error(
        { error, trackingId },
        'Failed to find snapshots by tracking ID'
      );
      throw new DatabaseError('Failed to find snapshots', { trackingId });
    }
  }

  /**
   * 取得追蹤的最新快照
   */
  async findLatestByTrackingId(
    trackingId: string
  ): Promise<SnapshotResponse | null> {
    try {
      const snapshot = await this.prisma.trackingSnapshot.findFirst({
        where: { trackingId },
        orderBy: { recordedAt: 'desc' },
      });

      if (!snapshot) {
        return null;
      }

      return this.toSnapshotResponse(snapshot);
    } catch (error) {
      logger.error(
        { error, trackingId },
        'Failed to find latest snapshot'
      );
      throw new DatabaseError('Failed to find latest snapshot', { trackingId });
    }
  }

  /**
   * 計算追蹤的結算次數
   */
  async countSettlementsByTrackingId(trackingId: string): Promise<number> {
    try {
      return await this.prisma.trackingSnapshot.count({
        where: {
          trackingId,
          snapshotType: 'SETTLEMENT',
        },
      });
    } catch (error) {
      logger.error(
        { error, trackingId },
        'Failed to count settlements'
      );
      throw new DatabaseError('Failed to count settlements', { trackingId });
    }
  }

  /**
   * 刪除追蹤的所有快照
   */
  async deleteByTrackingId(trackingId: string): Promise<number> {
    try {
      const result = await this.prisma.trackingSnapshot.deleteMany({
        where: { trackingId },
      });

      logger.info(
        { trackingId, deletedCount: result.count },
        'Snapshots deleted for tracking'
      );

      return result.count;
    } catch (error) {
      logger.error(
        { error, trackingId },
        'Failed to delete snapshots'
      );
      throw new DatabaseError('Failed to delete snapshots', { trackingId });
    }
  }

  /**
   * 清理過期快照（關聯追蹤已刪除的快照）
   * 注意：通常由 Prisma cascade 處理，此方法作為備援
   * 由於 Prisma 會自動處理 cascade 刪除，此方法主要用於手動清理
   */
  async cleanupOrphanedSnapshots(): Promise<number> {
    // 由於 TrackingSnapshot.trackingId 有 onDelete: Cascade，
    // 當 SimulatedTracking 被刪除時，相關 snapshots 會自動刪除
    // 此方法保留供未來可能需要的手動清理場景
    logger.debug('cleanupOrphanedSnapshots called - cascade deletion should handle this automatically');
    return 0;
  }

  /**
   * 取得追蹤的統計摘要
   */
  async getStatsSummary(trackingId: string): Promise<{
    totalSnapshots: number;
    settlementCount: number;
    totalFundingProfit: number;
    latestCumulativeProfit: number;
  }> {
    try {
      const [totalSnapshots, settlementCount, latestSnapshot, profitAgg] =
        await Promise.all([
          this.prisma.trackingSnapshot.count({ where: { trackingId } }),
          this.prisma.trackingSnapshot.count({
            where: { trackingId, snapshotType: 'SETTLEMENT' },
          }),
          this.prisma.trackingSnapshot.findFirst({
            where: { trackingId },
            orderBy: { recordedAt: 'desc' },
            select: { cumulativeProfit: true },
          }),
          this.prisma.trackingSnapshot.aggregate({
            where: { trackingId, snapshotType: 'SETTLEMENT' },
            _sum: { fundingProfit: true },
          }),
        ]);

      return {
        totalSnapshots,
        settlementCount,
        totalFundingProfit: profitAgg._sum.fundingProfit
          ? Number(profitAgg._sum.fundingProfit)
          : 0,
        latestCumulativeProfit: latestSnapshot
          ? Number(latestSnapshot.cumulativeProfit)
          : 0,
      };
    } catch (error) {
      logger.error({ error, trackingId }, 'Failed to get stats summary');
      throw new DatabaseError('Failed to get stats summary', { trackingId });
    }
  }
}
