/**
 * Test: MexcConditionalOrderAdapter
 *
 * MEXC 條件單適配器單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { MexcConditionalOrderAdapter } from '@/services/trading/adapters/MexcConditionalOrderAdapter';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock conditional order calculator
vi.mock('@/lib/conditional-order-calculator', () => ({
  formatPriceForExchange: vi.fn((price: Decimal) => price.toFixed(2)),
}));

describe('MexcConditionalOrderAdapter', () => {
  let adapter: MexcConditionalOrderAdapter;
  let mockCcxtExchange: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCcxtExchange = {
      loadMarkets: vi.fn().mockResolvedValue({}),
      createOrder: vi.fn(),
      cancelOrder: vi.fn(),
      markets: {
        'BTC/USDT:USDT': { contractSize: 1 },
        'ETH/USDT:USDT': { contractSize: 1 },
      },
    };

    adapter = new MexcConditionalOrderAdapter(mockCcxtExchange);
  });

  describe('Constructor', () => {
    it('should create adapter with default options', () => {
      const newAdapter = new MexcConditionalOrderAdapter(mockCcxtExchange);
      expect(newAdapter.exchangeName).toBe('mexc');
    });

    it('should create adapter with custom options', () => {
      const newAdapter = new MexcConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
      });
      expect(newAdapter.exchangeName).toBe('mexc');
    });
  });

  describe('setStopLossOrder', () => {
    it('should create stop loss order for LONG position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'mexc-sl-123' });

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('mexc-sl-123');
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'stop_market',
        'sell',
        0.1,
        undefined,
        expect.objectContaining({
          stopPrice: '95000.00',
          positionSide: 'LONG',
        }),
      );
    });

    it('should create stop loss order for SHORT position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'mexc-sl-456' });

      const result = await adapter.setStopLossOrder({
        symbol: 'ETHUSDT',
        side: 'SHORT',
        quantity: new Decimal(1),
        triggerPrice: new Decimal(4000),
      });

      expect(result.success).toBe(true);
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'ETHUSDT',
        'stop_market',
        'buy',
        1,
        undefined,
        expect.objectContaining({
          positionSide: 'SHORT',
        }),
      );
    });

    it('should return error on API failure', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('MEXC API error'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('MEXC API error');
    });
  });

  describe('setTakeProfitOrder', () => {
    it('should create take profit order for LONG position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'mexc-tp-123' });

      const result = await adapter.setTakeProfitOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(105000),
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('mexc-tp-123');
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'take_profit_market',
        'sell',
        0.1,
        undefined,
        expect.any(Object),
      );
    });

    it('should create take profit order for SHORT position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'mexc-tp-456' });

      const result = await adapter.setTakeProfitOrder({
        symbol: 'ETHUSDT',
        side: 'SHORT',
        quantity: new Decimal(1),
        triggerPrice: new Decimal(3500),
      });

      expect(result.success).toBe(true);
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'ETHUSDT',
        'take_profit_market',
        'buy',
        1,
        undefined,
        expect.objectContaining({
          positionSide: 'SHORT',
        }),
      );
    });
  });

  describe('cancelConditionalOrder', () => {
    it('should cancel order successfully', async () => {
      mockCcxtExchange.cancelOrder.mockResolvedValue({});

      const result = await adapter.cancelConditionalOrder('BTCUSDT', 'order-123');

      expect(result).toBe(true);
      expect(mockCcxtExchange.cancelOrder).toHaveBeenCalledWith('order-123', 'BTCUSDT');
    });

    it('should return false on cancel failure', async () => {
      mockCcxtExchange.cancelOrder.mockRejectedValue(new Error('Cancel failed'));

      const result = await adapter.cancelConditionalOrder('BTCUSDT', 'order-123');

      expect(result).toBe(false);
    });
  });

  describe('Error Parsing', () => {
    it('should parse position mode mismatch error', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('POSITION_SIDE_NOT_MATCH'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position mode mismatch');
    });

    it('should parse immediate trigger error', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('ORDER_WOULD_TRIGGER_IMMEDIATELY'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('would trigger immediately');
    });

    it('should parse symbol not found error', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('SYMBOL_NOT_FOUND'));

      const result = await adapter.setStopLossOrder({
        symbol: 'INVALIDUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(100),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid symbol');
    });

    it('should handle unknown error', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue('Non-Error object');

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('One-Way Mode', () => {
    it('should use reduceOnly in one-way mode', async () => {
      const oneWayAdapter = new MexcConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
      });
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-oneway' });

      await oneWayAdapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        undefined,
        expect.objectContaining({
          reduceOnly: true,
        }),
      );
    });

    it('should not include positionSide in one-way mode', async () => {
      const oneWayAdapter = new MexcConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
      });
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-oneway' });

      await oneWayAdapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      const callArgs = mockCcxtExchange.createOrder.mock.calls[0][5];
      expect(callArgs).not.toHaveProperty('positionSide');
    });
  });

  describe('Contract Size Handling', () => {
    it('should convert quantity for non-standard contract size', async () => {
      mockCcxtExchange.markets['SPECIAL/USDT:USDT'] = { contractSize: 5 };
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-special' });

      await adapter.setStopLossOrder({
        symbol: 'SPECIALUSDT',
        side: 'LONG',
        quantity: new Decimal(50),
        triggerPrice: new Decimal(100),
      });

      // 50 / 5 = 10 contracts
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        10,
        undefined,
        expect.any(Object),
      );
    });
  });
});
