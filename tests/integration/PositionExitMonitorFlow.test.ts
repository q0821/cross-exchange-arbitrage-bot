/**
 * PositionExitMonitor Integration Tests
 *
 * Feature: 067-position-exit-monitor
 * Phase: 2 - User Story 1
 *
 * 測試完整流程：
 * - rate-updated → 檢查持倉 → 發送通知
 * - APY 回升時發送 canceled 事件
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Decimal } from 'decimal.js';

// 檢查是否執行整合測試
const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const {
  mockFindMany,
  mockUpdate,
  mockFindUnique,
  mockEmitExitSuggested,
  mockEmitExitCanceled,
  mockSendDiscordNotification,
  mockSendSlackNotification,
  mockGetCumulativeFundingPnL,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockEmitExitSuggested: vi.fn(),
  mockEmitExitCanceled: vi.fn(),
  mockSendDiscordNotification: vi.fn(),
  mockSendSlackNotification: vi.fn(),
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
    notificationWebhook: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'webhook-discord',
          userId: 'user-test-001',
          platform: 'discord',
          webhookUrl: 'https://discord.com/api/webhooks/test',
          isEnabled: true,
          name: 'Discord Test',
          threshold: 800,
          notifyOnDisappear: true,
          notificationMinutes: [50],
          requireFavorablePrice: false,
        },
        {
          id: 'webhook-slack',
          userId: 'user-test-001',
          platform: 'slack',
          webhookUrl: 'https://hooks.slack.com/services/test',
          isEnabled: true,
          name: 'Slack Test',
          threshold: 800,
          notifyOnDisappear: true,
          notificationMinutes: [50],
          requireFavorablePrice: false,
        },
      ]),
    },
    apiKey: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'apikey-binance-001',
          userId: 'user-test-001',
          exchange: 'binance',
          encryptedKey: 'test-api-key',
          encryptedSecret: 'test-api-secret',
          encryptedPassphrase: null,
          environment: 'MAINNET',
          isActive: true,
        },
        {
          id: 'apikey-okx-001',
          userId: 'user-test-001',
          exchange: 'okx',
          encryptedKey: 'test-api-key',
          encryptedSecret: 'test-api-secret',
          encryptedPassphrase: 'test-passphrase',
          environment: 'MAINNET',
          isActive: true,
        },
      ]),
    },
  },
}));

vi.mock('@/services/websocket/PositionExitEmitter', () => ({
  positionExitEmitter: {
    emitExitSuggested: mockEmitExitSuggested,
    emitExitCanceled: mockEmitExitCanceled,
  },
}));

vi.mock('@/services/notification/DiscordNotifier', () => ({
  DiscordNotifier: class MockDiscordNotifier {
    sendExitSuggestionNotification = mockSendDiscordNotification;
  },
}));

vi.mock('@/services/notification/SlackNotifier', () => ({
  SlackNotifier: class MockSlackNotifier {
    sendExitSuggestionNotification = mockSendSlackNotification;
  },
}));

vi.mock('@/lib/funding-pnl-calculator', () => ({
  getCumulativeFundingPnL: mockGetCumulativeFundingPnL,
}));

// Mock encryption to avoid decryption errors in tests
vi.mock('@/lib/encryption', () => ({
  encrypt: (value: string) => value,
  decrypt: (value: string) => value,
}));

// Import after mocks
import { PositionExitMonitor } from '@/services/monitor/PositionExitMonitor';
import type { FundingRatePair } from '@/models/FundingRate';
import { ExitSuggestionReason } from '@/services/monitor/types';

describe.skipIf(!RUN_INTEGRATION_TESTS)('PositionExitMonitor Integration Flow', () => {
  let monitor: PositionExitMonitor;
  let fundingRateMonitor: EventEmitter;

  // 建立測試用的 FundingRatePair
  const createPair = (apy: number, symbol = 'BTCUSDT'): FundingRatePair =>
    ({
      symbol,
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
    id: 'position-int-001',
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
    cachedFundingPnL: null,
    cachedFundingPnLUpdatedAt: null,
    exitSuggested: false,
    exitSuggestedAt: null,
    exitSuggestedReason: null,
    ...overrides,
  });

  // 建立測試用的用戶設定
  const createUserSettings = (overrides = {}) => ({
    id: 'settings-int-001',
    userId: 'user-test-001',
    exitSuggestionEnabled: true,
    exitSuggestionThreshold: new Decimal('100'),
    exitNotificationEnabled: true,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 建立 FundingRateMonitor 模擬器
    fundingRateMonitor = new EventEmitter();

    // 預設 mock 回傳值
    mockFindUnique.mockResolvedValue(createUserSettings());
    mockSendDiscordNotification.mockResolvedValue({ success: true });
    mockSendSlackNotification.mockResolvedValue({ success: true });

    // 建立並附加 monitor
    monitor = new PositionExitMonitor();
    monitor.attach(fundingRateMonitor);
  });

  afterEach(() => {
    vi.useRealTimers();
    monitor.detach();
  });

  describe('完整流程：APY 轉負 → 發送通知', () => {
    it('當 APY 轉負時應該完成完整的通知流程', async () => {
      // Setup: 有一個 OPEN 持倉
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // Act: 觸發 rate-updated 事件，APY = -50%
      const pair = createPair(-50);
      fundingRateMonitor.emit('rate-updated', pair);

      // 等待非同步處理完成
      await vi.runAllTimersAsync();

      // Assert: 驗證完整流程
      // 1. 查詢 OPEN 持倉
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'BTCUSDT', status: 'OPEN' },
        })
      );

      // 2. 查詢用戶設定
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: position.userId },
        })
      );

      // 3. 計算累計費率收益
      expect(mockGetCumulativeFundingPnL).toHaveBeenCalled();

      // 4. 更新 Position
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: position.id },
          data: expect.objectContaining({
            exitSuggested: true,
            exitSuggestedReason: ExitSuggestionReason.APY_NEGATIVE,
          }),
        })
      );

      // 5. 發送 WebSocket 事件
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        position.userId,
        expect.objectContaining({
          positionId: position.id,
          reason: ExitSuggestionReason.APY_NEGATIVE,
        })
      );

      // 6. 發送 Discord/Slack 通知（如果用戶設定啟用）
      expect(mockSendDiscordNotification).toHaveBeenCalled();
      expect(mockSendSlackNotification).toHaveBeenCalled();
    });
  });

  describe('完整流程：PROFIT_LOCKABLE 觸發', () => {
    it('當 APY 低於閾值且有獲利時應該觸發 PROFIT_LOCKABLE', async () => {
      // Setup
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('20')); // 有獲利
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // Act: APY = 50%（低於 100% 閾值），累計收益 20 > 價差損失
      const pair = createPair(50);
      fundingRateMonitor.emit('rate-updated', pair);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        position.userId,
        expect.objectContaining({
          reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        })
      );
    });
  });

  describe('完整流程：APY 回升 → 取消建議', () => {
    it('當 APY 回升時應該發送取消通知', async () => {
      // Setup: 已經有平倉建議的持倉
      const position = createOpenPosition({
        exitSuggested: true,
        exitSuggestedAt: new Date('2026-01-21T09:00:00Z'),
        exitSuggestedReason: ExitSuggestionReason.APY_NEGATIVE,
      });
      mockFindMany.mockResolvedValue([position]);
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('5'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: false });

      // Act: APY 回升到 200%
      const pair = createPair(200);
      fundingRateMonitor.emit('rate-updated', pair);
      await vi.runAllTimersAsync();

      // Assert
      // 1. 更新 Position（取消建議）
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            exitSuggested: false,
            exitSuggestedAt: null,
            exitSuggestedReason: null,
          }),
        })
      );

      // 2. 發送取消事件
      expect(mockEmitExitCanceled).toHaveBeenCalledWith(
        position.userId,
        expect.objectContaining({
          positionId: position.id,
          currentAPY: 200,
        })
      );
    });
  });

  describe('用戶設定控制', () => {
    it('用戶停用平倉建議時不應該觸發任何通知', async () => {
      // Setup: 用戶停用平倉建議
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockFindUnique.mockResolvedValue(
        createUserSettings({ exitSuggestionEnabled: false })
      );

      // Act
      fundingRateMonitor.emit('rate-updated', createPair(-50));
      await vi.runAllTimersAsync();

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockEmitExitSuggested).not.toHaveBeenCalled();
      expect(mockSendDiscordNotification).not.toHaveBeenCalled();
      expect(mockSendSlackNotification).not.toHaveBeenCalled();
    });

    it('用戶停用通知時不應該發送 Discord/Slack', async () => {
      // Setup
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockFindUnique.mockResolvedValue(
        createUserSettings({ exitNotificationEnabled: false })
      );
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('12.35'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // Act
      fundingRateMonitor.emit('rate-updated', createPair(-50));
      await vi.runAllTimersAsync();

      // Assert: WebSocket 事件應該發送，但通知不發送
      expect(mockEmitExitSuggested).toHaveBeenCalled();
      expect(mockSendDiscordNotification).not.toHaveBeenCalled();
      expect(mockSendSlackNotification).not.toHaveBeenCalled();
    });

    it('自訂閾值應該被正確使用', async () => {
      // Setup: 用戶設定閾值為 50%
      const position = createOpenPosition();
      mockFindMany.mockResolvedValue([position]);
      mockFindUnique.mockResolvedValue(
        createUserSettings({ exitSuggestionThreshold: new Decimal('50') })
      );
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('15'));
      mockUpdate.mockResolvedValue({ ...position, exitSuggested: true });

      // Act: APY = 40%（低於 50% 閾值）
      fundingRateMonitor.emit('rate-updated', createPair(40));
      await vi.runAllTimersAsync();

      // Assert: 應該觸發 PROFIT_LOCKABLE
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        position.userId,
        expect.objectContaining({
          reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        })
      );
    });
  });

  describe('多持倉處理', () => {
    it('應該正確處理多個持倉', async () => {
      // Setup: 兩個不同用戶的持倉
      const position1 = createOpenPosition({
        id: 'position-001',
        userId: 'user-001',
      });
      const position2 = createOpenPosition({
        id: 'position-002',
        userId: 'user-002',
      });
      mockFindMany.mockResolvedValue([position1, position2]);
      mockFindUnique.mockResolvedValue(createUserSettings());
      mockGetCumulativeFundingPnL.mockResolvedValue(new Decimal('10'));
      mockUpdate.mockResolvedValue({ exitSuggested: true } as any);

      // Act
      fundingRateMonitor.emit('rate-updated', createPair(-50));
      await vi.runAllTimersAsync();

      // Assert: 兩個持倉都應該收到通知
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(2);
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ positionId: 'position-001' })
      );
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        'user-002',
        expect.objectContaining({ positionId: 'position-002' })
      );
    });
  });

  describe('錯誤恢復', () => {
    it('單一持倉 API 失敗時應該使用快取值繼續處理', async () => {
      // Setup: 兩個持倉，第一個的 API 會失敗但有快取值
      const position1 = createOpenPosition({
        id: 'position-001',
        userId: 'user-001',
        cachedFundingPnL: new Decimal('5'), // 有快取值
      });
      const position2 = createOpenPosition({
        id: 'position-002',
        userId: 'user-002',
      });
      mockFindMany.mockResolvedValue([position1, position2]);
      mockFindUnique.mockResolvedValue(createUserSettings());

      // 第一個持倉的累計收益計算會失敗，但會使用快取值
      mockGetCumulativeFundingPnL
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(new Decimal('10'));

      mockUpdate.mockResolvedValue({ exitSuggested: true } as any);

      // Act
      fundingRateMonitor.emit('rate-updated', createPair(-50));
      await vi.runAllTimersAsync();

      // Assert: 兩個持倉都應該收到通知（第一個使用快取值）
      expect(mockEmitExitSuggested).toHaveBeenCalledTimes(2);
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ positionId: 'position-001' })
      );
      expect(mockEmitExitSuggested).toHaveBeenCalledWith(
        'user-002',
        expect.objectContaining({ positionId: 'position-002' })
      );
    });
  });
});
