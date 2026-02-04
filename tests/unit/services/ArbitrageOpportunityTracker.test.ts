/**
 * ArbitrageOpportunityTracker Unit Tests
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 3 - User Story 2
 *
 * 獨立生命週期邏輯測試：
 * - 監聽 rate-updated 事件
 * - 發現閾值: 800% (TRACKER_OPPORTUNITY_THRESHOLD)
 * - 結束閾值: 0% (TRACKER_OPPORTUNITY_END_THRESHOLD)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventEmitter } from 'events';
import type { FundingRatePair } from '@/models/FundingRate';
import type { ArbitrageOpportunityRepository } from '@/repositories/ArbitrageOpportunityRepository';
import { ArbitrageOpportunityTracker } from '@/services/monitor/ArbitrageOpportunityTracker';

describe('ArbitrageOpportunityTracker', () => {
  let tracker: ArbitrageOpportunityTracker;
  let mockRepository: vi.Mocked<ArbitrageOpportunityRepository>;
  let mockMonitor: EventEmitter;

  // 建立測試用的 FundingRatePair
  const createPair = (apy: number, spread = 0.01): FundingRatePair => ({
    symbol: 'BTCUSDT',
    recordedAt: new Date(),
    exchanges: new Map([
      ['binance', { rate: {} as any, originalFundingInterval: 8 }],
      ['okx', { rate: {} as any, originalFundingInterval: 8 }],
    ]),
    bestPair: {
      longExchange: 'binance',
      shortExchange: 'okx',
      spreadPercent: spread,
      spreadAnnualized: apy,
      priceDiffPercent: 0.1,
    },
  } as any);

  beforeEach(() => {
    // 建立 mock repository
    mockRepository = {
      upsert: vi.fn().mockResolvedValue({
        id: 'test-id',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        status: 'ACTIVE',
      } as any),
      findAllActiveBySymbol: vi.fn(),
      markAsEnded: vi.fn().mockResolvedValue({} as any),
    } as any;

    // 建立 mock monitor (EventEmitter)
    const EventEmitterClass = require('events').EventEmitter;
    mockMonitor = new EventEmitterClass();

    // 建立 tracker 實例
    tracker = new ArbitrageOpportunityTracker(mockRepository);
  });

  describe('attach()', () => {
    it('應該正確綁定 rate-updated 事件（獨立生命週期）', () => {
      tracker.attach(mockMonitor);

      // 驗證監聽器已添加到 rate-updated
      const listeners = mockMonitor.listeners('rate-updated');
      expect(listeners).toHaveLength(1);
    });

    it('不應該綁定 opportunity-detected 事件', () => {
      tracker.attach(mockMonitor);

      // 驗證沒有綁定到舊事件
      const listeners = mockMonitor.listeners('opportunity-detected');
      expect(listeners).toHaveLength(0);
    });
  });

  describe('handleRateUpdated() - 獨立生命週期邏輯', () => {
    describe('新機會發現（APY >= 800%）', () => {
      it('APY >= 800% 且未追蹤時應該記錄新機會', async () => {
        const pair = createPair(850); // 850% APY

        await tracker.handleRateUpdated(pair);

        // 驗證 repository.upsert 被正確呼叫
        expect(mockRepository.upsert).toHaveBeenCalledWith({
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          spread: 0.01,
          apy: 850,
          longIntervalHours: 8,
          shortIntervalHours: 8,
        });

        // 驗證統計數字更新
        const stats = tracker.getStats();
        expect(stats.opportunitiesRecorded).toBe(1);
        expect(stats.lastRecordedAt).toBeInstanceOf(Date);
      });

      it('APY 剛好 800% 時應該記錄新機會', async () => {
        const pair = createPair(800); // 剛好 800% APY

        await tracker.handleRateUpdated(pair);

        expect(mockRepository.upsert).toHaveBeenCalled();
        expect(tracker.getActiveOpportunitiesCount()).toBe(1);
      });
    });

    describe('機會更新（已追蹤 且 APY >= 0%）', () => {
      it('APY 從 850% 降到 500% 時應該繼續追蹤（更新機會）', async () => {
        // 第一次：建立追蹤
        await tracker.handleRateUpdated(createPair(850));
        expect(tracker.getActiveOpportunitiesCount()).toBe(1);

        // 第二次：APY 降到 500%，應該繼續追蹤
        await tracker.handleRateUpdated(createPair(500));

        expect(tracker.getActiveOpportunitiesCount()).toBe(1);
        expect(mockRepository.upsert).toHaveBeenCalledTimes(2);
        expect(mockRepository.markAsEnded).not.toHaveBeenCalled();
      });

      it('APY 從 850% 降到 100% 時應該繼續追蹤', async () => {
        await tracker.handleRateUpdated(createPair(850));
        await tracker.handleRateUpdated(createPair(100));

        expect(tracker.getActiveOpportunitiesCount()).toBe(1);
        expect(mockRepository.markAsEnded).not.toHaveBeenCalled();
      });

      it('APY 剛好 0% 時應該繼續追蹤（不結束）', async () => {
        await tracker.handleRateUpdated(createPair(850));
        await tracker.handleRateUpdated(createPair(0));

        expect(tracker.getActiveOpportunitiesCount()).toBe(1);
        expect(mockRepository.markAsEnded).not.toHaveBeenCalled();
      });
    });

    describe('機會結束（已追蹤 且 APY < 0%）', () => {
      it('APY 降到負值時應該結束機會', async () => {
        // 第一次：建立追蹤
        await tracker.handleRateUpdated(createPair(850));
        expect(tracker.getActiveOpportunitiesCount()).toBe(1);

        // 第二次：APY 變成負值，應該結束
        await tracker.handleRateUpdated(createPair(-10));

        expect(tracker.getActiveOpportunitiesCount()).toBe(0);
        expect(mockRepository.markAsEnded).toHaveBeenCalled();

        const stats = tracker.getStats();
        expect(stats.opportunitiesEnded).toBe(1);
      });

      it('APY 剛好 -0.01% 時應該結束機會', async () => {
        await tracker.handleRateUpdated(createPair(850));
        await tracker.handleRateUpdated(createPair(-0.01));

        expect(tracker.getActiveOpportunitiesCount()).toBe(0);
        expect(mockRepository.markAsEnded).toHaveBeenCalled();
      });
    });

    describe('不觸發（APY 在 0% ~ 800% 且未追蹤）', () => {
      it('APY 在 500% 且未追蹤時不應該記錄', async () => {
        const pair = createPair(500); // 500% APY，低於 800% 發現閾值

        await tracker.handleRateUpdated(pair);

        expect(mockRepository.upsert).not.toHaveBeenCalled();
        expect(tracker.getActiveOpportunitiesCount()).toBe(0);
      });

      it('APY 在 799% 時不應該記錄', async () => {
        await tracker.handleRateUpdated(createPair(799));

        expect(mockRepository.upsert).not.toHaveBeenCalled();
        expect(tracker.getActiveOpportunitiesCount()).toBe(0);
      });
    });

    describe('邊界情況', () => {
      it('當 bestPair 不存在時應該跳過', async () => {
        const pair: FundingRatePair = {
          symbol: 'BTCUSDT',
          recordedAt: new Date(),
          exchanges: new Map(),
          // bestPair 未定義
        } as any;

        await tracker.handleRateUpdated(pair);

        expect(mockRepository.upsert).not.toHaveBeenCalled();
      });

      it('資料庫錯誤時應該記錄錯誤但不中斷監測', async () => {
        mockRepository.upsert.mockRejectedValue(new Error('Database connection failed'));

        const pair = createPair(850);

        // 應該不拋出錯誤
        await expect(tracker.handleRateUpdated(pair)).resolves.toBeUndefined();

        // 驗證錯誤計數增加
        const stats = tracker.getStats();
        expect(stats.errors).toBe(1);
      });
    });
  });

  describe('handleOpportunityDetected() (Deprecated)', () => {
    it('應該轉發到 handleRateUpdated（只有 APY >= 800% 才會記錄）', async () => {
      const pair = createPair(850);

      await tracker.handleOpportunityDetected(pair);

      // 驗證 repository.upsert 被呼叫（因為 APY >= 800%）
      expect(mockRepository.upsert).toHaveBeenCalled();
    });

    it('APY < 800% 時不應該記錄（即使是透過舊 API）', async () => {
      const pair = createPair(500);

      await tracker.handleOpportunityDetected(pair);

      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleOpportunityDisappeared() (Deprecated)', () => {
    it('應該結束該 symbol 所有內部追蹤的機會', async () => {
      // 先建立追蹤
      await tracker.handleRateUpdated(createPair(850));
      expect(tracker.getActiveOpportunitiesCount()).toBe(1);

      // 呼叫舊的 API
      await tracker.handleOpportunityDisappeared('BTCUSDT');

      // 驗證機會被結束
      expect(tracker.getActiveOpportunitiesCount()).toBe(0);
      expect(mockRepository.markAsEnded).toHaveBeenCalled();
    });

    it('沒有追蹤的機會時不應該呼叫 markAsEnded', async () => {
      await tracker.handleOpportunityDisappeared('ETHUSDT');

      expect(mockRepository.markAsEnded).not.toHaveBeenCalled();
    });
  });

  describe('getStats()', () => {
    it('應該回傳正確的統計資料', () => {
      const stats = tracker.getStats();

      expect(stats).toHaveProperty('opportunitiesRecorded');
      expect(stats).toHaveProperty('opportunitiesEnded');
      expect(stats).toHaveProperty('lastRecordedAt');
      expect(stats).toHaveProperty('errors');
      expect(stats.opportunitiesRecorded).toBe(0);
      expect(stats.opportunitiesEnded).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('getActiveOpportunitiesCount()', () => {
    it('應該回傳正確的活躍機會數量', async () => {
      expect(tracker.getActiveOpportunitiesCount()).toBe(0);

      await tracker.handleRateUpdated(createPair(850));
      expect(tracker.getActiveOpportunitiesCount()).toBe(1);
    });
  });

  describe('getThreshold()', () => {
    it('應該回傳發現閾值 800', () => {
      expect(tracker.getThreshold()).toBe(800);
    });
  });

  describe('getEndThreshold()', () => {
    it('應該回傳結束閾值 0', () => {
      expect(tracker.getEndThreshold()).toBe(0);
    });
  });

  describe('getTopAPY()', () => {
    it('無活躍機會時應該回傳 null', () => {
      expect(tracker.getTopAPY()).toBeNull();
    });

    it('應該回傳最高的 APY', async () => {
      // 建立一個機會
      await tracker.handleRateUpdated(createPair(850));
      expect(tracker.getTopAPY()).toBe(850);
    });

    it('多個機會時應該回傳最高值', async () => {
      // 建立第一個機會 (BTCUSDT)
      await tracker.handleRateUpdated(createPair(850));

      // 建立第二個機會 (不同的 symbol)
      const secondPair: FundingRatePair = {
        symbol: 'ETHUSDT',
        recordedAt: new Date(),
        exchanges: new Map([
          ['binance', { rate: {} as any, originalFundingInterval: 8 }],
          ['gateio', { rate: {} as any, originalFundingInterval: 8 }],
        ]),
        bestPair: {
          longExchange: 'binance',
          shortExchange: 'gateio',
          spreadPercent: 0.02,
          spreadAnnualized: 1200, // 更高的 APY
          priceDiffPercent: 0.1,
        },
      } as any;

      await tracker.handleRateUpdated(secondPair);

      expect(tracker.getActiveOpportunitiesCount()).toBe(2);
      expect(tracker.getTopAPY()).toBe(1200);
    });

    it('機會結束後應該更新最高值', async () => {
      // 建立兩個機會
      await tracker.handleRateUpdated(createPair(850)); // BTCUSDT 850%

      const secondPair: FundingRatePair = {
        symbol: 'ETHUSDT',
        recordedAt: new Date(),
        exchanges: new Map([
          ['binance', { rate: {} as any, originalFundingInterval: 8 }],
          ['gateio', { rate: {} as any, originalFundingInterval: 8 }],
        ]),
        bestPair: {
          longExchange: 'binance',
          shortExchange: 'gateio',
          spreadPercent: 0.02,
          spreadAnnualized: 1200,
          priceDiffPercent: 0.1,
        },
      } as any;
      await tracker.handleRateUpdated(secondPair);

      expect(tracker.getTopAPY()).toBe(1200);

      // 結束高 APY 的機會（ETHUSDT APY 降到負值）
      const endPair: FundingRatePair = {
        ...secondPair,
        bestPair: {
          ...secondPair.bestPair!,
          spreadAnnualized: -10, // 負值會結束機會
        },
      };
      await tracker.handleRateUpdated(endPair);

      // 現在只剩 BTCUSDT
      expect(tracker.getActiveOpportunitiesCount()).toBe(1);
      expect(tracker.getTopAPY()).toBe(850);
    });
  });

  describe('detach()', () => {
    it('應該正確解除 rate-updated 事件綁定', () => {
      tracker.attach(mockMonitor);

      // 驗證監聽器已添加
      expect(mockMonitor.listeners('rate-updated')).toHaveLength(1);

      tracker.detach();

      // 驗證事件監聯器已移除
      expect(mockMonitor.listeners('rate-updated')).toHaveLength(0);
    });
  });
});
