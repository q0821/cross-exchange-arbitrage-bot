/**
 * ConditionalOrderMonitor Cleanup Tests
 * Feature: 066-fix-memory-leaks
 * Tasks: T011 (RED Phase)
 *
 * 測試 ConditionalOrderMonitor 的清理功能：
 * - _processedByWs Set 在 stop() 時被清空
 * - TriggerDetector 監聯器在 stop() 時被移除
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock CCXT first to avoid starknet initialization error
vi.mock('ccxt', () => ({
  default: {
    binance: vi.fn(),
    okx: vi.fn(),
    gateio: vi.fn(),
    mexc: vi.fn(),
    bingx: vi.fn(),
  },
}));

// Mock exchange query service to avoid CCXT initialization
vi.mock('@/lib/exchange-query-service', () => ({
  ExchangeQueryService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    checkOrderExists: vi.fn().mockResolvedValue(true),
    fetchOrderHistory: vi.fn().mockResolvedValue(null),
    checkPositionExists: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock encryption
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted'),
}));

// Mock pnl calculator
vi.mock('@/lib/pnl-calculator', () => ({
  calculatePnL: vi.fn().mockReturnValue({
    holdingDuration: 3600,
    priceDiffPnL: { toNumber: () => 100 },
    fundingRatePnL: { toNumber: () => 10 },
    totalFees: { toNumber: () => 5 },
    totalPnL: { toNumber: () => 105 },
    roi: { toNumber: () => 0.01 },
  }),
}));

import { ConditionalOrderMonitor } from '@/services/monitor/ConditionalOrderMonitor';
import { PrismaClient } from '@/generated/prisma/client';

// Mock Prisma
const mockPrisma = {
  position: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
  apiKey: {
    findFirst: vi.fn(),
  },
  notificationWebhook: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  trade: {
    create: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock PositionCloser - use class syntax for constructor
vi.mock('@/services/trading/PositionCloser', () => ({
  PositionCloser: class MockPositionCloser {
    closePosition = vi.fn().mockResolvedValue({ success: true });
    closeSingleSide = vi.fn().mockResolvedValue({ success: true });
    cancelSingleSideConditionalOrders = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock Notifiers - use class syntax for constructor
vi.mock('@/services/notification/DiscordNotifier', () => ({
  DiscordNotifier: class MockDiscordNotifier {
    sendTriggerNotification = vi.fn().mockResolvedValue(undefined);
    sendEmergencyNotification = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/services/notification/SlackNotifier', () => ({
  SlackNotifier: class MockSlackNotifier {
    sendTriggerNotification = vi.fn().mockResolvedValue(undefined);
    sendEmergencyNotification = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock TriggerDetector
class MockTriggerDetector extends EventEmitter {
  registerPosition = vi.fn();
  getRegisteredPositions = vi.fn().mockReturnValue([]);
  start = vi.fn();
  stop = vi.fn();
}

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConditionalOrderMonitor Cleanup', () => {
  let monitor: ConditionalOrderMonitor;
  let mockTriggerDetector: MockTriggerDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockTriggerDetector = new MockTriggerDetector();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (monitor) {
      await monitor.stop();
    }
  });

  describe('T011: _processedByWs Set cleanup', () => {
    it('should clear _processedByWs Set when stop() is called', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);

      // Set up parallel mode with TriggerDetector
      monitor.setTriggerDetector(mockTriggerDetector as any);

      // Simulate WebSocket processing some positions
      mockTriggerDetector.emit('triggerDetected', { positionId: 'pos-1' });
      mockTriggerDetector.emit('triggerDetected', { positionId: 'pos-2' });
      mockTriggerDetector.emit('triggerDetected', { positionId: 'pos-3' });

      // Verify items were added (access private property for testing)
      const processedSetBefore = (monitor as any)._processedByWs as Set<string>;
      expect(processedSetBefore.size).toBe(3);

      // Act
      await monitor.stop();

      // Assert - Set should be cleared
      const processedSetAfter = (monitor as any)._processedByWs as Set<string>;
      expect(processedSetAfter.size).toBe(0);
    });

    it('should handle stop() when _processedByWs is already empty', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);

      // Don't add any items

      // Act
      await monitor.stop();

      // Assert - should not throw
      const processedSet = (monitor as any)._processedByWs as Set<string>;
      expect(processedSet.size).toBe(0);
    });

    it('should clear _processedByWs even with large number of items', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);
      monitor.setTriggerDetector(mockTriggerDetector as any);

      // Simulate many positions (like 60,000+ as mentioned in the spec)
      const numItems = 1000; // Using smaller number for test speed
      for (let i = 0; i < numItems; i++) {
        mockTriggerDetector.emit('triggerDetected', { positionId: `pos-${i}` });
      }

      const processedSetBefore = (monitor as any)._processedByWs as Set<string>;
      expect(processedSetBefore.size).toBe(numItems);

      // Act
      await monitor.stop();

      // Assert
      const processedSetAfter = (monitor as any)._processedByWs as Set<string>;
      expect(processedSetAfter.size).toBe(0);
    });
  });

  describe('TriggerDetector listener cleanup', () => {
    it('should remove TriggerDetector listeners when stop() is called', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);
      monitor.setTriggerDetector(mockTriggerDetector as any);

      // Verify listeners were added
      const triggerDetectedListenersBefore = mockTriggerDetector.listenerCount('triggerDetected');
      const closeProgressListenersBefore = mockTriggerDetector.listenerCount('closeProgress');

      expect(triggerDetectedListenersBefore).toBeGreaterThan(0);
      expect(closeProgressListenersBefore).toBeGreaterThan(0);

      // Act
      await monitor.stop();

      // Assert - listeners should be removed
      const triggerDetectedListenersAfter = mockTriggerDetector.listenerCount('triggerDetected');
      const closeProgressListenersAfter = mockTriggerDetector.listenerCount('closeProgress');

      expect(triggerDetectedListenersAfter).toBe(0);
      expect(closeProgressListenersAfter).toBe(0);
    });
  });

  describe('Timer cleanup', () => {
    it('should clear the interval timer when stop() is called', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);
      await monitor.start();

      // Verify timer is set
      const timerBefore = (monitor as any).timer;
      expect(timerBefore).not.toBeNull();

      // Act
      await monitor.stop();

      // Assert - timer should be cleared
      const timerAfter = (monitor as any).timer;
      expect(timerAfter).toBeNull();
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple stop() calls without error', async () => {
      // Arrange
      monitor = new ConditionalOrderMonitor(mockPrisma, 30000);
      monitor.setTriggerDetector(mockTriggerDetector as any);

      // Add some data
      mockTriggerDetector.emit('triggerDetected', { positionId: 'pos-1' });

      await monitor.start();

      // Act - call stop multiple times
      await monitor.stop();
      await monitor.stop();
      await monitor.stop();

      // Assert - should not throw and should be stopped
      expect(monitor.isRunning).toBe(false);
      expect((monitor as any)._processedByWs.size).toBe(0);
    });
  });
});
