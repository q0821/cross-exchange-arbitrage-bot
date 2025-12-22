/**
 * GateioConditionalOrderAdapter Unit Tests
 *
 * 測試 Gate.io 條件單適配器，特別是合約數量轉換邏輯
 * Feature: 040-fix-conditional-orders
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { GateioConditionalOrderAdapter } from '../../../src/services/trading/adapters/GateioConditionalOrderAdapter';
import { logger } from '../../../src/lib/logger';

// Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock conditional-order-calculator
vi.mock('../../../src/lib/conditional-order-calculator', () => ({
  formatPriceForExchange: (price: Decimal) => price.toString(),
}));

describe('GateioConditionalOrderAdapter', () => {
  describe('contract size conversion', () => {
    let adapter: GateioConditionalOrderAdapter;
    let mockCcxtExchange: any;

    beforeEach(() => {
      mockCcxtExchange = {
        privateFuturesPostSettlePriceOrders: vi.fn().mockResolvedValue({
          id: '12345',
        }),
      };
      adapter = new GateioConditionalOrderAdapter(mockCcxtExchange);
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should round 0.5 to 1 (not truncate to 0)', async () => {
      // Arrange
      const quantity = new Decimal('0.5');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - 檢查傳給 API 的 size 參數
      const callArgs = mockCcxtExchange.privateFuturesPostSettlePriceOrders.mock.calls[0][0];
      // Long 平倉用負數，但絕對值應為 1，不是 0
      expect(Math.abs(callArgs.initial.size)).toBe(1);
    });

    it('should round 0.4 to 1 (minimum contract size)', async () => {
      // Arrange
      const quantity = new Decimal('0.4');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - 應該用最小值 1
      const callArgs = mockCcxtExchange.privateFuturesPostSettlePriceOrders.mock.calls[0][0];
      expect(Math.abs(callArgs.initial.size)).toBe(1);
    });

    it('should round 1.6 to 2', async () => {
      // Arrange
      const quantity = new Decimal('1.6');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - 1.6 四捨五入應為 2
      const callArgs = mockCcxtExchange.privateFuturesPostSettlePriceOrders.mock.calls[0][0];
      expect(Math.abs(callArgs.initial.size)).toBe(2);
    });

    it('should use negative size for LONG position close (sell direction)', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - Long 平倉應使用負數（賣出方向）
      const callArgs = mockCcxtExchange.privateFuturesPostSettlePriceOrders.mock.calls[0][0];
      expect(callArgs.initial.size).toBe(-2);
    });

    it('should use positive size for SHORT position close (buy direction)', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'SHORT',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - Short 平倉應使用正數（買入方向）
      const callArgs = mockCcxtExchange.privateFuturesPostSettlePriceOrders.mock.calls[0][0];
      expect(callArgs.initial.size).toBe(2);
    });
  });
});
