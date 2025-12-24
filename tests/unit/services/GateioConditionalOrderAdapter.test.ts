/**
 * GateioConditionalOrderAdapter Unit Tests
 *
 * 測試 Gate.io 條件單適配器，特別是合約數量轉換邏輯
 * Feature: 040-fix-conditional-orders
 *
 * Updated: 使用 Gate.io 原生 Price Order API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { GateioConditionalOrderAdapter } from '../../../src/services/trading/adapters/GateioConditionalOrderAdapter';

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
  describe('contract size conversion with native API', () => {
    let adapter: GateioConditionalOrderAdapter;
    let mockCcxtExchange: any;

    beforeEach(() => {
      mockCcxtExchange = {
        privateFuturesPostSettlePriceOrders: vi.fn().mockResolvedValue({
          id: '12345',
        }),
        privateFuturesDeleteSettlePriceOrdersOrderId: vi.fn().mockResolvedValue({}),
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

      // Assert - 檢查傳給原生 API 的參數
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          settle: 'usdt',
          initial: expect.objectContaining({
            contract: 'BTC_USDT',
            size: -1, // 四捨五入後應為 1，Long 平倉用負數
            reduce_only: true,
          }),
          trigger: expect.objectContaining({
            rule: 2, // Long 停損：價格 <=
          }),
        }),
      );
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
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            size: -1, // 最小值應為 1，Long 平倉用負數
          }),
        }),
      );
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
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            size: -2, // 四捨五入後應為 2，Long 平倉用負數
          }),
        }),
      );
    });

    it('should use negative size for LONG position close', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - Long 平倉應使用負數 size
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            size: -2, // Long 平倉用負數
          }),
        }),
      );
    });

    it('should use positive size for SHORT position close', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'SHORT',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - Short 平倉應使用正數 size
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            size: 2, // Short 平倉用正數
          }),
        }),
      );
    });

    it('should use rule 1 (>=) for take profit on LONG', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setTakeProfitOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('60000'),
      });

      // Assert - Long 停利用 rule 1 (>=)
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            rule: 1, // Long 停利：價格 >=
          }),
        }),
      );
    });

    it('should use rule 2 (<=) for stop loss on LONG', async () => {
      // Arrange
      const quantity = new Decimal('2');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('40000'),
      });

      // Assert - Long 停損用 rule 2 (<=)
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            rule: 2, // Long 停損：價格 <=
          }),
        }),
      );
    });

    it('should convert symbol format correctly', async () => {
      // Arrange
      const quantity = new Decimal('1');

      // Act - 使用非 CCXT 格式的 symbol
      await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - 應該轉換為 Gate.io 格式 BTC_USDT
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            contract: 'BTC_USDT',
          }),
        }),
      );
    });

    it('should include triggerPrice in trigger params', async () => {
      // Arrange
      const quantity = new Decimal('1');
      const triggerPrice = new Decimal('50000');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice,
      });

      // Assert - 應該包含 trigger.price
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            price: '50000',
            strategy_type: 0,
            price_type: 1, // mark price
            expiration: 86400,
          }),
        }),
      );
    });

    it('should use ioc time-in-force for market orders', async () => {
      // Arrange
      const quantity = new Decimal('1');

      // Act
      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert - 市價單應使用 ioc
      expect(mockCcxtExchange.privateFuturesPostSettlePriceOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: expect.objectContaining({
            price: '0', // 市價單
            tif: 'ioc',
          }),
        }),
      );
    });

    it('should return success with orderId on successful creation', async () => {
      // Arrange
      const quantity = new Decimal('1');
      const triggerPrice = new Decimal('50000');

      // Act
      const result = await adapter.setStopLossOrder({
        symbol: 'BTC/USDT:USDT',
        side: 'LONG',
        quantity,
        triggerPrice,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('12345');
      expect(result.triggerPrice).toEqual(triggerPrice);
    });

    it('should return failure on API error', async () => {
      // Arrange
      mockCcxtExchange.privateFuturesPostSettlePriceOrders.mockRejectedValue(
        new Error('INVALID_PARAM: Invalid contract'),
      );
      const quantity = new Decimal('1');

      // Act
      const result = await adapter.setStopLossOrder({
        symbol: 'INVALID',
        side: 'LONG',
        quantity,
        triggerPrice: new Decimal('50000'),
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('cancelConditionalOrder', () => {
    let adapter: GateioConditionalOrderAdapter;
    let mockCcxtExchange: any;

    beforeEach(() => {
      mockCcxtExchange = {
        privateFuturesPostSettlePriceOrders: vi.fn(),
        privateFuturesDeleteSettlePriceOrdersOrderId: vi.fn().mockResolvedValue({}),
      };
      adapter = new GateioConditionalOrderAdapter(mockCcxtExchange);
    });

    it('should call correct cancel API', async () => {
      // Act
      const result = await adapter.cancelConditionalOrder('BTC_USDT', '12345');

      // Assert
      expect(result).toBe(true);
      expect(mockCcxtExchange.privateFuturesDeleteSettlePriceOrdersOrderId).toHaveBeenCalledWith({
        settle: 'usdt',
        order_id: '12345',
      });
    });

    it('should return false on cancel error', async () => {
      // Arrange
      mockCcxtExchange.privateFuturesDeleteSettlePriceOrdersOrderId.mockRejectedValue(
        new Error('Order not found'),
      );

      // Act
      const result = await adapter.cancelConditionalOrder('BTC_USDT', '99999');

      // Assert
      expect(result).toBe(false);
    });
  });
});
