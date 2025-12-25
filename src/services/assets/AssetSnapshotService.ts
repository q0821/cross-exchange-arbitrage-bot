import { PrismaClient } from '@prisma/client';
import { logger } from '@lib/logger';
import {
  AssetSnapshotRepository,
  AssetSnapshotData,
  CreateSnapshotInput,
  HistoryDataPoint,
} from '../../repositories/AssetSnapshotRepository';
import { UserConnectorFactory, ExchangeBalanceResult } from './UserConnectorFactory';
import type { ExchangeName } from '../../connectors/types';

/**
 * 用戶餘額查詢結果
 */
export interface UserBalanceResult {
  exchanges: ExchangeBalanceResult[];
  totalBalanceUSD: number;
  lastUpdated: Date;
}

/**
 * 歷史曲線回應資料
 */
export interface AssetHistoryResult {
  snapshots: HistoryDataPoint[];
  period: {
    days: number;
    from: Date;
    to: Date;
  };
  summary: {
    startTotal: number | null;
    endTotal: number | null;
    changeUSD: number | null;
    changePercent: number | null;
  };
}

/**
 * AssetSnapshotService
 * 處理資產快照的業務邏輯
 * Feature 031: Asset Tracking History
 */
export class AssetSnapshotService {
  private readonly repository: AssetSnapshotRepository;
  private readonly connectorFactory: UserConnectorFactory;

  constructor(prisma: PrismaClient) {
    this.repository = new AssetSnapshotRepository(prisma);
    this.connectorFactory = new UserConnectorFactory(prisma);
  }

  /**
   * 查詢用戶即時餘額（從交易所 API）
   */
  async getRealtimeBalances(userId: string): Promise<UserBalanceResult> {
    logger.debug({ userId }, 'Fetching realtime balances');

    const balanceResults = await this.connectorFactory.getBalancesForUser(userId);

    // 計算總資產（只加總成功查詢的）
    const totalBalanceUSD = balanceResults
      .filter((r) => r.status === 'success' && r.balanceUSD !== null)
      .reduce((sum, r) => sum + (r.balanceUSD || 0), 0);

    return {
      exchanges: balanceResults,
      totalBalanceUSD,
      lastUpdated: new Date(),
    };
  }

  /**
   * 查詢用戶最新快照餘額（從資料庫）
   */
  async getLatestSnapshot(userId: string): Promise<AssetSnapshotData | null> {
    return this.repository.findLatestByUserId(userId);
  }

  /**
   * 為用戶建立資產快照
   */
  async createSnapshotForUser(userId: string): Promise<AssetSnapshotData> {
    logger.debug({ userId }, 'Creating asset snapshot');

    const balanceResults = await this.connectorFactory.getBalancesForUser(userId);

    // 將結果轉換為快照輸入
    const input: CreateSnapshotInput = {
      userId,
      recordedAt: new Date(),
      totalBalanceUSD: 0,
    };

    let totalUSD = 0;

    for (const result of balanceResults) {
      const exchange = result.exchange.toLowerCase() as ExchangeName;

      switch (exchange) {
        case 'binance':
          input.binanceBalanceUSD = result.balanceUSD;
          input.binanceStatus = result.status;
          break;
        case 'okx':
          input.okxBalanceUSD = result.balanceUSD;
          input.okxStatus = result.status;
          break;
        case 'mexc':
          input.mexcBalanceUSD = result.balanceUSD;
          input.mexcStatus = result.status;
          break;
        case 'gateio':
          input.gateioBalanceUSD = result.balanceUSD;
          input.gateioStatus = result.status;
          break;
        case 'bingx':
          input.bingxBalanceUSD = result.balanceUSD;
          input.bingxStatus = result.status;
          break;
      }

      if (result.status === 'success' && result.balanceUSD !== null) {
        totalUSD += result.balanceUSD;
      }
    }

    input.totalBalanceUSD = totalUSD;

    const snapshot = await this.repository.create(input);

    logger.info(
      {
        userId,
        snapshotId: snapshot.id,
        totalBalanceUSD: totalUSD,
        exchanges: balanceResults.map((r) => ({
          exchange: r.exchange,
          status: r.status,
        })),
      },
      'Asset snapshot created'
    );

    return snapshot;
  }

  /**
   * 查詢用戶歷史曲線資料
   */
  async getHistory(userId: string, days: number = 7): Promise<AssetHistoryResult> {
    // 限制天數範圍
    const validDays = [7, 14, 30].includes(days) ? days : 7;

    const snapshots = await this.repository.findByUserIdAndDays(userId, validDays);
    const dataPoints = this.repository.toHistoryDataPoints(snapshots);

    // 計算期間統計
    const from = new Date();
    from.setDate(from.getDate() - validDays);

    let summary: AssetHistoryResult['summary'] = {
      startTotal: null,
      endTotal: null,
      changeUSD: null,
      changePercent: null,
    };

    if (dataPoints.length > 0) {
      const firstPoint = dataPoints[0];
      const lastPoint = dataPoints[dataPoints.length - 1];
      const startTotal = firstPoint ? firstPoint.total : 0;
      const endTotal = lastPoint ? lastPoint.total : 0;
      const changeUSD = endTotal - startTotal;
      const changePercent = startTotal > 0 ? (changeUSD / startTotal) * 100 : 0;

      summary = {
        startTotal,
        endTotal,
        changeUSD,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    }

    return {
      snapshots: dataPoints,
      period: {
        days: validDays,
        from,
        to: new Date(),
      },
      summary,
    };
  }

  /**
   * 清理過期快照
   */
  async cleanupOldSnapshots(retentionDays: number = 30): Promise<number> {
    return this.repository.cleanupOldSnapshots(retentionDays);
  }

  /**
   * 查詢需要建立快照的用戶列表
   */
  async getUsersForSnapshot(): Promise<{ id: string; exchanges: string[] }[]> {
    return this.repository.findUsersWithApiKeys();
  }

  /**
   * 將快照資料轉換為 API 回應格式
   */
  snapshotToBalanceResult(snapshot: AssetSnapshotData): UserBalanceResult {
    const exchanges: ExchangeBalanceResult[] = [
      {
        exchange: 'binance',
        status: (snapshot.binanceStatus as ExchangeBalanceResult['status']) || 'no_api_key',
        balanceUSD: snapshot.binanceBalanceUSD,
      },
      {
        exchange: 'okx',
        status: (snapshot.okxStatus as ExchangeBalanceResult['status']) || 'no_api_key',
        balanceUSD: snapshot.okxBalanceUSD,
      },
      {
        exchange: 'mexc',
        status: (snapshot.mexcStatus as ExchangeBalanceResult['status']) || 'no_api_key',
        balanceUSD: snapshot.mexcBalanceUSD,
      },
      {
        exchange: 'gateio',
        status: (snapshot.gateioStatus as ExchangeBalanceResult['status']) || 'no_api_key',
        balanceUSD: snapshot.gateioBalanceUSD,
      },
      {
        exchange: 'bingx',
        status: (snapshot.bingxStatus as ExchangeBalanceResult['status']) || 'no_api_key',
        balanceUSD: snapshot.bingxBalanceUSD,
      },
    ];

    return {
      exchanges,
      totalBalanceUSD: snapshot.totalBalanceUSD,
      lastUpdated: snapshot.recordedAt,
    };
  }
}
