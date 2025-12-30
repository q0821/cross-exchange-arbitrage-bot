/**
 * ConditionalOrderService Unit Tests
 *
 * 測試條件單服務的價格驗證功能
 * Feature: 040-fix-conditional-orders
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import type { ConditionalOrderAdapter } from '../../../src/types/trading';

// Mock logger first (before any imports that use it)
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ConditionalOrderAdapterFactory to avoid CCXT import issues
vi.mock('../../../src/services/trading/ConditionalOrderAdapterFactory', () => ({
  ConditionalOrderAdapterFactory: vi.fn(function() { return {
    getAdapter: vi.fn(),
  }; }),
}));

// Import after mocks are set up
import { ConditionalOrderService } from '../../../src/services/trading/ConditionalOrderService';
import { ConditionalOrderAdapterFactory } from '../../../src/services/trading/ConditionalOrderAdapterFactory';
import { logger } from '../../../src/lib/logger';

// Mock adapter
const createMockAdapter = (): ConditionalOrderAdapter => ({
  setStopLossOrder: vi.fn().mockResolvedValue({ success: true, orderId: 'sl-123' }),
  setTakeProfitOrder: vi.fn().mockResolvedValue({ success: true, orderId: 'tp-123' }),
});

describe('ConditionalOrderService', () => {
  let mockAdapter: ConditionalOrderAdapter;
  let mockFactory: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockAdapter();
    mockFactory = {
      getAdapter: vi.fn().mockResolvedValue(mockAdapter),
    };
    vi.mocked(ConditionalOrderAdapterFactory).mockImplementation(() => mockFactory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Price Validation Warnings', () => {
    describe('Stop Loss Price Validation (T030)', () => {
      it('should log warning when stop loss price may trigger immediately for LONG position', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        // Long 倉位：停損價應低於入場價
        // 如果當前價格已經低於停損價，會立即觸發
        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5, // 停損價 = 47500
          takeProfitEnabled: false,
          userId: 'user-123',
          // 當前價格已低於停損價，可能立即觸發
          longCurrentPrice: new Decimal(47000),
          shortCurrentPrice: new Decimal(50100),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            side: 'LONG',
            stopLossPrice: expect.any(String),
            currentPrice: expect.any(String),
          }),
          expect.stringContaining('may trigger immediately'),
        );
      });

      it('should log warning when stop loss price may trigger immediately for SHORT position', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        // Short 倉位：停損價應高於入場價
        // 如果當前價格已經高於停損價，會立即觸發
        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5, // Short 停損價 = 52605
          takeProfitEnabled: false,
          userId: 'user-123',
          longCurrentPrice: new Decimal(50000),
          // 當前價格已高於停損價，可能立即觸發
          shortCurrentPrice: new Decimal(53000),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            side: 'SHORT',
            stopLossPrice: expect.any(String),
            currentPrice: expect.any(String),
          }),
          expect.stringContaining('may trigger immediately'),
        );
      });

      it('should NOT log warning when stop loss price is valid', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5,
          takeProfitEnabled: false,
          userId: 'user-123',
          // 價格正常，不會立即觸發
          longCurrentPrice: new Decimal(50000),
          shortCurrentPrice: new Decimal(50100),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining('may trigger immediately'),
        );
      });
    });

    describe('Take Profit Price Validation (T031)', () => {
      it('should log warning when take profit price may trigger immediately for LONG position', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        // Long 倉位：停利價應高於入場價
        // 如果當前價格已經高於停利價，會立即觸發
        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: false,
          takeProfitEnabled: true,
          takeProfitPercent: 5, // 停利價 = 52500
          userId: 'user-123',
          // 當前價格已高於停利價，可能立即觸發
          longCurrentPrice: new Decimal(53000),
          shortCurrentPrice: new Decimal(50100),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            side: 'LONG',
            takeProfitPrice: expect.any(String),
            currentPrice: expect.any(String),
          }),
          expect.stringContaining('may trigger immediately'),
        );
      });

      it('should log warning when take profit price may trigger immediately for SHORT position', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        // Short 倉位：停利價應低於入場價
        // 如果當前價格已經低於停利價，會立即觸發
        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: false,
          takeProfitEnabled: true,
          takeProfitPercent: 5, // Short 停利價 = 47595
          userId: 'user-123',
          longCurrentPrice: new Decimal(50000),
          // 當前價格已低於停利價，可能立即觸發
          shortCurrentPrice: new Decimal(47000),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            side: 'SHORT',
            takeProfitPrice: expect.any(String),
            currentPrice: expect.any(String),
          }),
          expect.stringContaining('may trigger immediately'),
        );
      });

      it('should NOT log warning when take profit price is valid', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: false,
          takeProfitEnabled: true,
          takeProfitPercent: 5,
          userId: 'user-123',
          // 價格正常，不會立即觸發
          longCurrentPrice: new Decimal(50000),
          shortCurrentPrice: new Decimal(50100),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining('may trigger immediately'),
        );
      });
    });

    describe('Combined Stop Loss and Take Profit Validation', () => {
      it('should log warnings for both stop loss and take profit when both may trigger immediately', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5,
          takeProfitEnabled: true,
          takeProfitPercent: 5,
          userId: 'user-123',
          // Long: 當前價格低於停損價
          longCurrentPrice: new Decimal(47000),
          // Short: 當前價格高於停損價
          shortCurrentPrice: new Decimal(53000),
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert - 應該有 2 個停損警告（Long 和 Short 各一個）
        const warnCalls = vi.mocked(logger.warn).mock.calls;
        const triggerWarnings = warnCalls.filter(
          ([, msg]) => typeof msg === 'string' && msg.includes('may trigger immediately'),
        );
        expect(triggerWarnings.length).toBeGreaterThanOrEqual(2);
      });

      it('should still proceed with order setting after logging warnings', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5,
          takeProfitEnabled: false,
          userId: 'user-123',
          // 價格會觸發警告
          longCurrentPrice: new Decimal(47000),
          shortCurrentPrice: new Decimal(53000),
        };

        // Act
        const result = await service.setConditionalOrders(params);

        // Assert - 即使有警告，仍應設定條件單
        expect(mockAdapter.setStopLossOrder).toHaveBeenCalled();
        expect(result.overallStatus).toBe('SET');
      });
    });

    describe('Price Validation Without Current Price', () => {
      it('should skip validation when current price is not provided', async () => {
        // Arrange
        const service = new ConditionalOrderService(mockFactory);

        const params = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          longExchange: 'binance' as const,
          longEntryPrice: new Decimal(50000),
          longQuantity: new Decimal(0.1),
          shortExchange: 'okx' as const,
          shortEntryPrice: new Decimal(50100),
          shortQuantity: new Decimal(0.1),
          stopLossEnabled: true,
          stopLossPercent: 5,
          takeProfitEnabled: true,
          takeProfitPercent: 5,
          userId: 'user-123',
          // 不提供 currentPrice
        };

        // Act
        await service.setConditionalOrders(params);

        // Assert - 不應有觸發警告
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining('may trigger immediately'),
        );
        // 但應該仍設定條件單
        expect(mockAdapter.setStopLossOrder).toHaveBeenCalled();
        expect(mockAdapter.setTakeProfitOrder).toHaveBeenCalled();
      });
    });
  });
});
