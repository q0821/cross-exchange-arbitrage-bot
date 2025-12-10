import { PrismaClient, AssetSnapshot as PrismaAssetSnapshot } from '@prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError } from '@lib/errors';
import { subDays } from 'date-fns';

/**
 * AssetSnapshot 資料類型
 */
export interface AssetSnapshotData {
  id: string;
  userId: string;
  binanceBalanceUSD: number | null;
  okxBalanceUSD: number | null;
  mexcBalanceUSD: number | null;
  gateioBalanceUSD: number | null;
  totalBalanceUSD: number;
  binanceStatus: string | null;
  okxStatus: string | null;
  mexcStatus: string | null;
  gateioStatus: string | null;
  recordedAt: Date;
  createdAt: Date;
}

/**
 * 建立快照的輸入資料
 */
export interface CreateSnapshotInput {
  userId: string;
  binanceBalanceUSD?: number | null;
  okxBalanceUSD?: number | null;
  mexcBalanceUSD?: number | null;
  gateioBalanceUSD?: number | null;
  totalBalanceUSD: number;
  binanceStatus?: string | null;
  okxStatus?: string | null;
  mexcStatus?: string | null;
  gateioStatus?: string | null;
  recordedAt: Date;
}

/**
 * 歷史曲線資料點
 */
export interface HistoryDataPoint {
  timestamp: string;
  binance: number | null;
  okx: number | null;
  mexc: number | null;
  gate: number | null;
  total: number;
}

/**
 * AssetSnapshotRepository
 * 處理資產快照的持久化操作
 * Feature 031: Asset Tracking History
 */
export class AssetSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 將 Prisma 模型轉換為 AssetSnapshotData
   */
  private toSnapshotData(snapshot: PrismaAssetSnapshot): AssetSnapshotData {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      binanceBalanceUSD: snapshot.binanceBalanceUSD ? Number(snapshot.binanceBalanceUSD) : null,
      okxBalanceUSD: snapshot.okxBalanceUSD ? Number(snapshot.okxBalanceUSD) : null,
      mexcBalanceUSD: snapshot.mexcBalanceUSD ? Number(snapshot.mexcBalanceUSD) : null,
      gateioBalanceUSD: snapshot.gateioBalanceUSD ? Number(snapshot.gateioBalanceUSD) : null,
      totalBalanceUSD: Number(snapshot.totalBalanceUSD),
      binanceStatus: snapshot.binanceStatus,
      okxStatus: snapshot.okxStatus,
      mexcStatus: snapshot.mexcStatus,
      gateioStatus: snapshot.gateioStatus,
      recordedAt: snapshot.recordedAt,
      createdAt: snapshot.createdAt,
    };
  }

  /**
   * 建立新的資產快照
   */
  async create(input: CreateSnapshotInput): Promise<AssetSnapshotData> {
    try {
      const snapshot = await this.prisma.assetSnapshot.create({
        data: {
          userId: input.userId,
          binanceBalanceUSD: input.binanceBalanceUSD ?? null,
          okxBalanceUSD: input.okxBalanceUSD ?? null,
          mexcBalanceUSD: input.mexcBalanceUSD ?? null,
          gateioBalanceUSD: input.gateioBalanceUSD ?? null,
          totalBalanceUSD: input.totalBalanceUSD,
          binanceStatus: input.binanceStatus ?? null,
          okxStatus: input.okxStatus ?? null,
          mexcStatus: input.mexcStatus ?? null,
          gateioStatus: input.gateioStatus ?? null,
          recordedAt: input.recordedAt,
        },
      });

      logger.debug({ snapshotId: snapshot.id, userId: input.userId }, 'Asset snapshot created');
      return this.toSnapshotData(snapshot);
    } catch (error) {
      logger.error({ error, userId: input.userId }, 'Failed to create asset snapshot');
      throw new DatabaseError('Failed to create asset snapshot');
    }
  }

  /**
   * 查詢用戶最新的快照
   */
  async findLatestByUserId(userId: string): Promise<AssetSnapshotData | null> {
    try {
      const snapshot = await this.prisma.assetSnapshot.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
      });

      return snapshot ? this.toSnapshotData(snapshot) : null;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find latest asset snapshot');
      throw new DatabaseError('Failed to find latest asset snapshot');
    }
  }

  /**
   * 查詢用戶指定天數內的歷史快照
   */
  async findByUserIdAndDays(userId: string, days: number): Promise<AssetSnapshotData[]> {
    try {
      const fromDate = subDays(new Date(), days);

      const snapshots = await this.prisma.assetSnapshot.findMany({
        where: {
          userId,
          recordedAt: {
            gte: fromDate,
          },
        },
        orderBy: { recordedAt: 'asc' },
      });

      return snapshots.map(this.toSnapshotData.bind(this));
    } catch (error) {
      logger.error({ error, userId, days }, 'Failed to find asset snapshots by days');
      throw new DatabaseError('Failed to find asset snapshots');
    }
  }

  /**
   * 將快照資料轉換為曲線圖資料點
   */
  toHistoryDataPoints(snapshots: AssetSnapshotData[]): HistoryDataPoint[] {
    return snapshots.map((s) => ({
      timestamp: s.recordedAt.toISOString(),
      binance: s.binanceBalanceUSD,
      okx: s.okxBalanceUSD,
      mexc: s.mexcBalanceUSD,
      gate: s.gateioBalanceUSD,
      total: s.totalBalanceUSD,
    }));
  }

  /**
   * 清理過期資料（超過指定天數）
   */
  async cleanupOldSnapshots(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = subDays(new Date(), retentionDays);

      const result = await this.prisma.assetSnapshot.deleteMany({
        where: {
          recordedAt: {
            lt: cutoffDate,
          },
        },
      });

      if (result.count > 0) {
        logger.info(
          { deletedCount: result.count, cutoffDate: cutoffDate.toISOString() },
          'Old asset snapshots cleaned up'
        );
      }

      return result.count;
    } catch (error) {
      logger.error({ error, retentionDays }, 'Failed to cleanup old asset snapshots');
      throw new DatabaseError('Failed to cleanup old asset snapshots');
    }
  }

  /**
   * 查詢有有效 API Key 的用戶列表
   */
  async findUsersWithApiKeys(): Promise<{ id: string; exchanges: string[] }[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          apiKeys: {
            some: {
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          apiKeys: {
            where: { isActive: true },
            select: {
              exchange: true,
            },
          },
        },
      });

      return users.map((user) => ({
        id: user.id,
        exchanges: user.apiKeys.map((key) => key.exchange),
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to find users with API keys');
      throw new DatabaseError('Failed to find users with API keys');
    }
  }

  /**
   * 計算用戶快照數量（用於診斷）
   */
  async countByUserId(userId: string): Promise<number> {
    try {
      return await this.prisma.assetSnapshot.count({
        where: { userId },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count asset snapshots');
      throw new DatabaseError('Failed to count asset snapshots');
    }
  }
}
