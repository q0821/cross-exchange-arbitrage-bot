/**
 * Test: BinanceConditionalOrderAdapter
 *
 * Binance 條件單適配器單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { BinanceConditionalOrderAdapter } from '@/services/trading/adapters/BinanceConditionalOrderAdapter';

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

describe('BinanceConditionalOrderAdapter', () => {
  let adapter: BinanceConditionalOrderAdapter;
  let mockCcxtExchange: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCcxtExchange = {
      loadMarkets: vi.fn().mockResolvedValue({}),
      createOrder: vi.fn(),
      fapiPrivateDeleteOrder: vi.fn(),
      papiDeleteUmConditionalOrder: vi.fn(),
      markets: {
        'BTC/USDT:USDT': { contractSize: 1 },
        'ETH/USDT:USDT': { contractSize: 1 },
        'SOL/USDT:USDT': { contractSize: 1 },
      },
    };

    adapter = new BinanceConditionalOrderAdapter(mockCcxtExchange);
  });

  describe('Constructor', () => {
    it('should create adapter with default options', () => {
      const newAdapter = new BinanceConditionalOrderAdapter(mockCcxtExchange);
      expect(newAdapter.exchangeName).toBe('binance');
    });

    it('should create adapter with custom options', () => {
      const newAdapter = new BinanceConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
        isPortfolioMargin: true,
      });
      expect(newAdapter.exchangeName).toBe('binance');
    });
  });

  describe('setStopLossOrder', () => {
    it('should create stop loss order for LONG position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-123' });

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-123');
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'stop_market',
        'sell', // LONG position closes with SELL
        0.1,
        undefined,
        expect.objectContaining({
          stopPrice: '95000.00',
          workingType: 'MARK_PRICE',
          positionSide: 'LONG',
        }),
      );
    });

    it('should create stop loss order for SHORT position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-456' });

      const result = await adapter.setStopLossOrder({
        symbol: 'ETHUSDT',
        side: 'SHORT',
        quantity: new Decimal(1),
        triggerPrice: new Decimal(4000),
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-456');
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'ETHUSDT',
        'stop_market',
        'buy', // SHORT position closes with BUY
        1,
        undefined,
        expect.objectContaining({
          positionSide: 'SHORT',
        }),
      );
    });

    it('should return error on API failure', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('API error'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('setTakeProfitOrder', () => {
    it('should create take profit order for LONG position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'tp-order-123' });

      const result = await adapter.setTakeProfitOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(105000),
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('tp-order-123');
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'take_profit_market',
        'sell',
        0.1,
        undefined,
        expect.objectContaining({
          stopPrice: '105000.00',
        }),
      );
    });

    it('should create take profit order for SHORT position', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'tp-order-456' });

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

    it('should return error on API failure', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('Network error'));

      const result = await adapter.setTakeProfitOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(105000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('cancelConditionalOrder', () => {
    it('should cancel order using standard API', async () => {
      mockCcxtExchange.fapiPrivateDeleteOrder.mockResolvedValue({});

      const result = await adapter.cancelConditionalOrder('BTCUSDT', 'order-123');

      expect(result).toBe(true);
      expect(mockCcxtExchange.fapiPrivateDeleteOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        orderId: 'order-123',
      });
    });

    it('should cancel order using Portfolio Margin API', async () => {
      const pmAdapter = new BinanceConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: true,
        isPortfolioMargin: true,
      });
      mockCcxtExchange.papiDeleteUmConditionalOrder.mockResolvedValue({});

      const result = await pmAdapter.cancelConditionalOrder('BTCUSDT', 'strategy-123');

      expect(result).toBe(true);
      expect(mockCcxtExchange.papiDeleteUmConditionalOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        strategyId: 'strategy-123',
      });
    });

    it('should return false on cancel failure', async () => {
      mockCcxtExchange.fapiPrivateDeleteOrder.mockRejectedValue(new Error('Cancel failed'));

      const result = await adapter.cancelConditionalOrder('BTCUSDT', 'order-123');

      expect(result).toBe(false);
    });
  });

  describe('Symbol Conversion', () => {
    it('should convert BTCUSDT symbol correctly', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-1' });

      await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        undefined,
        expect.any(Object),
      );
    });

    it('should convert BTC/USDT symbol correctly', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-2' });

      await adapter.setStopLossOrder({
        symbol: 'BTC/USDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('Contract Size Handling', () => {
    it('should convert quantity for non-standard contract size', async () => {
      mockCcxtExchange.markets['SPECIAL/USDT:USDT'] = { contractSize: 10 };
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-special' });

      await adapter.setStopLossOrder({
        symbol: 'SPECIALUSDT',
        side: 'LONG',
        quantity: new Decimal(100),
        triggerPrice: new Decimal(100),
      });

      // 100 / 10 = 10 contracts
      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        10,
        undefined,
        expect.any(Object),
      );
    });

    it('should not convert quantity when contractSize is 1', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-btc' });

      await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(mockCcxtExchange.createOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        0.1,
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('Error Parsing', () => {
    it('should parse position mode mismatch error (-4061)', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('Binance error -4061'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position mode mismatch');
    });

    it('should parse immediate trigger error (-2021)', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('Error code -2021'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('would trigger immediately');
    });

    it('should parse invalid order type error (-4015)', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('Error -4015'));

      const result = await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid order type');
    });

    it('should parse invalid symbol error (-1121)', async () => {
      mockCcxtExchange.createOrder.mockRejectedValue(new Error('Error -1121'));

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

  describe('One-Way Mode (non-Hedge Mode)', () => {
    it('should use reduceOnly in one-way mode', async () => {
      const oneWayAdapter = new BinanceConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
        isPortfolioMargin: false,
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
      const oneWayAdapter = new BinanceConditionalOrderAdapter(mockCcxtExchange, {
        isHedgeMode: false,
        isPortfolioMargin: false,
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

  describe('Markets Loading', () => {
    it('should load markets on first order', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-1' });

      await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      expect(mockCcxtExchange.loadMarkets).toHaveBeenCalledTimes(1);
    });

    it('should not reload markets on subsequent orders', async () => {
      mockCcxtExchange.createOrder.mockResolvedValue({ id: 'order-1' });

      await adapter.setStopLossOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(95000),
      });

      await adapter.setTakeProfitOrder({
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: new Decimal(0.1),
        triggerPrice: new Decimal(105000),
      });

      expect(mockCcxtExchange.loadMarkets).toHaveBeenCalledTimes(1);
    });
  });
});
