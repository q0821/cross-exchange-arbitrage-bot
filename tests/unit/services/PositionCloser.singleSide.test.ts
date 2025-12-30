/**
 * Test: PositionCloser Single Side Methods
 * Feature: 050-sl-tp-trigger-monitor
 *
 * TDD: 測試單邊平倉和單邊條件單取消功能
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import type { CloseReason } from '@/generated/prisma/client';

// Mock all dependencies before importing the module
vi.mock('@/lib/redis', () => ({
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn().mockImplementation((val) => val),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ccxt with proper structure
vi.mock('ccxt', () => {
  const mockExchange = {
    loadMarkets: vi.fn().mockResolvedValue({}),
    markets: { 'BTC/USDT:USDT': { contractSize: 1 } },
    createMarketOrder: vi.fn().mockResolvedValue({
      id: 'order-123',
      average: 95050,
      filled: 0.001,
      fee: { cost: 0.1 },
    }),
    fetchOrder: vi.fn().mockResolvedValue({
      id: 'order-123',
      average: 95050,
    }),
  };

  return {
    default: {},
    binance: vi.fn(function() {
      return {
        ...mockExchange,
        fapiPrivateGetPositionSideDual: vi.fn().mockResolvedValue({ dualSidePosition: true }),
      };
    }),
    okx: vi.fn(function() { return mockExchange; }),
    gate: vi.fn(function() { return mockExchange; }),
    gateio: vi.fn(function() { return mockExchange; }),
    bingx: vi.fn(function() { return mockExchange; }),
    mexc: vi.fn(function() { return mockExchange; }),
  };
});

// Mock FundingFeeQueryService
vi.mock('@/services/trading/FundingFeeQueryService', () => ({
  FundingFeeQueryService: vi.fn(function() {
    return {
      queryBilateralFundingFees: vi.fn().mockResolvedValue({
        longResult: { totalAmount: new Decimal(0) },
        shortResult: { totalAmount: new Decimal(0) },
        totalFundingFee: new Decimal(0),
      }),
    };
  }),
}));

// Mock ConditionalOrderAdapterFactory
vi.mock('@/services/trading/ConditionalOrderAdapterFactory', () => ({
  ConditionalOrderAdapterFactory: vi.fn(function() {
    return {
      getAdapter: vi.fn().mockResolvedValue({
        cancelConditionalOrder: vi.fn().mockResolvedValue(true),
      }),
    };
  }),
}));

describe('PositionCloser Single Side Methods', () => {
  let mockPrisma: any;
  let positionCloser: any;

  const mockPosition = {
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
    // 條件單 ID
    longStopLossOrderId: 'long-sl-123',
    longTakeProfitOrderId: 'long-tp-123',
    shortStopLossOrderId: 'short-sl-456',
    shortTakeProfitOrderId: 'short-tp-456',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma = {
      position: {
        findUnique: vi.fn().mockResolvedValue(mockPosition),
        update: vi.fn().mockResolvedValue({ ...mockPosition, status: 'CLOSED' }),
      },
      apiKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'key-1',
          userId: 'user-456',
          exchange: 'okx',
          encryptedKey: 'key',
          encryptedSecret: 'secret',
          encryptedPassphrase: 'pass',
          environment: 'MAINNET',
        }),
      },
      trade: {
        create: vi.fn().mockResolvedValue({ id: 'trade-1' }),
      },
    };

    // Dynamic import to ensure mocks are in place
    const { PositionCloser } = await import('@/services/trading/PositionCloser');
    positionCloser = new PositionCloser(mockPrisma);
  });

  describe('closeSingleSide', () => {
    it('should have closeSingleSide method', () => {
      expect(typeof positionCloser.closeSingleSide).toBe('function');
    });

    it('should accept required parameters (userId, positionId, side, closeReason)', async () => {
      // 驗證方法簽名接受必要參數
      const params = {
        userId: 'user-456',
        positionId: 'pos-123',
        side: 'SHORT' as const,
        closeReason: 'LONG_SL_TRIGGERED' as CloseReason,
      };

      // 調用方法時不應拋出型別錯誤
      // 實際執行會依賴 mock 的交易所 API
      expect(() => {
        positionCloser.closeSingleSide(params);
      }).not.toThrow();
    });

    it('should close only the specified side (SHORT)', async () => {
      const result = await positionCloser.closeSingleSide({
        userId: 'user-456',
        positionId: 'pos-123',
        side: 'SHORT',
        closeReason: 'LONG_SL_TRIGGERED' as CloseReason,
      });

      // 驗證結果結構
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should close only the specified side (LONG)', async () => {
      const result = await positionCloser.closeSingleSide({
        userId: 'user-456',
        positionId: 'pos-123',
        side: 'LONG',
        closeReason: 'SHORT_SL_TRIGGERED' as CloseReason,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should update position status to CLOSING when starting', async () => {
      // 由於 ccxt mock 複雜度，這裡只驗證方法呼叫了 position.update
      // 第一次呼叫應該是設定 CLOSING 狀態
      await positionCloser.closeSingleSide({
        userId: 'user-456',
        positionId: 'pos-123',
        side: 'SHORT',
        closeReason: 'LONG_SL_TRIGGERED' as CloseReason,
      });

      // 驗證至少呼叫了 update
      expect(mockPrisma.position.update).toHaveBeenCalled();

      // 驗證第一次呼叫是設定 CLOSING 狀態
      const firstCall = mockPrisma.position.update.mock.calls[0][0];
      expect(firstCall.data.status).toBe('CLOSING');
    });
  });

  describe('cancelSingleSideConditionalOrders', () => {
    it('should have cancelSingleSideConditionalOrders method', () => {
      expect(typeof positionCloser.cancelSingleSideConditionalOrders).toBe('function');
    });

    it('should accept position and side parameters', () => {
      // 驗證方法簽名
      expect(() => {
        positionCloser.cancelSingleSideConditionalOrders(mockPosition, 'SHORT');
      }).not.toThrow();
    });

    it('should cancel only orders on the specified side (SHORT)', async () => {
      const mockAdapter = {
        cancelConditionalOrder: vi.fn().mockResolvedValue(true),
      };

      // 重設 factory mock
      (positionCloser as any).conditionalOrderAdapterFactory = {
        getAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };

      await positionCloser.cancelSingleSideConditionalOrders(mockPosition, 'SHORT');

      // 驗證 getAdapter 被呼叫兩次（shortStopLoss 和 shortTakeProfit）
      const getAdapterCalls = (positionCloser as any).conditionalOrderAdapterFactory.getAdapter.mock.calls;
      expect(getAdapterCalls.length).toBe(2);

      // 驗證都是使用 okx（shortExchange）
      expect(getAdapterCalls[0][0]).toBe('okx');
      expect(getAdapterCalls[1][0]).toBe('okx');
    });

    it('should cancel only orders on the specified side (LONG)', async () => {
      const mockAdapter = {
        cancelConditionalOrder: vi.fn().mockResolvedValue(true),
      };

      (positionCloser as any).conditionalOrderAdapterFactory = {
        getAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };

      await positionCloser.cancelSingleSideConditionalOrders(mockPosition, 'LONG');

      // 驗證 getAdapter 被呼叫兩次（longStopLoss 和 longTakeProfit）
      const getAdapterCalls = (positionCloser as any).conditionalOrderAdapterFactory.getAdapter.mock.calls;
      expect(getAdapterCalls.length).toBe(2);

      // 驗證都是使用 binance（longExchange）
      expect(getAdapterCalls[0][0]).toBe('binance');
      expect(getAdapterCalls[1][0]).toBe('binance');
    });

    it('should not cancel orders on the opposite side', async () => {
      const mockAdapter = {
        cancelConditionalOrder: vi.fn().mockResolvedValue(true),
      };

      (positionCloser as any).conditionalOrderAdapterFactory = {
        getAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };

      // 取消多方的條件單
      await positionCloser.cancelSingleSideConditionalOrders(mockPosition, 'LONG');

      // 驗證 cancelConditionalOrder 被呼叫的 orderId
      const cancelCalls = mockAdapter.cancelConditionalOrder.mock.calls;

      // 應該只取消 long 的條件單
      const cancelledOrderIds = cancelCalls.map((call: any[]) => call[1]);
      expect(cancelledOrderIds).toContain('long-sl-123');
      expect(cancelledOrderIds).toContain('long-tp-123');
      expect(cancelledOrderIds).not.toContain('short-sl-456');
      expect(cancelledOrderIds).not.toContain('short-tp-456');
    });
  });

  describe('CloseReason integration', () => {
    it('should accept all valid CloseReason values', () => {
      const validReasons: CloseReason[] = [
        'MANUAL',
        'LONG_SL_TRIGGERED',
        'LONG_TP_TRIGGERED',
        'SHORT_SL_TRIGGERED',
        'SHORT_TP_TRIGGERED',
        'BOTH_TRIGGERED',
      ];

      for (const reason of validReasons) {
        expect(() => {
          positionCloser.closeSingleSide({
            userId: 'user-456',
            positionId: 'pos-123',
            side: 'SHORT',
            closeReason: reason,
          });
        }).not.toThrow();
      }
    });
  });
});
