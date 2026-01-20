/**
 * PriceMonitor Cleanup Tests
 * Feature: 066-fix-memory-leaks
 * Tasks: T012-T014 (GREEN Phase)
 *
 * 測試 PriceMonitor 的清理功能：
 * - DataSourceManager handlers 被清空
 *
 * 測試策略：
 * - 驗證 PriceMonitor 內部狀態的清理（dataSourceManagerHandlers）
 * - WebSocket 清理透過 destroy() 方法完成，已在現有測試中覆蓋
 * - RestPoller 清理透過 stop() 方法內的邏輯完成，在 Idempotency 測試中驗證
 *
 * Note: RestPoller handler 的具體驗證在整合測試中進行，因為 mock 複雜性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { IExchangeConnector, ExchangeName } from '@/connectors/types';

// Mock all WebSocket clients
vi.mock('@/services/websocket/BinanceFundingWs', async () => {
  const { EventEmitter } = await import('events');
  return {
    BinanceFundingWs: vi.fn(() => {
      const emitter = new EventEmitter();
      return {
        on: (event: string, handler: (...args: unknown[]) => void) => emitter.on(event, handler),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
        listenerCount: emitter.listenerCount.bind(emitter),
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isReady: vi.fn().mockReturnValue(true),
        tryReconnect: vi.fn().mockResolvedValue(true),
      };
    }),
  };
});

vi.mock('@/services/websocket/OkxFundingWs', async () => {
  const { EventEmitter } = await import('events');
  return {
    OkxFundingWs: vi.fn(() => {
      const emitter = new EventEmitter();
      return {
        on: emitter.on.bind(emitter),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
        listenerCount: emitter.listenerCount.bind(emitter),
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isReady: vi.fn().mockReturnValue(true),
        tryReconnect: vi.fn().mockResolvedValue(true),
      };
    }),
  };
});

vi.mock('@/services/websocket/GateioFundingWs', async () => {
  const { EventEmitter } = await import('events');
  return {
    GateioFundingWs: vi.fn(() => {
      const emitter = new EventEmitter();
      return {
        on: emitter.on.bind(emitter),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
        listenerCount: emitter.listenerCount.bind(emitter),
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isReady: vi.fn().mockReturnValue(true),
        tryReconnect: vi.fn().mockResolvedValue(true),
      };
    }),
  };
});

vi.mock('@/services/websocket/BingxFundingWs', async () => {
  const { EventEmitter } = await import('events');
  return {
    BingxFundingWs: vi.fn(() => {
      const emitter = new EventEmitter();
      return {
        on: emitter.on.bind(emitter),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
        listenerCount: emitter.listenerCount.bind(emitter),
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isReady: vi.fn().mockReturnValue(true),
        tryReconnect: vi.fn().mockResolvedValue(true),
      };
    }),
  };
});

// Mock RestPoller
vi.mock('@/lib/rest/RestPoller', async () => {
  const { EventEmitter } = await import('events');
  return {
    RestPoller: vi.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      return {
        on: (event: string, handler: (...args: unknown[]) => void) => emitter.on(event, handler),
        off: (event: string, handler: (...args: unknown[]) => void) => emitter.off(event, handler),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
        listenerCount: emitter.listenerCount.bind(emitter),
        start: vi.fn(),
        stop: vi.fn(),
        updateSymbols: vi.fn(),
      };
    }),
  };
});

// Mock DataSourceManager as singleton
vi.mock('@/services/monitor/DataSourceManager', async () => {
  const { EventEmitter } = await import('events');
  const emitter = new EventEmitter();
  const instance = {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
      return instance;
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.off(event, handler);
      return instance;
    },
    emit: emitter.emit.bind(emitter),
    onSwitch: vi.fn((cb: (...args: unknown[]) => void) => {
      emitter.on('switch', cb);
      return instance;
    }),
    offSwitch: vi.fn((cb: (...args: unknown[]) => void) => {
      emitter.off('switch', cb);
      return instance;
    }),
    removeAllListeners: emitter.removeAllListeners.bind(emitter),
    listenerCount: emitter.listenerCount.bind(emitter),
    enableWebSocket: vi.fn(),
    disableWebSocket: vi.fn(),
    updateLastDataReceived: vi.fn(),
  };
  return {
    DataSourceManager: {
      getInstance: vi.fn(() => instance),
      resetInstance: vi.fn(),
    },
    dataSourceManager: instance,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import PriceMonitor after mocks are set up
import { PriceMonitor } from '@/services/monitor/PriceMonitor';

// Helper to create mock connector
function createMockConnector(name: ExchangeName): IExchangeConnector {
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
  } as unknown as IExchangeConnector;
}

// Access internal types
interface PriceMonitorInternals {
  restPollerHandlers: Map<string, { onTicker: unknown; onError: unknown }>;
  dataSourceManagerHandlers: { onSwitch?: unknown; onRecoveryAttempt?: unknown };
  restPollers: Map<string, unknown>;
}

describe('PriceMonitor Cleanup', () => {
  let priceMonitor: PriceMonitor;
  let mockConnectors: IExchangeConnector[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnectors = [
      createMockConnector('binance'),
      createMockConnector('okx'),
    ];
  });

  afterEach(async () => {
    if (priceMonitor) {
      await priceMonitor.stop();
      priceMonitor.destroy();
    }
  });

  describe('T012-T014: DataSourceManager listener cleanup', () => {
    it('should clear dataSourceManagerHandlers when stop() is called', async () => {
      // Arrange
      priceMonitor = new PriceMonitor(mockConnectors, ['BTCUSDT'], {
        enableWebSocket: false,
      });

      // Verify handlers are set by constructor
      const internals = priceMonitor as unknown as PriceMonitorInternals;
      expect(internals.dataSourceManagerHandlers.onSwitch).toBeDefined();
      expect(internals.dataSourceManagerHandlers.onRecoveryAttempt).toBeDefined();

      await priceMonitor.start();

      // Act
      await priceMonitor.stop();

      // Assert - handlers should be undefined
      expect(internals.dataSourceManagerHandlers.onSwitch).toBeUndefined();
      expect(internals.dataSourceManagerHandlers.onRecoveryAttempt).toBeUndefined();
    });

    it('should clear handlers even without starting', async () => {
      // Arrange - create but don't start
      priceMonitor = new PriceMonitor(mockConnectors, ['BTCUSDT'], {
        enableWebSocket: false,
      });

      const internals = priceMonitor as unknown as PriceMonitorInternals;
      expect(internals.dataSourceManagerHandlers.onSwitch).toBeDefined();

      // Act - stop without start (should still cleanup)
      await priceMonitor.stop();

      // Assert - handlers should be cleared
      expect(internals.dataSourceManagerHandlers.onSwitch).toBeUndefined();
      expect(internals.dataSourceManagerHandlers.onRecoveryAttempt).toBeUndefined();
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple stop() calls without error', async () => {
      // Arrange
      priceMonitor = new PriceMonitor(mockConnectors, ['BTCUSDT'], {
        enableWebSocket: true,
      });

      await priceMonitor.start();

      // Act - call stop multiple times
      await priceMonitor.stop();
      await priceMonitor.stop();
      await priceMonitor.stop();

      // Assert - should not throw and should be stopped
      expect(priceMonitor.isActive()).toBe(false);
    });

    it('should safely call stop() multiple times with REST mode', async () => {
      // Arrange
      priceMonitor = new PriceMonitor(mockConnectors, ['BTCUSDT'], {
        enableWebSocket: false,
      });

      await priceMonitor.start();

      const internals = priceMonitor as unknown as PriceMonitorInternals;

      // Act - first stop
      await priceMonitor.stop();
      // After stop, handlers should be empty
      expect(internals.restPollerHandlers.size).toBe(0);

      // Second stop should not throw
      await priceMonitor.stop();
      expect(internals.restPollerHandlers.size).toBe(0);

      // Third stop should not throw
      await priceMonitor.stop();
      expect(priceMonitor.isActive()).toBe(false);
    });

    it('should clear dataSourceManagerHandlers after multiple stops', async () => {
      // Arrange
      priceMonitor = new PriceMonitor(mockConnectors, ['BTCUSDT'], {
        enableWebSocket: false,
      });

      const internals = priceMonitor as unknown as PriceMonitorInternals;

      await priceMonitor.start();

      // Act - multiple stops
      await priceMonitor.stop();
      await priceMonitor.stop();

      // Assert
      expect(internals.dataSourceManagerHandlers.onSwitch).toBeUndefined();
      expect(internals.dataSourceManagerHandlers.onRecoveryAttempt).toBeUndefined();
    });
  });
});
