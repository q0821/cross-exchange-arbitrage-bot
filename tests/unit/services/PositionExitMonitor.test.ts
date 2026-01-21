/**
 * PositionExitMonitor Unit Tests
 *
 * Feature: 067-position-exit-monitor
 * Phase: 2 - User Story 1
 *
 * 測試平倉建議監控核心邏輯：
 * - 監聽 rate-updated 事件
 * - shouldSuggestClose() 判斷邏輯
 * - 防抖動機制（1 分鐘內不重複通知）
 * - WebSocket 和通知整合
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventEmitter } from 'events';
import type { FundingRatePair } from '@/models/FundingRate';
import { Decimal } from 'decimal.js';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const {
  mockFindMany,
  mockUpdate,
  mockFindUnique,
  mockEmitExitSuggested,
  mockEmitExitCanceled,
  _mockSendNotification,
  mockGetCumulativeFundingPnL,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockEmitExitSuggested: vi.fn(),
  mockEmitExitCanceled: vi.fn(),
  _mockSendNotification: vi.fn(),
  mockGetCumulativeFundingPnL: vi.fn(),
}));

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    position: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
    tradingSettings: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('@/services/websocket/PositionExitEmitter', () => ({
  positionExitEmitter: {
    emitExitSuggested: mockEmitExitSuggested,
    emitExitCanceled: mockEmitExitCanceled,
  },
}));

vi.mock('@/lib/funding-pnl-calculator', () => ({
  getCumulativeFundingPnL: mockGetCumulativeFundingPnL,
}));

// Mock exchange-connector-factory to prevent import errors
vi.mock('@/lib/exchange-connector-factory', () => ({
  createExchangeConnector: vi.fn(),
}));

// Import after mocks
import { PositionExitMonitor } from '@/services/monitor/PositionExitMonitor';
import { ExitSuggestionReason } from '@/services/monitor/types';

describe('PositionExitMonitor', () => {
  let monitor: PositionExitMonitor;
  let mockEventEmitter: EventEmitter;

  // 建立測試用的 FundingRatePair
  const createPair = (apy: number): FundingRatePair =>
    ({
      symbol: 'BTCUSDT',
      recordedAt: new Date(),
      exchanges: new Map([
        [
          'binance',
          {
            rate: { fundingRate: 0.0001, markPrice: 65000 },
            originalFundingInterval: 8,
          },
        ],
        [
          'okx',
          {
            rate: { fundingRate: 0.0002, markPrice: 65050 },
            originalFundingInterval: 8,
          },
        ],
      ]),
      bestPair: {
        longExchange: 'binance',
        shortExchange: 'okx',
        spreadPercent: 0.01,
        spreadAnnualized: apy,
        priceDiffPercent: 0.1,
      },
    }) as any;

  // 建立測試用的 OPEN 持倉
  const createOpenPosition = (overrides = {}) => ({
    id: 'position-test-001',
    userId: 'user-test-001',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longEntryPrice: new Decimal('65000.00'),
    shortEntryPrice: new Decimal('65050.00'),
    longPositionSize: new Decimal('0.01'),
    shortPositionSize: new Decimal('0.01'),
    longLeverage: 3,
    shortLeverage: 3,
    status: 'OPEN',
    openedAt: new Date('2026-01-20T10:00:00Z'),
    // Feature 067 欄位
    cachedFundingPnL: null,
    cachedFundingPnLUpdatedAt: null,
    exitSuggested: false,
    exitSuggestedAt: null,
    exitSuggestedReason: null,
    ...overrides,
  });

  // 建立測試用的用戶設定
  const createUserSettings = (overrides = {}) => ({
    id: 'settings-test-001',
    userId: 'user-test-001',
    exitSuggestionEnabled: true,
    exitSuggestionThreshold: new Decimal('100'), // 100% APY
    exitNotificationEnabled: true,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 建立 mock EventEmitter
    const EventEmitterClass = require('events').EventEmitter;
    mockEventEmitter = new EventEmitterClass();

    // 預設 mock 回傳值
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(createUserSettings());
    mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('0'));

    // 建立 monitor 實例
    monitor = new PositionExitMonitor();
  });

  afterEach(() => {
    vi.useRealTimers();
    monitor.detach();
  });

  describe('attach()', () => {
    it('應該正確綁定 rate-updated 事件', () => {
      monitor.attach(mockEventEmitter);

      const listeners = mockEventEmitter.listeners('rate-updated');
      expect(listeners).toHaveLength(1);
    });

    it('重複 attach 不應該產生多個監聽器', () => {
      monitor.attach(mockEventEmitter);
      monitor.attach(mockEventEmitter);

      const listeners = mockEventEmitter.listeners('rate-updated');
      expect(listeners).toHaveLength(1);
    });
  });

  describe('detach()', () => {
    it('應該正確解除 rate-updated 事件綁定', () => {
      monitor.attach(mockEventEmitter);
      expect(mockEventEmitter.listeners('rate-updated')).toHaveLength(1);

      monitor.detach();
      expect(mockEventEmitter.listeners('rate-updated')).toHaveLength(0);
    });
  });

  describe('shouldSuggestClose()', () => {
    describe('條件 1：APY < 0% (APY_NEGATIVE)', () => {
      it('APY < 0% 時應該返回 APY_NEGATIVE', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: -10,
          threshold: 100,
          fundingPnL: new Decimal('5'),
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: true,
          reason: ExitSuggestionReason.APY_NEGATIVE,
        });
      });

      it('APY = -0.01% 時應該返回 APY_NEGATIVE', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: -0.01,
          threshold: 100,
          fundingPnL: new Decimal('5'),
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: true,
          reason: ExitSuggestionReason.APY_NEGATIVE,
        });
      });
    });

    describe('條件 2：APY < threshold AND fundingPnL > priceDiffLoss (PROFIT_LOCKABLE)', () => {
      it('APY < threshold 且 fundingPnL > priceDiffLoss 時應該返回 PROFIT_LOCKABLE', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: 50, // 低於 100% threshold
          threshold: 100,
          fundingPnL: new Decimal('15'), // 15 > 10
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: true,
          reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        });
      });

      it('APY 剛好等於 threshold 時不應該觸發 PROFIT_LOCKABLE', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: 100, // 等於 100% threshold
          threshold: 100,
          fundingPnL: new Decimal('15'),
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: false,
          reason: null,
        });
      });

      it('APY < threshold 但 fundingPnL <= priceDiffLoss 時不應該觸發', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: 50,
          threshold: 100,
          fundingPnL: new Decimal('10'), // 等於
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: false,
          reason: null,
        });
      });
    });

    describe('不觸發情況', () => {
      it('APY >= threshold 且 >= 0% 時不應該觸發', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: 150,
          threshold: 100,
          fundingPnL: new Decimal('20'),
          priceDiffLoss: new Decimal('5'),
        });

        expect(result).toEqual({
          suggest: false,
          reason: null,
        });
      });

      it('APY = 0% 且 fundingPnL <= priceDiffLoss 時不應該觸發', () => {
        const result = monitor.shouldSuggestClose({
          currentAPY: 0,
          threshold: 100,
          fundingPnL: new Decimal('5'),
          priceDiffLoss: new Decimal('10'),
        });

        expect(result).toEqual({
          suggest: false,
          reason: null,
        });
      });
    });
  });

  describe('handleRateUpdated()', () => {
    beforeEach(() => {
      monitor.attach(mockEventEmitter);
    });

    it('應該查詢該 symbol 的 OPEN 持倉', async () => {
      mockFindMany.mockResolvedValue([]);

      await monitor.handleRateUpdated(createPair(500));

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            symbol: 'BTCUSDT',
            status: 'OPEN',
          },
        })
      );
    });

    it('沒有 OPEN 持倉時不應該進行任何判斷', async () => {
      mockFindMany.mockResolvedValue([]);

      await monitor.handleRateUpdated(createPair(500));

      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockGetCumulativeFundingPnL).not.toHaveBeenCalled();
    });

    it('當 bestPair 不存在時應該跳過', async () => {
      const pairNoBestPair: FundingRatePair = {
        symbol: 'BTCUSDT',
        recordedAt: new Date(),
        exchanges: new Map(),
      } as any;

      await monitor.handleRateUpdated(pairNoBestPair);

      expect(mockFindMany).not.toHaveBeenCalled();
    });

    describe('平倉建議流程', () => {
      it('APY < 0% 時應該更新 Position 並發送通知', async () => {
        const position = createOpenPosition();
        mockFindMany.mockResolvedValue([position]);
        mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
        mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

        await monitor.handleRateUpdated(createPair(-50));

        // 驗證 Position 更新
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: position.id },
            data: expect.objectContaining({
              exitSuggested: true,
              exitSuggestedReason: ExitSuggestionReason.APY_NEGATIVE,
            }),
          })
        );

        // 驗證 WebSocket 事件發送
        expect(mockEmitExitSuggested).toHaveBeenCalledWith(
          position.userId,
          expect.objectContaining({
            positionId: position.id,
            symbol: 'BTCUSDT',
            reason: ExitSuggestionReason.APY_NEGATIVE,
          })
        );
      });

      it('用戶停用平倉建議時不應該觸發', async () => {
        const position = createOpenPosition();
        mockFindMany.mockResolvedValue([position]);
        mockFindUnique.mockResolvedValue(
          createUserSettings({ exitSuggestionEnabled: false })
        );

        await monitor.handleRateUpdated(createPair(-50));

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockEmitExitSuggested).not.toHaveBeenCalled();
      });
    });

    describe('建議取消流程', () => {
      it('已建議平倉的持倉在 APY 回升時應該取消建議', async () => {
        const position = createOpenPosition({
          exitSuggested: true,
          exitSuggestedAt: new Date('2026-01-21T09:00:00Z'),
          exitSuggestedReason: ExitSuggestionReason.APY_NEGATIVE,
        });
        mockFindMany.mockResolvedValue([position]);
        mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('5'));
        mockUpdate.mockResolvedValue({ ...position, exitSuggested: false });

        // APY 回升到 200%，不符合任何建議條件
        await monitor.handleRateUpdated(createPair(200));

        // 驗證取消建議
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: position.id },
            data: expect.objectContaining({
              exitSuggested: false,
              exitSuggestedAt: null,
              exitSuggestedReason: null,
            }),
          })
        );

        // 驗證發送取消事件
        expect(mockEmitExitCanceled).toHaveBeenCalledWith(
          position.userId,
          expect.objectContaining({
            positionId: position.id,
            symbol: 'BTCUSDT',
          })
        );
      });
    });
  });

  describe('防抖動機制', () => {
    beforeEach(() => {
      monitor.attach(mockEventEmitter);
    });

    it('同一持倉 1 分鐘內不應該重複發送通知', async () => {
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // 第一次觸發
      await monitor.handleRateUpdated(createPair(-50));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(1);

      // 立即再次觸發（應該被防抖動阻擋）
      await monitor.handleRateUpdated(createPair(-60));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(1); // 仍然是 1 次

      // 前進 30 秒，仍然在防抖動期間
      vi.advanceTimersByTime(30_000);
      await monitor.handleRateUpdated(createPair(-70));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(1);
    });

    it('超過 1 分鐘後應該可以再次發送通知', async () => {
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // 第一次觸發
      await monitor.handleRateUpdated(createPair(-50));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(1);

      // 前進超過 1 分鐘
      vi.advanceTimersByTime(61_000);

      // 第二次觸發（應該可以發送）
      await monitor.handleRateUpdated(createPair(-60));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(2);
    });

    it('不同持倉的防抖動應該獨立', async () => {
      const position1 = createOpenPosition({ id: 'position-001' });
      const position2 = createOpenPosition({
        id: 'position-002',
        userId: 'user-002',
      });
      mockFindMany.mockResolvedValue([position1, position2]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ exitSuggested: true } as any);

      // 第一次觸發，兩個持倉都應該收到通知
      await monitor.handleRateUpdated(createPair(-50));
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats()', () => {
    it('應該回傳正確的統計資料', () => {
      const stats = monitor.getStats();

      expect(stats).toHaveProperty('suggestionsEmitted');
      expect(stats).toHaveProperty('suggestionsCanceled');
      expect(stats).toHaveProperty('lastCheckAt');
      expect(stats).toHaveProperty('errors');
      expect(stats.suggestionsEmitted).toBe(0);
      expect(stats.suggestionsCanceled).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('發送建議後統計應該更新', async () => {
      monitor.attach(mockEventEmitter);
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      await monitor.handleRateUpdated(createPair(-50));

      const stats = monitor.getStats();
      expect(stats.suggestionsEmitted).toBe(1);
      expect(stats.lastCheckAt).toBeInstanceOf(Date);
    });
  });

  describe('錯誤處理', () => {
    beforeEach(() => {
      monitor.attach(mockEventEmitter);
    });

    it('資料庫查詢失敗時應該記錄錯誤但不中斷監測', async () => {
      mockFindMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        monitor.handleRateUpdated(createPair(-50))
      ).resolves.toBeUndefined();

      const stats = monitor.getStats();
      expect(stats.errors).toBe(1);
    });

    it('累計收益計算失敗時應該跳過該持倉', async () => {
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockRejectedValue(
        new Error('API rate limited')
      );

      await monitor.handleRateUpdated(createPair(-50));

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockEmitExitSuggested).not.toHaveBeenCalled();

      const stats = monitor.getStats();
      expect(stats.errors).toBe(1);
    });
  });
});
