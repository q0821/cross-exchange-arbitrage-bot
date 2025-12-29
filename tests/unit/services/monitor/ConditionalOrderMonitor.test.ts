/**
 * Test: ConditionalOrderMonitor
 * Feature: 050-sl-tp-trigger-monitor
 *
 * TDD: 測試條件單觸發偵測監控服務
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import type { Position } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn().mockImplementation((val) => val),
}));

// Mock ExchangeQueryService
const mockExchangeQueryService = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  fetchConditionalOrders: vi.fn().mockResolvedValue([]),
  fetchOrderHistory: vi.fn().mockResolvedValue(null),
  checkOrderExists: vi.fn().mockResolvedValue(true),
};

vi.mock('@/lib/exchange-query-service', () => ({
  ExchangeQueryService: vi.fn().mockImplementation(() => mockExchangeQueryService),
}));

// Mock PositionCloser
const mockPositionCloser = {
  closeSingleSide: vi.fn().mockResolvedValue({ success: true }),
  cancelSingleSideConditionalOrders: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/services/trading/PositionCloser', () => ({
  PositionCloser: vi.fn().mockImplementation(() => mockPositionCloser),
}));

// Mock DiscordNotifier
const mockDiscordNotifier = {
  sendTriggerNotification: vi.fn().mockResolvedValue({ success: true }),
  sendEmergencyNotification: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@/services/notification/DiscordNotifier', () => ({
  DiscordNotifier: vi.fn().mockImplementation(() => mockDiscordNotifier),
}));

// Mock SlackNotifier
const mockSlackNotifier = {
  sendTriggerNotification: vi.fn().mockResolvedValue({ success: true }),
  sendEmergencyNotification: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@/services/notification/SlackNotifier', () => ({
  SlackNotifier: vi.fn().mockImplementation(() => mockSlackNotifier),
}));

// Mock TriggerProgressEmitter
const mockTriggerProgressEmitter = {
  emitTriggerDetected: vi.fn(),
  emitTriggerCloseProgress: vi.fn(),
  emitTriggerCloseSuccess: vi.fn(),
  emitTriggerCloseFailed: vi.fn(),
};

vi.mock('@/services/websocket/TriggerProgressEmitter', () => ({
  triggerProgressEmitter: mockTriggerProgressEmitter,
  TriggerProgressEmitter: vi.fn().mockImplementation(() => mockTriggerProgressEmitter),
}));

describe('ConditionalOrderMonitor', () => {
  let mockPrisma: any;
  let monitor: any;

  const mockPosition: Partial<Position> = {
    id: 'pos-123',
    userId: 'user-456',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longPositionSize: new Decimal('0.001'),
    shortPositionSize: new Decimal('0.001'),
    longEntryPrice: new Decimal('95000'),
    shortEntryPrice: new Decimal('95100'),
    longLeverage: 3,
    shortLeverage: 3,
    status: 'OPEN',
    openedAt: new Date(),
    longStopLossOrderId: 'long-sl-123',
    longTakeProfitOrderId: 'long-tp-123',
    shortStopLossOrderId: 'short-sl-456',
    shortTakeProfitOrderId: 'short-tp-456',
    conditionalOrderStatus: 'SET',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockPrisma = {
      position: {
        findMany: vi.fn().mockResolvedValue([mockPosition]),
        findUnique: vi.fn().mockResolvedValue(mockPosition),
        update: vi.fn().mockResolvedValue(mockPosition),
      },
      apiKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'key-1',
          userId: 'user-456',
          exchange: 'binance',
          encryptedKey: 'key',
          encryptedSecret: 'secret',
          encryptedPassphrase: null,
          environment: 'MAINNET',
        }),
      },
      notificationWebhook: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'webhook-1',
            userId: 'user-456',
            platform: 'discord',
            webhookUrl: 'https://discord.com/api/webhooks/xxx',
            isEnabled: true,
          },
        ]),
      },
    };

    // Dynamic import
    const { ConditionalOrderMonitor } = await import(
      '@/services/monitor/ConditionalOrderMonitor'
    );
    monitor = new ConditionalOrderMonitor(mockPrisma);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== T009: 類別骨架 ====================
  describe('T009: Class Structure', () => {
    it('should be instantiable with PrismaClient', () => {
      expect(monitor).toBeDefined();
    });

    it('should have isRunning property initially false', () => {
      expect(monitor.isRunning).toBe(false);
    });

    it('should have configurable interval', () => {
      expect(monitor.intervalMs).toBeDefined();
      expect(typeof monitor.intervalMs).toBe('number');
    });
  });

  // ==================== T010: start/stop 方法 ====================
  describe('T010: start() and stop() methods', () => {
    it('should have start() method', () => {
      expect(typeof monitor.start).toBe('function');
    });

    it('should have stop() method', () => {
      expect(typeof monitor.stop).toBe('function');
    });

    it('should set isRunning to true when started', async () => {
      await monitor.start();
      expect(monitor.isRunning).toBe(true);
    });

    it('should set isRunning to false when stopped', async () => {
      await monitor.start();
      await monitor.stop();
      expect(monitor.isRunning).toBe(false);
    });

    it('should not start twice if already running', async () => {
      await monitor.start();
      await monitor.start(); // 第二次應該忽略
      expect(monitor.isRunning).toBe(true);
    });

    it('should trigger checkAllPositions periodically after start', async () => {
      const checkSpy = vi.spyOn(monitor, 'checkAllPositions');

      await monitor.start();

      // 快進 30 秒
      await vi.advanceTimersByTimeAsync(30000);

      expect(checkSpy).toHaveBeenCalled();
    });

    it('should stop periodic checks after stop()', async () => {
      const checkSpy = vi.spyOn(monitor, 'checkAllPositions');

      await monitor.start();
      await monitor.stop();

      checkSpy.mockClear();

      // 快進 60 秒
      await vi.advanceTimersByTimeAsync(60000);

      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  // ==================== T011: checkAllPositions ====================
  describe('T011: checkAllPositions() method', () => {
    it('should have checkAllPositions() method', () => {
      expect(typeof monitor.checkAllPositions).toBe('function');
    });

    it('should query all OPEN positions with conditional orders', async () => {
      await monitor.checkAllPositions();

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
            conditionalOrderStatus: 'SET',
          }),
        }),
      );
    });

    it('should check each position for triggers', async () => {
      const checkPositionSpy = vi.spyOn(monitor, 'checkPositionConditionalOrders');

      await monitor.checkAllPositions();

      expect(checkPositionSpy).toHaveBeenCalledWith(mockPosition);
    });

    it('should handle empty positions list gracefully', async () => {
      mockPrisma.position.findMany.mockResolvedValue([]);

      await expect(monitor.checkAllPositions()).resolves.not.toThrow();
    });
  });

  // ==================== T012: checkPositionConditionalOrders ====================
  describe('T012: checkPositionConditionalOrders() method', () => {
    it('should have checkPositionConditionalOrders() method', () => {
      expect(typeof monitor.checkPositionConditionalOrders).toBe('function');
    });

    it('should query conditional orders from both exchanges', async () => {
      await monitor.checkPositionConditionalOrders(mockPosition);

      // 應該呼叫 checkOrderExists 來檢查條件單是否存在
      expect(mockExchangeQueryService.checkOrderExists).toHaveBeenCalled();
    });

    it('should return null if no trigger detected', async () => {
      // 模擬所有條件單都存在
      mockExchangeQueryService.checkOrderExists.mockResolvedValue(true);

      const result = await monitor.checkPositionConditionalOrders(mockPosition);

      expect(result).toBeNull();
    });

    it('should detect trigger when order is missing', async () => {
      // 模擬 long stop loss 不存在（已觸發）
      mockExchangeQueryService.checkOrderExists
        .mockResolvedValueOnce(false) // longStopLoss - missing
        .mockResolvedValueOnce(true) // longTakeProfit - exists
        .mockResolvedValueOnce(true) // shortStopLoss - exists
        .mockResolvedValueOnce(true); // shortTakeProfit - exists

      // 模擬訂單歷史確認觸發
      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'TRIGGERED',
      });

      const result = await monitor.checkPositionConditionalOrders(mockPosition);

      expect(result).not.toBeNull();
      expect(result?.triggerType).toBe('LONG_SL');
    });
  });

  // ==================== T013: detectTrigger ====================
  describe('T013: detectTrigger() logic', () => {
    it('should have detectTrigger() method', () => {
      expect(typeof monitor.detectTrigger).toBe('function');
    });

    it('should return LONG_SL when long stop loss is missing', async () => {
      const orderStatus = {
        longStopLossExists: false,
        longTakeProfitExists: true,
        shortStopLossExists: true,
        shortTakeProfitExists: true,
      };

      const result = await monitor.detectTrigger(mockPosition, orderStatus);

      expect(result).toBe('LONG_SL');
    });

    it('should return LONG_TP when long take profit is missing', async () => {
      const orderStatus = {
        longStopLossExists: true,
        longTakeProfitExists: false,
        shortStopLossExists: true,
        shortTakeProfitExists: true,
      };

      const result = await monitor.detectTrigger(mockPosition, orderStatus);

      expect(result).toBe('LONG_TP');
    });

    it('should return SHORT_SL when short stop loss is missing', async () => {
      const orderStatus = {
        longStopLossExists: true,
        longTakeProfitExists: true,
        shortStopLossExists: false,
        shortTakeProfitExists: true,
      };

      const result = await monitor.detectTrigger(mockPosition, orderStatus);

      expect(result).toBe('SHORT_SL');
    });

    it('should return SHORT_TP when short take profit is missing', async () => {
      const orderStatus = {
        longStopLossExists: true,
        longTakeProfitExists: true,
        shortStopLossExists: true,
        shortTakeProfitExists: false,
      };

      const result = await monitor.detectTrigger(mockPosition, orderStatus);

      expect(result).toBe('SHORT_TP');
    });

    it('should return null when all orders exist', async () => {
      const orderStatus = {
        longStopLossExists: true,
        longTakeProfitExists: true,
        shortStopLossExists: true,
        shortTakeProfitExists: true,
      };

      const result = await monitor.detectTrigger(mockPosition, orderStatus);

      expect(result).toBeNull();
    });
  });

  // ==================== T014: confirmTriggerWithHistory ====================
  describe('T014: confirmTriggerWithHistory() method', () => {
    it('should have confirmTriggerWithHistory() method', () => {
      expect(typeof monitor.confirmTriggerWithHistory).toBe('function');
    });

    it('should return true when order history shows TRIGGERED', async () => {
      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'TRIGGERED',
      });

      const result = await monitor.confirmTriggerWithHistory(
        'binance',
        'user-456',
        'BTCUSDT',
        'long-sl-123',
      );

      expect(result).toBe(true);
    });

    it('should return false when order history shows CANCELED', async () => {
      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'CANCELED',
      });

      const result = await monitor.confirmTriggerWithHistory(
        'binance',
        'user-456',
        'BTCUSDT',
        'long-sl-123',
      );

      expect(result).toBe(false);
    });

    it('should return false when order not found in history', async () => {
      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue(null);

      const result = await monitor.confirmTriggerWithHistory(
        'binance',
        'user-456',
        'BTCUSDT',
        'nonexistent',
      );

      expect(result).toBe(false);
    });
  });

  // ==================== T015: detectBothSidesTriggered ====================
  describe('T015: detectBothSidesTriggered() logic', () => {
    it('should have detectBothSidesTriggered() method', () => {
      expect(typeof monitor.detectBothSidesTriggered).toBe('function');
    });

    it('should return true when both long and short orders are missing', async () => {
      const orderStatus = {
        longStopLossExists: false,
        longTakeProfitExists: true,
        shortStopLossExists: false,
        shortTakeProfitExists: true,
      };

      const result = monitor.detectBothSidesTriggered(orderStatus);

      expect(result).toBe(true);
    });

    it('should return false when only one side is missing', async () => {
      const orderStatus = {
        longStopLossExists: false,
        longTakeProfitExists: true,
        shortStopLossExists: true,
        shortTakeProfitExists: true,
      };

      const result = monitor.detectBothSidesTriggered(orderStatus);

      expect(result).toBe(false);
    });

    it('should return true for LONG_SL + SHORT_TP scenario', async () => {
      const orderStatus = {
        longStopLossExists: false,
        longTakeProfitExists: true,
        shortStopLossExists: true,
        shortTakeProfitExists: false,
      };

      const result = monitor.detectBothSidesTriggered(orderStatus);

      expect(result).toBe(true);
    });

    it('should return true for LONG_TP + SHORT_SL scenario', async () => {
      const orderStatus = {
        longStopLossExists: true,
        longTakeProfitExists: false,
        shortStopLossExists: false,
        shortTakeProfitExists: true,
      };

      const result = monitor.detectBothSidesTriggered(orderStatus);

      expect(result).toBe(true);
    });
  });

  // ==================== T016: 結構化日誌 ====================
  describe('T016: Structured Logging', () => {
    it('should log when monitor starts', async () => {
      const { logger } = await import('@/lib/logger');

      await monitor.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          intervalMs: expect.any(Number),
        }),
        expect.stringContaining('start'),
      );
    });

    it('should log when monitor stops', async () => {
      const { logger } = await import('@/lib/logger');

      await monitor.start();
      await monitor.stop();

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('stop'),
      );
    });

    it('should log when trigger is detected via checkAllPositions', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(logger.info).mockClear();

      // 模擬觸發偵測：long stop loss 不存在
      mockExchangeQueryService.checkOrderExists
        .mockResolvedValueOnce(false)  // longStopLoss - missing
        .mockResolvedValueOnce(true)   // longTakeProfit - exists
        .mockResolvedValueOnce(true)   // shortStopLoss - exists
        .mockResolvedValueOnce(true);  // shortTakeProfit - exists

      // 模擬訂單歷史確認觸發
      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'TRIGGERED',
      });

      // checkAllPositions 會呼叫 checkPositionConditionalOrders 並記錄日誌
      await monitor.checkAllPositions();

      // 檢查是否有包含 trigger 的日誌
      const infoCalls = vi.mocked(logger.info).mock.calls;
      const hasTriggerLog = infoCalls.some(
        (call) =>
          typeof call[1] === 'string' &&
          call[1].toLowerCase().includes('trigger'),
      );

      expect(hasTriggerLog).toBe(true);
    });

    it('should log errors when check fails', async () => {
      const { logger } = await import('@/lib/logger');

      mockPrisma.position.findMany.mockRejectedValue(new Error('DB error'));

      await monitor.checkAllPositions();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==================== 整合測試 ====================
  describe('Integration: Full trigger detection flow', () => {
    it('should detect and report trigger for LONG_SL scenario', async () => {
      // 設置：long stop loss 已觸發
      mockExchangeQueryService.checkOrderExists
        .mockResolvedValueOnce(false) // longStopLoss - triggered
        .mockResolvedValue(true);

      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'TRIGGERED',
        triggerPrice: 94000,
        executedAt: new Date(),
      });

      const result = await monitor.checkPositionConditionalOrders(mockPosition);

      expect(result).toMatchObject({
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
        triggeredExchange: 'binance',
        confirmedByHistory: true,
      });
    });

    it('should handle both sides triggered scenario', async () => {
      // 設置：雙邊都觸發
      mockExchangeQueryService.checkOrderExists
        .mockResolvedValueOnce(false) // longStopLoss - triggered
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false) // shortStopLoss - triggered
        .mockResolvedValue(true);

      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        status: 'TRIGGERED',
      });

      const result = await monitor.checkPositionConditionalOrders(mockPosition);

      expect(result?.triggerType).toBe('BOTH');
    });
  });

  // ==================== Phase 4: US2 自動平倉 ====================

  // ==================== T017: handleTrigger ====================
  describe('T017: handleTrigger() method', () => {
    it('should have handleTrigger() method', () => {
      expect(typeof monitor.handleTrigger).toBe('function');
    });

    it('should accept position and triggerResult parameters', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      // 不應拋出錯誤
      await expect(
        monitor.handleTrigger(mockPosition, triggerResult),
      ).resolves.not.toThrow();
    });

    it('should call closeSingleSide for single-side trigger', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalled();
    });

    it('should not call closeSingleSide for BOTH trigger type', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'BOTH' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      // BOTH 類型不需要平倉另一邊
      expect(mockPositionCloser.closeSingleSide).not.toHaveBeenCalled();
    });
  });

  // ==================== T018: closeSingleSide 調用 ====================
  describe('T018: PositionCloser.closeSingleSide() integration', () => {
    it('should close SHORT side when LONG_SL triggers', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'SHORT',
          closeReason: 'LONG_SL_TRIGGERED',
        }),
      );
    });

    it('should close SHORT side when LONG_TP triggers', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_TP' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-tp-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'SHORT',
          closeReason: 'LONG_TP_TRIGGERED',
        }),
      );
    });

    it('should close LONG side when SHORT_SL triggers', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'SHORT_SL' as const,
        triggeredExchange: 'okx',
        triggeredOrderId: 'short-sl-456',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'LONG',
          closeReason: 'SHORT_SL_TRIGGERED',
        }),
      );
    });

    it('should close LONG side when SHORT_TP triggers', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'SHORT_TP' as const,
        triggeredExchange: 'okx',
        triggeredOrderId: 'short-tp-456',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'LONG',
          closeReason: 'SHORT_TP_TRIGGERED',
        }),
      );
    });
  });

  // ==================== T019: 取消另一邊條件單 ====================
  describe('T019: Cancel other side conditional orders', () => {
    it('should cancel SHORT side orders after LONG trigger', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.cancelSingleSideConditionalOrders).toHaveBeenCalledWith(
        mockPosition,
        'SHORT',
      );
    });

    it('should cancel LONG side orders after SHORT trigger', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'SHORT_SL' as const,
        triggeredExchange: 'okx',
        triggeredOrderId: 'short-sl-456',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(mockPositionCloser.cancelSingleSideConditionalOrders).toHaveBeenCalledWith(
        mockPosition,
        'LONG',
      );
    });
  });

  // ==================== T020: handleBothTriggered ====================
  describe('T020: handleBothTriggered() method', () => {
    it('should have handleBothTriggered() method', () => {
      expect(typeof monitor.handleBothTriggered).toBe('function');
    });

    it('should not call closeSingleSide (both sides already closed)', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'BOTH' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
        otherSideTriggeredExchange: 'okx',
        otherSideTriggeredOrderId: 'short-sl-456',
      };

      await monitor.handleBothTriggered(mockPosition, triggerResult);

      expect(mockPositionCloser.closeSingleSide).not.toHaveBeenCalled();
    });

    it('should update position status to CLOSED', async () => {
      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'BOTH' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleBothTriggered(mockPosition, triggerResult);

      expect(mockPrisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pos-123' },
          data: expect.objectContaining({
            status: 'CLOSED',
            closeReason: 'BOTH_TRIGGERED',
          }),
        }),
      );
    });
  });

  // ==================== T021: 錯誤處理和重試 ====================
  describe('T021: Error handling and retry logic', () => {
    it('should handle closeSingleSide failure gracefully', async () => {
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: false,
        error: 'Exchange API error',
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      // 不應拋出錯誤
      await expect(
        monitor.handleTrigger(mockPosition, triggerResult),
      ).resolves.not.toThrow();
    });

    it('should log error when close fails', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(logger.error).mockClear();

      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: false,
        error: 'Exchange API error',
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should return failure result when close fails', async () => {
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: false,
        error: 'Exchange API error',
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      const result = await monitor.handleTrigger(mockPosition, triggerResult);

      expect(result.success).toBe(false);
    });
  });

  // ==================== T022-T023: Position 狀態更新 ====================
  describe('T022-T023: Position status and closeReason update', () => {
    it('should update closeReason based on trigger type', async () => {
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: true,
        position: { ...mockPosition, status: 'CLOSED' },
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      // closeReason 應該透過 closeSingleSide 傳入
      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalledWith(
        expect.objectContaining({
          closeReason: 'LONG_SL_TRIGGERED',
        }),
      );
    });
  });

  // ==================== T024: Trade 績效記錄 ====================
  describe('T024: Trade performance record', () => {
    it('should create Trade record after successful trigger close', async () => {
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: true,
        position: { ...mockPosition, status: 'CLOSED' },
        closedSide: {
          side: 'SHORT',
          exchange: 'okx',
          orderId: 'close-order-123',
          price: 95050,
          quantity: 0.001,
          fee: 0.1,
        },
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      const result = await monitor.handleTrigger(mockPosition, triggerResult);

      // 成功時應該返回包含 trade 資訊的結果
      expect(result.success).toBe(true);
    });

    it('should not create Trade record when close fails', async () => {
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: false,
        error: 'Close failed',
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      const result = await monitor.handleTrigger(mockPosition, triggerResult);

      expect(result.success).toBe(false);
    });
  });

  // ==================== 整合測試：完整自動平倉流程 ====================
  describe('Integration: Full auto-close flow', () => {
    it('should complete full flow: detect -> close -> cancel orders', async () => {
      // 設置觸發偵測
      mockExchangeQueryService.checkOrderExists
        .mockResolvedValueOnce(false) // longStopLoss - triggered
        .mockResolvedValue(true);

      mockExchangeQueryService.fetchOrderHistory.mockResolvedValue({
        orderId: 'long-sl-123',
        status: 'TRIGGERED',
      });

      // 設置平倉成功
      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: true,
        position: { ...mockPosition, status: 'CLOSED' },
      });

      // 執行完整流程
      await monitor.checkAllPositions();

      // 驗證平倉被呼叫
      expect(mockPositionCloser.closeSingleSide).toHaveBeenCalled();

      // 驗證條件單取消被呼叫
      expect(mockPositionCloser.cancelSingleSideConditionalOrders).toHaveBeenCalled();
    });
  });

  // ==================== T030: 在 handleTrigger() 中整合通知發送 ====================
  describe('T030: Notification integration in handleTrigger', () => {
    it('should have sendTriggerNotifications method', () => {
      expect(typeof monitor.sendTriggerNotifications).toBe('function');
    });

    it('should call sendTriggerNotifications after successful close', async () => {
      // Mock sendTriggerNotifications
      const sendNotificationsSpy = vi.spyOn(monitor, 'sendTriggerNotifications').mockResolvedValue(undefined);

      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: true,
        position: { ...mockPosition, status: 'CLOSED' },
        closedSide: {
          side: 'SHORT',
          exchange: 'okx',
          orderId: 'close-order-123',
          price: 95050,
          quantity: 0.001,
          fee: 0.1,
        },
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(sendNotificationsSpy).toHaveBeenCalled();
    });
  });

  // ==================== T031: 實作平倉失敗時的緊急通知 ====================
  describe('T031: Emergency notification on close failure', () => {
    it('should have sendEmergencyNotifications method', () => {
      expect(typeof monitor.sendEmergencyNotifications).toBe('function');
    });

    it('should call sendEmergencyNotifications when close fails', async () => {
      // Mock sendEmergencyNotifications
      const sendEmergencySpy = vi.spyOn(monitor, 'sendEmergencyNotifications').mockResolvedValue(undefined);

      mockPositionCloser.closeSingleSide.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });

      const triggerResult = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL' as const,
        triggeredExchange: 'binance',
        triggeredOrderId: 'long-sl-123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      await monitor.handleTrigger(mockPosition, triggerResult);

      expect(sendEmergencySpy).toHaveBeenCalled();
    });
  });

  // ==================== T038: WebSocket 事件推送整合 ====================
  describe('T038: WebSocket event integration', () => {
    it('should have emitTriggerDetected method', () => {
      expect(typeof monitor.emitTriggerDetected).toBe('function');
    });

    it('should have emitTriggerCloseProgress method', () => {
      expect(typeof monitor.emitTriggerCloseProgress).toBe('function');
    });

    it('should have emitTriggerCloseSuccess method', () => {
      expect(typeof monitor.emitTriggerCloseSuccess).toBe('function');
    });

    it('should have emitTriggerCloseFailed method', () => {
      expect(typeof monitor.emitTriggerCloseFailed).toBe('function');
    });
  });
});
