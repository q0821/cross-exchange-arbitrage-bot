import { PrismaClient, OpportunityEndHistory as PrismaHistory } from '@prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError } from '@lib/errors';
import type { CreateOpportunityHistoryInput } from '../models/OpportunityEndHistory';

/**
 * 歷史記錄 DTO
 */
export interface OpportunityEndHistoryDTO {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  detectedAt: Date;
  disappearedAt: Date;
  durationMs: bigint;
  durationFormatted: string;
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  finalSpread: number;
  longIntervalHours: number;
  shortIntervalHours: number;
  settlementRecords: Array<{
    side: 'long' | 'short';
    timestamp: string;
    rate: number;
  }>;
  longSettlementCount: number;
  shortSettlementCount: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;
  notificationCount: number;
  createdAt: Date;
}

/**
 * OpportunityEndHistoryRepository
 * 處理套利機會歷史記錄的持久化操作
 * Feature 027: 套利機會結束監測和通知
 */
export class OpportunityEndHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 格式化持續時間
   */
  private formatDuration(durationMs: bigint): string {
    const totalMinutes = Number(durationMs) / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    if (hours === 0) {
      return `${minutes} 分鐘`;
    } else if (minutes === 0) {
      return `${hours} 小時`;
    } else {
      return `${hours} 小時 ${minutes} 分鐘`;
    }
  }

  /**
   * 將 Prisma 模型轉換為 DTO
   */
  private toDTO(history: PrismaHistory): OpportunityEndHistoryDTO {
    return {
      id: history.id,
      symbol: history.symbol,
      longExchange: history.longExchange,
      shortExchange: history.shortExchange,
      detectedAt: history.detectedAt,
      disappearedAt: history.disappearedAt,
      durationMs: history.durationMs,
      durationFormatted: this.formatDuration(history.durationMs),
      initialSpread: Number(history.initialSpread),
      maxSpread: Number(history.maxSpread),
      maxSpreadAt: history.maxSpreadAt,
      finalSpread: Number(history.finalSpread),
      longIntervalHours: history.longIntervalHours,
      shortIntervalHours: history.shortIntervalHours,
      settlementRecords: history.settlementRecords as Array<{
        side: 'long' | 'short';
        timestamp: string;
        rate: number;
      }>,
      longSettlementCount: history.longSettlementCount,
      shortSettlementCount: history.shortSettlementCount,
      totalFundingProfit: Number(history.totalFundingProfit),
      totalCost: Number(history.totalCost),
      netProfit: Number(history.netProfit),
      realizedAPY: Number(history.realizedAPY),
      notificationCount: history.notificationCount,
      createdAt: history.createdAt,
    };
  }

  /**
   * 建立歷史記錄
   */
  async create(data: CreateOpportunityHistoryInput): Promise<OpportunityEndHistoryDTO> {
    try {
      const history = await this.prisma.opportunityEndHistory.create({
        data: {
          symbol: data.symbol,
          longExchange: data.longExchange,
          shortExchange: data.shortExchange,
          detectedAt: data.detectedAt,
          disappearedAt: data.disappearedAt,
          durationMs: data.durationMs,
          initialSpread: data.initialSpread,
          maxSpread: data.maxSpread,
          maxSpreadAt: data.maxSpreadAt,
          finalSpread: data.finalSpread,
          longIntervalHours: data.longIntervalHours,
          shortIntervalHours: data.shortIntervalHours,
          settlementRecords: data.settlementRecords,
          longSettlementCount: data.longSettlementCount,
          shortSettlementCount: data.shortSettlementCount,
          totalFundingProfit: data.totalFundingProfit,
          totalCost: data.totalCost,
          netProfit: data.netProfit,
          realizedAPY: data.realizedAPY,
          notificationCount: data.notificationCount,
          userId: data.userId,
        },
      });

      logger.info(
        {
          historyId: history.id,
          symbol: data.symbol,
          userId: data.userId,
        },
        'Opportunity history created successfully'
      );

      return this.toDTO(history);
    } catch (error) {
      logger.error({ error, symbol: data.symbol }, 'Failed to create opportunity history');
      throw new DatabaseError('Failed to create opportunity history', { symbol: data.symbol });
    }
  }

  /**
   * 根據用戶 ID 查詢歷史記錄（分頁）
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      symbol?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ histories: OpportunityEndHistoryDTO[]; total: number }> {
    const { limit = 20, offset = 0, symbol, startDate, endDate } = options;

    try {
      const where: Record<string, unknown> = { userId };

      if (symbol) {
        where.symbol = symbol;
      }

      if (startDate || endDate) {
        where.disappearedAt = {};
        if (startDate) {
          (where.disappearedAt as Record<string, unknown>).gte = startDate;
        }
        if (endDate) {
          (where.disappearedAt as Record<string, unknown>).lte = endDate;
        }
      }

      const [histories, total] = await Promise.all([
        this.prisma.opportunityEndHistory.findMany({
          where,
          orderBy: { disappearedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.opportunityEndHistory.count({ where }),
      ]);

      return {
        histories: histories.map((h) => this.toDTO(h)),
        total,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find opportunity histories');
      throw new DatabaseError('Failed to find opportunity histories', { userId });
    }
  }

  /**
   * 根據 ID 查詢單一記錄
   */
  async findById(id: string): Promise<OpportunityEndHistoryDTO | null> {
    try {
      const history = await this.prisma.opportunityEndHistory.findUnique({
        where: { id },
      });

      if (!history) {
        return null;
      }

      return this.toDTO(history);
    } catch (error) {
      logger.error({ error, historyId: id }, 'Failed to find opportunity history');
      throw new DatabaseError('Failed to find opportunity history', { historyId: id });
    }
  }
}
