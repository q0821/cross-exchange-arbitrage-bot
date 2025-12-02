/**
 * SimulatedTrackingService - 模擬套利追蹤服務
 *
 * 負責：
 * 1. 管理模擬追蹤的生命週期（開始、停止、過期）
 * 2. 記錄結算快照並計算模擬收益
 * 3. 自動過期功能（當 APY 低於閾值）
 * 4. 與 RatesCache 整合以獲取實時費率數據
 *
 * Feature 029: Simulated APY Tracking
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import { SimulatedTrackingRepository } from '../../repositories/SimulatedTrackingRepository';
import { TrackingSnapshotRepository } from '../../repositories/TrackingSnapshotRepository';
import type {
  CreateTrackingInput,
  TrackingResponse,
  TrackingWithUser,
  TrackingQueryInput,
  PaginationInfo,
  SnapshotQueryInput,
  SnapshotResponse,
} from '../../models/SimulatedTracking';
import { MAX_ACTIVE_TRACKINGS } from '../../models/SimulatedTracking';
import type { FundingRatePair } from '../../models/FundingRate';

/**
 * 結算時間檢查結果
 */
interface SettlementCheck {
  isSettlement: boolean;
  side: 'LONG' | 'SHORT' | 'BOTH' | null;
}

/**
 * SimulatedTrackingService 類別
 */
export class SimulatedTrackingService {
  private static instance: SimulatedTrackingService | null = null;

  private readonly trackingRepository: SimulatedTrackingRepository;
  private readonly snapshotRepository: TrackingSnapshotRepository;

  // 結算時間容錯範圍（±2 分鐘）
  private readonly settlementWindowMinutes = 2;

  // 自動過期閾值（年化收益 < 800%）
  private readonly autoExpireThreshold = 800;

  private constructor(prisma: PrismaClient) {
    this.trackingRepository = new SimulatedTrackingRepository(prisma);
    this.snapshotRepository = new TrackingSnapshotRepository(prisma);

    logger.info('SimulatedTrackingService initialized');
  }

  /**
   * 獲取單例實例
   */
  static getInstance(prisma: PrismaClient): SimulatedTrackingService {
    if (!SimulatedTrackingService.instance) {
      SimulatedTrackingService.instance = new SimulatedTrackingService(prisma);
    }
    return SimulatedTrackingService.instance;
  }

  /**
   * 重置單例（用於測試）
   */
  static resetInstance(): void {
    SimulatedTrackingService.instance = null;
  }

  // =====================
  // US1: Start Tracking
  // =====================

  /**
   * T010: 開始追蹤套利機會
   */
  async startTracking(
    userId: string,
    input: CreateTrackingInput,
    currentRates: FundingRatePair
  ): Promise<TrackingResponse> {
    logger.info(
      { userId, symbol: input.symbol, longExchange: input.longExchange },
      'Starting tracking'
    );

    // 從當前費率數據中提取初始值
    const longRate = this.findExchangeRate(currentRates, input.longExchange);
    const shortRate = this.findExchangeRate(currentRates, input.shortExchange);

    if (longRate === null || shortRate === null) {
      throw new Error('Unable to find rate data for selected exchanges');
    }

    const spread = shortRate.rate - longRate.rate;
    const spreadPercent = spread * 100;

    // 計算年化收益（考慮結算間隔）
    const longIntervalHours = longRate.intervalHours || 8;
    const shortIntervalHours = shortRate.intervalHours || 8;
    const avgIntervalHours = (longIntervalHours + shortIntervalHours) / 2;
    const annualizedReturn = spreadPercent * (8760 / avgIntervalHours);

    // 提取開倉價格（固定顆數模式）
    const longPrice = longRate.markPrice;
    const shortPrice = shortRate.markPrice;

    // 計算固定倉位數量（使用平均價格）
    let positionQuantity: number | undefined;
    if (longPrice && shortPrice) {
      const avgPrice = (longPrice + shortPrice) / 2;
      positionQuantity = input.simulatedCapital / avgPrice;

      logger.info(
        {
          symbol: input.symbol,
          longPrice,
          shortPrice,
          avgPrice,
          simulatedCapital: input.simulatedCapital,
          positionQuantity,
        },
        'Calculated fixed position quantity'
      );
    }

    const tracking = await this.trackingRepository.create(userId, {
      ...input,
      initialSpread: spreadPercent,
      initialAPY: annualizedReturn,
      initialLongRate: longRate.rate,
      initialShortRate: shortRate.rate,
      longIntervalHours,
      shortIntervalHours,
      // 開倉價格和固定顆數
      initialLongPrice: longPrice,
      initialShortPrice: shortPrice,
      positionQuantity,
    });

    return this.trackingRepository.toResponse(tracking);
  }

  /**
   * T011: 計算用戶活躍追蹤數量
   */
  async countActiveTrackings(userId: string): Promise<number> {
    return this.trackingRepository.countActiveByUserId(userId);
  }

  /**
   * 檢查用戶是否可以新增追蹤
   */
  async canStartTracking(userId: string): Promise<{
    canStart: boolean;
    activeCount: number;
    maxAllowed: number;
  }> {
    const activeCount = await this.countActiveTrackings(userId);
    return {
      canStart: activeCount < MAX_ACTIVE_TRACKINGS,
      activeCount,
      maxAllowed: MAX_ACTIVE_TRACKINGS,
    };
  }

  // =====================
  // US2: View Trackings
  // =====================

  /**
   * T017: 根據用戶 ID 查詢追蹤列表
   */
  async getTrackingsByUserId(
    userId: string,
    options: TrackingQueryInput
  ): Promise<{ trackings: TrackingResponse[]; pagination: PaginationInfo }> {
    const result = await this.trackingRepository.findByUserId(userId, options);

    return {
      trackings: result.trackings.map((t) =>
        this.trackingRepository.toResponse(t)
      ),
      pagination: result.pagination,
    };
  }

  /**
   * T018: 根據 ID 查詢追蹤詳情
   */
  async getTrackingById(
    id: string,
    userId: string
  ): Promise<TrackingResponse | null> {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking || tracking.userId !== userId) {
      return null;
    }

    return this.trackingRepository.toResponse(tracking);
  }

  // =====================
  // US3: Record Snapshots
  // =====================

  /**
   * T025: 記錄結算快照
   */
  async recordSettlementSnapshot(
    tracking: TrackingWithUser,
    rates: FundingRatePair,
    settlementSide: 'LONG' | 'SHORT' | 'BOTH'
  ): Promise<SnapshotResponse> {
    const longRateData = this.findExchangeRate(rates, tracking.longExchange);
    const shortRateData = this.findExchangeRate(rates, tracking.shortExchange);

    if (!longRateData || !shortRateData) {
      throw new Error('Unable to find rate data for tracking exchanges');
    }

    const longRate = longRateData.rate;
    const shortRate = shortRateData.rate;
    const spread = (shortRate - longRate) * 100;

    // 獲取價格（如果可用）
    const longPrice = longRateData.markPrice ?? null;
    const shortPrice = shortRateData.markPrice ?? null;

    // T026: 計算結算收益（使用固定顆數模式）
    const fundingProfit = this.calculateSettlementProfit(
      tracking,
      longRate,
      shortRate,
      settlementSide,
      longPrice,
      shortPrice
    );

    // 獲取最新累計收益
    const latestSnapshot = await this.snapshotRepository.findLatestByTrackingId(
      tracking.id
    );
    const previousProfit = latestSnapshot?.cumulativeProfit ?? 0;
    const cumulativeProfit = previousProfit + fundingProfit;

    // 計算年化收益
    const avgIntervalHours =
      (tracking.longIntervalHours + tracking.shortIntervalHours) / 2;
    const annualizedReturn = spread * (8760 / avgIntervalHours);

    // 計算價差百分比
    const priceDiffPercent =
      longPrice && shortPrice
        ? ((shortPrice - longPrice) / longPrice) * 100
        : null;

    const snapshot = await this.snapshotRepository.create({
      trackingId: tracking.id,
      snapshotType: 'SETTLEMENT',
      longRate,
      shortRate,
      spread,
      annualizedReturn,
      longPrice: longPrice ?? undefined,
      shortPrice: shortPrice ?? undefined,
      priceDiffPercent: priceDiffPercent ?? undefined,
      settlementSide,
      fundingProfit,
      cumulativeProfit,
    });

    // T030: 更新追蹤統計
    await this.updateTrackingStatistics(tracking.id, spread, cumulativeProfit);

    logger.info(
      {
        trackingId: tracking.id,
        symbol: tracking.symbol,
        fundingProfit,
        cumulativeProfit,
      },
      'Settlement snapshot recorded'
    );

    return snapshot;
  }

  /**
   * T026: 計算結算收益
   *
   * 使用固定顆數模式計算收益：
   * - 收益 = 倉位數量 × 標記價格 × 費率
   * - 如果沒有固定顆數，則回退到資金模式
   */
  private calculateSettlementProfit(
    tracking: TrackingWithUser,
    longRate: number,
    shortRate: number,
    settlementSide: 'LONG' | 'SHORT' | 'BOTH',
    currentLongPrice?: number | null,
    currentShortPrice?: number | null
  ): number {
    // 如果有固定顆數且有當前價格，使用固定顆數計算
    if (
      tracking.positionQuantity &&
      currentLongPrice &&
      currentShortPrice
    ) {
      const quantity = tracking.positionQuantity;
      const longPositionValue = quantity * currentLongPrice;
      const shortPositionValue = quantity * currentShortPrice;

      switch (settlementSide) {
        case 'LONG':
          // Long 倉位收費/付費（負費率收取，正費率支付）
          return longPositionValue * -longRate;
        case 'SHORT':
          // Short 倉位收費/付費（正費率收取，負費率支付）
          return shortPositionValue * shortRate;
        case 'BOTH':
        default:
          // 雙方結算：完整套利收益
          return (shortPositionValue * shortRate) - (longPositionValue * longRate);
      }
    }

    // 回退到資金模式（舊邏輯，兼容沒有固定顆數的舊追蹤）
    const capital = tracking.simulatedCapital;
    switch (settlementSide) {
      case 'LONG':
        return capital * -longRate;
      case 'SHORT':
        return capital * shortRate;
      case 'BOTH':
      default:
        return capital * (shortRate - longRate);
    }
  }

  /**
   * T027: 為所有活躍追蹤記錄結算快照
   */
  async recordSettlementSnapshots(
    rates: FundingRatePair[]
  ): Promise<{ processed: number; recorded: number }> {
    const activeTrackings = await this.trackingRepository.findAllActive();
    let recorded = 0;

    for (const tracking of activeTrackings) {
      // 找到對應的費率數據
      const rateData = rates.find((r) => r.symbol === tracking.symbol);
      if (!rateData) {
        logger.debug(
          { symbol: tracking.symbol },
          'Rate data not found for tracking'
        );
        continue;
      }

      // T028: 檢查是否為結算時間
      const settlementCheck = this.isSettlementTime(
        tracking.longExchange,
        tracking.shortExchange,
        tracking.longIntervalHours,
        tracking.shortIntervalHours
      );

      if (settlementCheck.isSettlement && settlementCheck.side) {
        try {
          await this.recordSettlementSnapshot(
            tracking,
            rateData,
            settlementCheck.side
          );
          recorded++;
        } catch (error) {
          logger.error(
            { error, trackingId: tracking.id },
            'Failed to record snapshot'
          );
        }
      }
    }

    return { processed: activeTrackings.length, recorded };
  }

  /**
   * T028: 檢查是否為結算時間
   */
  private isSettlementTime(
    longExchange: string,
    shortExchange: string,
    longIntervalHours: number,
    shortIntervalHours: number
  ): SettlementCheck {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    // 檢查是否在結算窗口內（±2 分鐘）
    const isWithinWindow =
      currentMinute <= this.settlementWindowMinutes ||
      currentMinute >= 60 - this.settlementWindowMinutes;

    if (!isWithinWindow) {
      return { isSettlement: false, side: null };
    }

    // 檢查各交易所結算時間
    const longSettles = this.isExchangeSettlementHour(
      longExchange,
      currentHour,
      longIntervalHours
    );
    const shortSettles = this.isExchangeSettlementHour(
      shortExchange,
      currentHour,
      shortIntervalHours
    );

    if (longSettles && shortSettles) {
      return { isSettlement: true, side: 'BOTH' };
    } else if (longSettles) {
      return { isSettlement: true, side: 'LONG' };
    } else if (shortSettles) {
      return { isSettlement: true, side: 'SHORT' };
    }

    return { isSettlement: false, side: null };
  }

  /**
   * 檢查交易所是否在指定小時結算
   */
  private isExchangeSettlementHour(
    _exchange: string,
    hour: number,
    intervalHours: number
  ): boolean {
    // 大多數交易所在 UTC 00:00, 08:00, 16:00 結算 (8 小時間隔)
    // 有些使用 1 小時或 4 小時間隔
    // Note: _exchange 參數保留供未來交易所特定邏輯使用
    const settlementHours: number[] = [];

    for (let h = 0; h < 24; h += intervalHours) {
      settlementHours.push(h);
    }

    return settlementHours.includes(hour);
  }

  /**
   * T030: 更新追蹤統計
   */
  private async updateTrackingStatistics(
    trackingId: string,
    currentSpread: number,
    cumulativeProfit: number
  ): Promise<void> {
    const tracking = await this.trackingRepository.findById(trackingId);
    if (!tracking) return;

    const stats = await this.snapshotRepository.getStatsSummary(trackingId);

    await this.trackingRepository.updateStatistics(trackingId, {
      totalFundingProfit: cumulativeProfit,
      totalSettlements: stats.settlementCount,
      maxSpread: Math.max(tracking.maxSpread, currentSpread),
      minSpread: Math.min(tracking.minSpread, currentSpread),
    });
  }

  // =====================
  // US4: Stop Tracking
  // =====================

  /**
   * T031: 停止追蹤
   *
   * 計算並記錄損益：
   * - 幣價損益 = (平倉價格 - 開倉價格) × 顆數 (多空合計)
   * - 資費差損益 = totalFundingProfit (累計的資費收益)
   * - 合計損益 = 幣價損益 + 資費差損益
   */
  async stopTracking(
    id: string,
    userId: string,
    currentPrices?: { longPrice: number; shortPrice: number }
  ): Promise<TrackingResponse> {
    // 先獲取追蹤記錄以計算損益
    const existingTracking = await this.trackingRepository.findById(id);

    if (!existingTracking || existingTracking.userId !== userId) {
      throw new Error('Tracking not found');
    }

    let pnlData:
      | {
          exitLongPrice: number;
          exitShortPrice: number;
          pricePnl: number;
          fundingPnl: number;
          totalPnl: number;
        }
      | undefined;

    // 如果有固定顆數和開倉價格，計算損益
    if (
      existingTracking.positionQuantity &&
      existingTracking.initialLongPrice &&
      existingTracking.initialShortPrice &&
      currentPrices
    ) {
      const { longPrice: exitLongPrice, shortPrice: exitShortPrice } = currentPrices;
      const quantity = existingTracking.positionQuantity;

      // 多頭損益 = (平倉價 - 開倉價) × 顆數
      const longPricePnl =
        (exitLongPrice - existingTracking.initialLongPrice) * quantity;

      // 空頭損益 = (開倉價 - 平倉價) × 顆數
      const shortPricePnl =
        (existingTracking.initialShortPrice - exitShortPrice) * quantity;

      // 幣價總損益
      const pricePnl = longPricePnl + shortPricePnl;

      // 資費差損益
      const fundingPnl = existingTracking.totalFundingProfit;

      // 合計損益
      const totalPnl = pricePnl + fundingPnl;

      pnlData = {
        exitLongPrice,
        exitShortPrice,
        pricePnl,
        fundingPnl,
        totalPnl,
      };

      logger.info(
        {
          trackingId: id,
          quantity,
          initialLongPrice: existingTracking.initialLongPrice,
          initialShortPrice: existingTracking.initialShortPrice,
          exitLongPrice,
          exitShortPrice,
          longPricePnl,
          shortPricePnl,
          pricePnl,
          fundingPnl,
          totalPnl,
        },
        'Calculated PnL for tracking stop'
      );
    }

    const tracking = await this.trackingRepository.stop(id, userId, pnlData);
    return this.trackingRepository.toResponse(tracking);
  }

  // =====================
  // US5: View History
  // =====================

  /**
   * T035: 查詢追蹤的快照列表
   */
  async getSnapshotsByTrackingId(
    trackingId: string,
    userId: string,
    options: SnapshotQueryInput
  ): Promise<{
    snapshots: SnapshotResponse[];
    pagination: PaginationInfo;
  } | null> {
    // 驗證追蹤歸屬
    const tracking = await this.trackingRepository.findById(trackingId);
    if (!tracking || tracking.userId !== userId) {
      return null;
    }

    return this.snapshotRepository.findByTrackingId(trackingId, options);
  }

  // =====================
  // US6: Auto-Stop
  // =====================

  /**
   * T040: 檢查並過期低於閾值的追蹤
   */
  async checkAndExpireTrackings(
    rates: FundingRatePair[]
  ): Promise<{ checked: number; expired: number }> {
    const activeTrackings = await this.trackingRepository.findAllActive();
    let expired = 0;

    for (const tracking of activeTrackings) {
      // 只處理啟用自動過期的追蹤
      if (!tracking.autoStopOnExpire) {
        continue;
      }

      const rateData = rates.find((r) => r.symbol === tracking.symbol);
      if (!rateData) {
        // 如果找不到費率數據，視為機會已消失
        try {
          await this.trackingRepository.expire(tracking.id);
          expired++;
          logger.info(
            { trackingId: tracking.id, reason: 'rate_not_found' },
            'Tracking expired'
          );
        } catch (error) {
          logger.error(
            { error, trackingId: tracking.id },
            'Failed to expire tracking'
          );
        }
        continue;
      }

      // 計算當前年化收益
      const longRateData = this.findExchangeRate(
        rateData,
        tracking.longExchange
      );
      const shortRateData = this.findExchangeRate(
        rateData,
        tracking.shortExchange
      );

      if (!longRateData || !shortRateData) {
        // 交易所不再提供此交易對
        try {
          await this.trackingRepository.expire(tracking.id);
          expired++;
          logger.info(
            { trackingId: tracking.id, reason: 'exchange_not_available' },
            'Tracking expired'
          );
        } catch (error) {
          logger.error(
            { error, trackingId: tracking.id },
            'Failed to expire tracking'
          );
        }
        continue;
      }

      const spread = (shortRateData.rate - longRateData.rate) * 100;
      const avgIntervalHours =
        (tracking.longIntervalHours + tracking.shortIntervalHours) / 2;
      const currentAPY = spread * (8760 / avgIntervalHours);

      if (currentAPY < this.autoExpireThreshold) {
        try {
          await this.trackingRepository.expire(tracking.id);
          expired++;
          logger.info(
            {
              trackingId: tracking.id,
              currentAPY,
              threshold: this.autoExpireThreshold,
            },
            'Tracking expired due to low APY'
          );
        } catch (error) {
          logger.error(
            { error, trackingId: tracking.id },
            'Failed to expire tracking'
          );
        }
      }
    }

    return { checked: activeTrackings.length, expired };
  }

  // =====================
  // Delete & Cleanup
  // =====================

  /**
   * T045: 刪除追蹤
   */
  async deleteTracking(id: string, userId: string): Promise<boolean> {
    return this.trackingRepository.delete(id, userId);
  }

  /**
   * T046: 清理過期追蹤
   */
  async cleanupExpiredTrackings(daysOld: number = 30): Promise<number> {
    return this.trackingRepository.cleanupExpired(daysOld);
  }

  // =====================
  // Helper Methods
  // =====================

  /**
   * 從費率數據中找到指定交易所的費率
   * Note: rates.exchanges 是 Map<ExchangeName, ExchangeRateData>
   */
  private findExchangeRate(
    rates: FundingRatePair,
    exchangeName: string
  ): {
    rate: number;
    intervalHours: number;
    markPrice?: number;
  } | null {
    // rates.exchanges 是 Map<ExchangeName, ExchangeRateData>
    const exchangeData = rates.exchanges.get(
      exchangeName.toLowerCase() as 'binance' | 'okx' | 'mexc' | 'gateio'
    );

    if (!exchangeData) {
      return null;
    }

    return {
      rate: exchangeData.rate.fundingRate,
      intervalHours: exchangeData.originalFundingInterval || 8,
      markPrice: exchangeData.price,
    };
  }
}
