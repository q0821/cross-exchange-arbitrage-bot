/**
 * ArbitrageOpportunityTracker Unit Tests
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 3 - User Story 2
 * Task: T008 - Tracker 單元測試 (RED Phase)
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

  beforeEach(() => {
    // 建立 mock repository
    mockRepository = {
      upsert: vi.fn(),
      findAllActiveBySymbol: vi.fn(),
      markAsEnded: vi.fn(),
    } as any;

    // 建立 mock monitor (EventEmitter)
    const EventEmitterClass = require('events').EventEmitter;
    mockMonitor = new EventEmitterClass();

    // 建立 tracker 實例
    tracker = new ArbitrageOpportunityTracker(mockRepository);
  });

  describe('attach()', () => {
    it('應該正確綁定 opportunity-detected 事件', () => {
      tracker.attach(mockMonitor);

      // 驗證監聽器已添加
      const listeners = mockMonitor.listeners('opportunity-detected');
      expect(listeners).toHaveLength(1);
    });

    it('應該正確綁定 opportunity-disappeared 事件', () => {
      tracker.attach(mockMonitor);

      // 驗證監聽器已添加
      const listeners = mockMonitor.listeners('opportunity-disappeared');
      expect(listeners).toHaveLength(1);
    });
  });

  describe('handleOpportunityDetected()', () => {
    it('應該正常記錄新的套利機會', async () => {
      const pair: FundingRatePair = {
        symbol: 'BTCUSDT',
        recordedAt: new Date(),
        exchanges: new Map([
          ['binance', {
            rate: {} as any,
            originalFundingInterval: 8,
          }],
          ['okx', {
            rate: {} as any,
            originalFundingInterval: 8,
          }],
        ]),
        bestPair: {
          longExchange: 'binance',
          shortExchange: 'okx',
          spreadPercent: 0.75,
          spreadAnnualized: 219.0,
          priceDiffPercent: 0.1,
        },
      } as any;

      mockRepository.upsert.mockResolvedValue({
        id: 'test-id',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        status: 'ACTIVE',
      } as any);

      await tracker.handleOpportunityDetected(pair);

      // 驗證 repository.upsert 被正確呼叫
      expect(mockRepository.upsert).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 219.0,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      // 驗證統計數字更新
      const stats = tracker.getStats();
      expect(stats.opportunitiesRecorded).toBe(1);
      expect(stats.lastRecordedAt).toBeInstanceOf(Date);
    });

    it('當 bestPair 不存在時應該跳過記錄', async () => {
      const pair: FundingRatePair = {
        symbol: 'BTCUSDT',
        recordedAt: new Date(),
        exchanges: new Map(),
        // bestPair 未定義
      } as any;

      await tracker.handleOpportunityDetected(pair);

      // 驗證 repository.upsert 不被呼叫
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('資料庫錯誤時應該記錄錯誤但不中斷監測', async () => {
      const pair: FundingRatePair = {
        symbol: 'BTCUSDT',
        recordedAt: new Date(),
        exchanges: new Map([
          ['binance', {
            rate: {} as any,
            originalFundingInterval: 8,
          }],
          ['okx', {
            rate: {} as any,
            originalFundingInterval: 8,
          }],
        ]),
        bestPair: {
          longExchange: 'binance',
          shortExchange: 'okx',
          spreadPercent: 0.75,
          spreadAnnualized: 219.0,
          priceDiffPercent: 0.1,
        },
      } as any;

      // Mock 資料庫錯誤
      mockRepository.upsert.mockRejectedValue(new Error('Database connection failed'));

      // 應該不拋出錯誤
      await expect(tracker.handleOpportunityDetected(pair)).resolves.toBeUndefined();

      // 驗證錯誤計數增加
      const stats = tracker.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('handleOpportunityDisappeared()', () => {
    it('應該正常結束單一機會', async () => {
      const symbol = 'BTCUSDT';
      const mockOpportunity = {
        id: 'test-id',
        symbol,
        longExchange: 'binance',
        shortExchange: 'okx',
        status: 'ACTIVE',
        detectedAt: new Date(Date.now() - 3600000), // 1小時前
        currentSpread: { toNumber: () => 0.5 },
        currentAPY: { toNumber: () => 146.0 },
      } as any;

      mockRepository.findAllActiveBySymbol.mockResolvedValue([mockOpportunity]);
      mockRepository.markAsEnded.mockResolvedValue({
        ...mockOpportunity,
        status: 'ENDED',
      } as any);

      await tracker.handleOpportunityDisappeared(symbol);

      // 驗證 markAsEnded 被正確呼叫
      expect(mockRepository.markAsEnded).toHaveBeenCalledWith(
        symbol,
        'binance',
        'okx',
        0.5,
        146.0
      );

      // 驗證統計數字更新
      const stats = tracker.getStats();
      expect(stats.opportunitiesEnded).toBe(1);
    });

    it('應該正常結束多個機會（不同交易所組合）', async () => {
      const symbol = 'BTCUSDT';
      const mockOpportunities = [
        {
          id: 'test-id-1',
          symbol,
          longExchange: 'binance',
          shortExchange: 'okx',
          status: 'ACTIVE',
          detectedAt: new Date(),
          currentSpread: { toNumber: () => 0.5 },
          currentAPY: { toNumber: () => 146.0 },
        },
        {
          id: 'test-id-2',
          symbol,
          longExchange: 'gateio',
          shortExchange: 'mexc',
          status: 'ACTIVE',
          detectedAt: new Date(),
          currentSpread: { toNumber: () => 0.6 },
          currentAPY: { toNumber: () => 175.0 },
        },
      ] as any;

      mockRepository.findAllActiveBySymbol.mockResolvedValue(mockOpportunities);
      mockRepository.markAsEnded.mockResolvedValue({} as any);

      await tracker.handleOpportunityDisappeared(symbol);

      // 驗證 markAsEnded 被呼叫兩次
      expect(mockRepository.markAsEnded).toHaveBeenCalledTimes(2);

      // 驗證統計數字更新
      const stats = tracker.getStats();
      expect(stats.opportunitiesEnded).toBe(2);
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

  describe('detach()', () => {
    it('應該正確解除事件綁定', () => {
      tracker.attach(mockMonitor);

      // 驗證監聽器已添加
      expect(mockMonitor.listeners('opportunity-detected')).toHaveLength(1);
      expect(mockMonitor.listeners('opportunity-disappeared')).toHaveLength(1);

      tracker.detach();

      // 驗證事件監聽器已移除
      expect(mockMonitor.listeners('opportunity-detected')).toHaveLength(0);
      expect(mockMonitor.listeners('opportunity-disappeared')).toHaveLength(0);
    });
  });
});
