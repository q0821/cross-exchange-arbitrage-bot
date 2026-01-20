/**
 * FundingRateMonitor Cleanup Tests
 * Feature: 066-fix-memory-leaks
 * Tasks: T010 (RED Phase)
 *
 * 測試 FundingRateMonitor 的清理功能：
 * - PriceMonitor 事件監聽器在 stop() 時被移除
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { FundingRateMonitor } from '@/services/monitor/FundingRateMonitor';

// Mock dependencies
vi.mock('@/connectors/factory', () => ({
  createExchange: vi.fn().mockImplementation((name) => {
    const emitter = new EventEmitter();
    return {
      name,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getPrice: vi.fn().mockResolvedValue({ price: 50000, timestamp: new Date() }),
      getFundingRate: vi.fn().mockResolvedValue({
        exchange: name,
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(),
        recordedAt: new Date(),
      }),
      subscribeWS: vi.fn().mockResolvedValue(undefined),
      unsubscribeWS: vi.fn().mockResolvedValue(undefined),
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      emit: emitter.emit.bind(emitter),
      listenerCount: emitter.listenerCount.bind(emitter),
    };
  }),
}));

// Mock PriceMonitor with EventEmitter capabilities using class syntax
vi.mock('@/services/monitor/PriceMonitor', () => {
  return {
    PriceMonitor: class MockPriceMonitor {
      private _emitter = new EventEmitter();

      on = (event: string, handler: (...args: unknown[]) => void) => {
        this._emitter.on(event, handler);
        return this;
      };
      off = (event: string, handler: (...args: unknown[]) => void) => {
        this._emitter.off(event, handler);
        return this;
      };
      emit = (event: string, ...args: unknown[]) => {
        return this._emitter.emit(event, ...args);
      };
      removeAllListeners = (event?: string) => {
        this._emitter.removeAllListeners(event);
        return this;
      };
      listenerCount = (event: string) => {
        return this._emitter.listenerCount(event);
      };
      start = vi.fn().mockResolvedValue(undefined);
      stop = vi.fn().mockResolvedValue(undefined);
      destroy = vi.fn();
      getPrice = vi.fn().mockReturnValue(null);

      // Expose for testing
      get emitter() {
        return this._emitter;
      }
    },
  };
});

vi.mock('@/services/monitor/RatesCache', () => ({
  ratesCache: {
    markStart: vi.fn(),
    set: vi.fn(),
    setAll: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/exchanges/constants', () => ({
  isSymbolSupported: vi.fn().mockReturnValue(true),
  ACTIVE_EXCHANGES: ['binance', 'okx'],
}));

describe('FundingRateMonitor Cleanup', () => {
  let fundingRateMonitor: FundingRateMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (fundingRateMonitor) {
      await fundingRateMonitor.stop();
    }
  });

  describe('T010: PriceMonitor listener cleanup', () => {
    it('should remove all PriceMonitor event listeners when stop() is called', async () => {
      // Arrange
      fundingRateMonitor = new FundingRateMonitor(
        ['BTCUSDT'],
        5000,
        0.005,
        false,
        {
          enablePriceMonitor: true,
          exchanges: ['binance', 'okx'],
        }
      );

      // Access the internal priceMonitor instance
      const priceMonitorInstance = (fundingRateMonitor as unknown as { priceMonitor: { listenerCount: (event: string) => number } }).priceMonitor;

      expect(priceMonitorInstance).toBeDefined();

      // Verify listeners were added (price and error events)
      const priceListenersBefore = priceMonitorInstance.listenerCount('price');
      const errorListenersBefore = priceMonitorInstance.listenerCount('error');

      expect(priceListenersBefore).toBeGreaterThan(0);
      expect(errorListenersBefore).toBeGreaterThan(0);

      await fundingRateMonitor.start();

      // Act
      await fundingRateMonitor.stop();

      // Assert - listeners should be removed
      const priceListenersAfter = priceMonitorInstance.listenerCount('price');
      const errorListenersAfter = priceMonitorInstance.listenerCount('error');

      expect(priceListenersAfter).toBe(0);
      expect(errorListenersAfter).toBe(0);
    });

    it('should call PriceMonitor.stop() when stopping', async () => {
      // Arrange
      fundingRateMonitor = new FundingRateMonitor(
        ['BTCUSDT'],
        5000,
        0.005,
        false,
        {
          enablePriceMonitor: true,
          exchanges: ['binance', 'okx'],
        }
      );

      // Access the internal priceMonitor instance
      const priceMonitorInstance = (fundingRateMonitor as unknown as { priceMonitor: { stop: ReturnType<typeof vi.fn> } }).priceMonitor;

      await fundingRateMonitor.start();

      // Act
      await fundingRateMonitor.stop();

      // Assert
      expect(priceMonitorInstance.stop).toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple stop() calls without error', async () => {
      // Arrange
      fundingRateMonitor = new FundingRateMonitor(
        ['BTCUSDT'],
        5000,
        0.005,
        false,
        {
          enablePriceMonitor: true,
          exchanges: ['binance', 'okx'],
        }
      );

      await fundingRateMonitor.start();

      // Act - call stop multiple times
      await fundingRateMonitor.stop();
      await fundingRateMonitor.stop();
      await fundingRateMonitor.stop();

      // Assert - should not throw
      expect(fundingRateMonitor.getStatus().isRunning).toBe(false);
    });

    it('should work when PriceMonitor is disabled', async () => {
      // Arrange
      fundingRateMonitor = new FundingRateMonitor(
        ['BTCUSDT'],
        5000,
        0.005,
        false,
        {
          enablePriceMonitor: false,
          exchanges: ['binance', 'okx'],
        }
      );

      await fundingRateMonitor.start();

      // Act
      await fundingRateMonitor.stop();

      // Assert - should not throw
      expect(fundingRateMonitor.getStatus().isRunning).toBe(false);
    });
  });
});
