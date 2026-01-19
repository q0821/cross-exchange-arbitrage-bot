/**
 * ArbitrageOpportunity Repository
 *
 * 套利機會資料存取層
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 2 - Foundational
 * Task: T006 - Repository 實作
 */

import { prisma } from '@/lib/db';
import type {
  ArbitrageOpportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  UpsertOpportunityInput,
  PublicOpportunitiesOptions,
} from '@/models/ArbitrageOpportunity';
import type { PublicOpportunityDTO } from '@/types/public-opportunity';

/**
 * 套利機會 Repository
 */
export class ArbitrageOpportunityRepository {
  /**
   * 將 ArbitrageOpportunity 轉換為公開 DTO（去識別化）
   *
   * @param opp - ArbitrageOpportunity 記錄
   * @returns PublicOpportunityDTO
   */
  private toPublicDTO(opp: ArbitrageOpportunity): PublicOpportunityDTO {
    const isActive = opp.status === 'ACTIVE';

    return {
      id: opp.id,
      symbol: opp.symbol,
      longExchange: opp.longExchange,
      shortExchange: opp.shortExchange,
      status: opp.status as 'ACTIVE' | 'ENDED',
      maxSpread: Number(opp.maxSpread),
      currentSpread: Number(opp.currentSpread),
      currentAPY: Number(opp.currentAPY),
      durationMs: isActive ? null : (opp.durationMs ? Number(opp.durationMs) : null),
      appearedAt: opp.detectedAt,
      disappearedAt: isActive ? null : opp.endedAt,
    };
  }
  /**
   * 建立新的套利機會記錄
   *
   * @param data - 建立輸入資料
   * @returns 建立的套利機會記錄
   */
  async create(data: CreateOpportunityInput): Promise<ArbitrageOpportunity> {
    const now = new Date();

    return prisma.arbitrageOpportunity.create({
      data: {
        symbol: data.symbol,
        longExchange: data.longExchange,
        shortExchange: data.shortExchange,
        status: 'ACTIVE',
        initialSpread: data.initialSpread,
        maxSpread: data.initialSpread,
        maxSpreadAt: now,
        currentSpread: data.currentSpread,
        initialAPY: data.initialAPY,
        maxAPY: data.initialAPY,
        currentAPY: data.currentAPY,
        longIntervalHours: data.longIntervalHours,
        shortIntervalHours: data.shortIntervalHours,
      },
    });
  }

  /**
   * 根據 symbol + exchanges 查找 ACTIVE 狀態的記錄
   *
   * @param symbol - 交易對符號
   * @param longExchange - 做多交易所
   * @param shortExchange - 做空交易所
   * @returns 找到的記錄或 null
   */
  async findActiveByKey(
    symbol: string,
    longExchange: string,
    shortExchange: string
  ): Promise<ArbitrageOpportunity | null> {
    return prisma.arbitrageOpportunity.findFirst({
      where: {
        symbol,
        longExchange,
        shortExchange,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 更新進行中的機會
   *
   * @param id - 記錄 ID
   * @param data - 更新資料
   * @returns 更新後的記錄
   */
  async update(
    id: string,
    data: UpdateOpportunityInput
  ): Promise<ArbitrageOpportunity> {
    return prisma.arbitrageOpportunity.update({
      where: { id },
      data,
    });
  }

  /**
   * 將機會標記為已結束
   *
   * @param symbol - 交易對符號
   * @param longExchange - 做多交易所
   * @param shortExchange - 做空交易所
   * @param finalSpread - 最終費差
   * @param finalAPY - 最終年化報酬
   * @returns 更新後的記錄或 null（若找不到）
   */
  async markAsEnded(
    symbol: string,
    longExchange: string,
    shortExchange: string,
    finalSpread: number,
    finalAPY: number
  ): Promise<ArbitrageOpportunity | null> {
    // 查找 ACTIVE 狀態的記錄
    const existing = await this.findActiveByKey(symbol, longExchange, shortExchange);

    if (!existing) {
      return null;
    }

    const now = new Date();
    const durationMs = BigInt(now.getTime() - existing.detectedAt.getTime());

    return prisma.arbitrageOpportunity.update({
      where: { id: existing.id },
      data: {
        status: 'ENDED',
        endedAt: now,
        durationMs,
        currentSpread: finalSpread,
        currentAPY: finalAPY,
      },
    });
  }

  /**
   * 建立或更新機會（原子操作）
   *
   * @param data - Upsert 輸入資料
   * @returns 建立或更新後的記錄
   */
  async upsert(data: UpsertOpportunityInput): Promise<ArbitrageOpportunity> {
    // 查找是否已存在 ACTIVE 記錄
    const existing = await this.findActiveByKey(
      data.symbol,
      data.longExchange,
      data.shortExchange
    );

    if (existing) {
      // 更新現有記錄
      const updateData: UpdateOpportunityInput = {
        currentSpread: data.spread,
        currentAPY: data.apy,
      };

      // 更新 maxSpread 和 maxAPY（如果當前值更大）
      if (data.spread > Number(existing.maxSpread)) {
        updateData.maxSpread = data.spread;
        updateData.maxSpreadAt = new Date();
      }
      if (data.apy > Number(existing.maxAPY)) {
        updateData.maxAPY = data.apy;
      }

      return this.update(existing.id, updateData);
    } else {
      // 建立新記錄
      const createData: CreateOpportunityInput = {
        symbol: data.symbol,
        longExchange: data.longExchange,
        shortExchange: data.shortExchange,
        initialSpread: data.spread,
        currentSpread: data.spread,
        initialAPY: data.apy,
        currentAPY: data.apy,
        longIntervalHours: data.longIntervalHours,
        shortIntervalHours: data.shortIntervalHours,
      };

      return this.create(createData);
    }
  }

  /**
   * 查詢公開機會列表（用於 API）
   *
   * @param options - 查詢選項
   * @returns 機會列表（PublicOpportunityDTO）和總數
   */
  async getPublicOpportunities(
    options: PublicOpportunitiesOptions
  ): Promise<{
    data: PublicOpportunityDTO[];
    total: number;
  }> {
    const {
      days = 7,
      page = 1,
      limit = 20,
      status = 'ENDED',
    } = options;

    // 計算時間範圍
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 建構 where 條件
    const where: any = {};

    // 狀態篩選
    if (status !== 'all') {
      where.status = status;
    }

    // 時間範圍篩選
    if (status === 'ENDED') {
      where.endedAt = {
        gte: startDate,
      };
    } else {
      where.detectedAt = {
        gte: startDate,
      };
    }

    // 執行查詢
    const [opportunities, total] = await Promise.all([
      prisma.arbitrageOpportunity.findMany({
        where,
        orderBy: status === 'ENDED'
          ? { endedAt: 'desc' }
          : { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.arbitrageOpportunity.count({ where }),
    ]);

    return {
      data: opportunities.map((opp) => this.toPublicDTO(opp)),
      total,
    };
  }

  /**
   * 查找指定 symbol 的所有 ACTIVE 記錄
   *
   * @param symbol - 交易對符號
   * @returns ACTIVE 狀態的記錄列表
   */
  async findAllActiveBySymbol(symbol: string): Promise<ArbitrageOpportunity[]> {
    return prisma.arbitrageOpportunity.findMany({
      where: {
        symbol,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 取得統計資料
   *
   * @returns 統計數據
   */
  async getStats(): Promise<{
    activeCount: number;
    endedCount: number;
    avgDurationMs: number;
  }> {
    const [activeCount, endedCount, endedRecords] = await Promise.all([
      prisma.arbitrageOpportunity.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.arbitrageOpportunity.count({
        where: { status: 'ENDED' },
      }),
      prisma.arbitrageOpportunity.findMany({
        where: {
          status: 'ENDED',
          durationMs: { not: null },
        },
        select: { durationMs: true },
      }),
    ]);

    // 計算平均持續時間
    let avgDurationMs = 0;
    if (endedRecords.length > 0) {
      const totalDuration = endedRecords.reduce(
        (sum, record) => sum + Number(record.durationMs),
        0
      );
      avgDurationMs = totalDuration / endedRecords.length;
    }

    return { activeCount, endedCount, avgDurationMs };
  }
}
