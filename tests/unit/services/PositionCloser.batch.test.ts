/**
 * PositionCloser.closeBatchPositions Unit Tests
 *
 * Feature 069: 分單持倉合併顯示與批量平倉
 * Task: T020
 *
 * TDD RED Phase: 這些測試應該先 FAIL，然後實作讓它們 PASS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

// 使用 vi.hoisted 確保 mock 函數在 vi.mock 之前可用
const { mockFnStore, mockServiceStore } = vi.hoisted(() => ({
  mockFnStore: {
    createMarketOrder: vi.fn(),
    fetchOrder: vi.fn(),
    fetchMyTrades: vi.fn(),
    loadMarkets: vi.fn(),
  },
  mockServiceStore: {
    queryBilateralFundingFees: vi.fn(),
    cancelConditionalOrder: vi.fn(),
  },
}));

// 測試中使用的 mock 函數別名
const mockCreateMarketOrder = mockFnStore.createMarketOrder;
const mockFetchOrder = mockFnStore.fetchOrder;
const mockQueryBilateralFundingFees = mockServiceStore.queryBilateralFundingFees;
const mockCancelConditionalOrder = mockServiceStore.cancelConditionalOrder;

// Mock dependencies
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

vi.mock('@/lib/ccxt-markets-cache', () => ({
  loadMarketsWithCache: vi.fn().mockResolvedValue({
    'BTC/USDT:USDT': { id: 'btcusdt', contractSize: 1, symbol: 'BTC/USDT:USDT' },
  }),
  getCachedMarkets: vi.fn().mockReturnValue(null),
  setCachedMarkets: vi.fn(),
  clearCachedMarkets: vi.fn(),
  clearAllCachedMarkets: vi.fn(),
  injectCachedMarkets: vi.fn().mockReturnValue(false),
  cacheMarketsFromExchange: vi.fn(),
}));

vi.mock('@/lib/account-type-cache', () => ({
  getCachedAccountType: vi.fn().mockReturnValue({
    isPortfolioMargin: false,
    isHedgeMode: true,
  }),
  setCachedAccountType: vi.fn(),
  clearCachedAccountType: vi.fn(),
  clearAllAccountTypeCache: vi.fn(),
}));

vi.mock('ccxt', () => {
  class MockExchangeClass {
    createMarketOrder = (...args: unknown[]) => mockFnStore.createMarketOrder(...args);
    fetchOrder = (...args: unknown[]) => mockFnStore.fetchOrder(...args);
    fetchMyTrades = (...args: unknown[]) => mockFnStore.fetchMyTrades(...args);
    loadMarkets = (...args: unknown[]) => mockFnStore.loadMarkets(...args);
    markets = { 'BTC/USDT:USDT': { contractSize: 1 } };
    fapiPrivateGetPositionSideDual = vi.fn().mockResolvedValue({ dualSidePosition: true });
    papiGetUmPositionSideDual = vi.fn();

    constructor(_config?: unknown) {}
  }

  return {
    default: {
      binance: MockExchangeClass,
      okx: MockExchangeClass,
      mexc: MockExchangeClass,
      gateio: MockExchangeClass,
      bingx: MockExchangeClass,
    },
    binance: MockExchangeClass,
    okx: MockExchangeClass,
    mexc: MockExchangeClass,
    gateio: MockExchangeClass,
    bingx: MockExchangeClass,
    gate: MockExchangeClass,
  };
});

// Mock FundingFeeQueryService
vi.mock('@/services/trading/FundingFeeQueryService', () => ({
  FundingFeeQueryService: class MockFundingFeeQueryService {
    queryBilateralFundingFees = (...args: unknown[]) =>
      mockServiceStore.queryBilateralFundingFees(...args);

    constructor(_prisma?: unknown) {}
  },
}));

// Mock ConditionalOrderAdapterFactory
vi.mock('@/services/trading/ConditionalOrderAdapterFactory', () => ({
  ConditionalOrderAdapterFactory: class MockConditionalOrderAdapterFactory {
    getAdapter = vi.fn().mockResolvedValue({
      cancelConditionalOrder: (...args: unknown[]) =>
        mockServiceStore.cancelConditionalOrder(...args),
    });

    constructor(_prisma?: unknown) {}
  },
}));

/**
 * 建立 mock Position 資料
 */
function createMockPosition(overrides: Record<string, unknown> = {}) {
  return {
    id: `pos-${Math.random().toString(36).slice(2, 10)}`,
    userId: 'user-123',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longLeverage: 1,
    shortLeverage: 1,
    longPositionSize: new Decimal(0.1),
    shortPositionSize: new Decimal(0.1),
    longEntryPrice: new Decimal(50000),
    shortEntryPrice: new Decimal(50100),
    longEntryOrderId: 'long-order-1',
    shortEntryOrderId: 'short-order-1',
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    openedAt: new Date(),
    closedAt: null,
    closeReason: null,
    failureReason: null,
    longExitPrice: null,
    shortExitPrice: null,
    longCloseOrderId: null,
    shortCloseOrderId: null,
    stopLossEnabled: false,
    stopLossPercent: null,
    takeProfitEnabled: false,
    takeProfitPercent: null,
    conditionalOrderStatus: 'PENDING',
    conditionalOrderError: null,
    longStopLossPrice: null,
    shortStopLossPrice: null,
    longTakeProfitPrice: null,
    shortTakeProfitPrice: null,
    longStopLossOrderId: null,
    shortStopLossOrderId: null,
    longTakeProfitOrderId: null,
    shortTakeProfitOrderId: null,
    openFundingRateLong: new Decimal(0.0001),
    openFundingRateShort: new Decimal(-0.0001),
    groupId: 'group-abc-123',
    ...overrides,
  };
}

describe('PositionCloser.closeBatchPositions', () => {
  let mockPrisma: any;
  let positionCloser: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // 重設 mock 函數的預設行為
    mockCreateMarketOrder.mockResolvedValue({
      id: 'order-123',
      average: 50050,
      filled: 0.1,
      fee: { cost: 0.5 },
      info: {},
    });
    mockFetchOrder.mockResolvedValue({
      id: 'order-123',
      average: 50050,
    });
    mockQueryBilateralFundingFees.mockResolvedValue({
      longResult: { totalAmount: new Decimal(0), success: true, entries: [] },
      shortResult: { totalAmount: new Decimal(0), success: true, entries: [] },
      totalFundingFee: new Decimal(0),
    });
    mockCancelConditionalOrder.mockResolvedValue(true);

    mockPrisma = {
      position: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      trade: {
        create: vi.fn(),
      },
      apiKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'key-1',
          userId: 'user-123',
          exchange: 'binance',
          isActive: true,
          encryptedKey: 'enc-key',
          encryptedSecret: 'enc-secret',
          encryptedPassphrase: null,
          environment: 'MAINNET',
        }),
      },
    };

    const { PositionCloser } = await import('@/services/trading/PositionCloser');
    positionCloser = new PositionCloser(mockPrisma);
  });

  describe('Method Existence', () => {
    it('should have closeBatchPositions method', () => {
      expect(typeof positionCloser.closeBatchPositions).toBe('function');
    });
  });

  describe('Basic Functionality', () => {
    it('should close all positions in a group successfully', async () => {
      // Arrange
      const groupId = 'group-abc-123';
      const userId = 'user-123';
      const positions = [
        createMockPosition({ id: 'pos-1', groupId }),
        createMockPosition({ id: 'pos-2', groupId }),
        createMockPosition({ id: 'pos-3', groupId }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve(positions.find((p) => p.id === where.id));
      });
      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalPositions).toBe(3);
      expect(result.closedPositions).toBe(3);
      expect(result.failedPositions).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r: any) => r.success)).toBe(true);
    });

    it('should return empty result when no positions found for group', async () => {
      // Arrange
      const groupId = 'group-empty';
      const userId = 'user-123';

      mockPrisma.position.findMany.mockResolvedValue([]);

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalPositions).toBe(0);
      expect(result.closedPositions).toBe(0);
      expect(result.failedPositions).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should only close OPEN positions in the group', async () => {
      // Arrange
      const groupId = 'group-mixed';
      const userId = 'user-123';
      const openPositions = [
        createMockPosition({ id: 'pos-1', groupId, status: 'OPEN' }),
        createMockPosition({ id: 'pos-2', groupId, status: 'OPEN' }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(openPositions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve(openPositions.find((p) => p.id === where.id));
      });
      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        const pos = openPositions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.totalPositions).toBe(2);
      expect(result.closedPositions).toBe(2);

      // Verify findMany was called with correct filter
      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          groupId,
          status: 'OPEN',
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle partial failures and continue closing other positions', async () => {
      // Arrange
      const groupId = 'group-partial-fail';
      const userId = 'user-123';
      const positions = [
        createMockPosition({ id: 'pos-1', groupId }),
        createMockPosition({ id: 'pos-2', groupId }),
        createMockPosition({ id: 'pos-3', groupId }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);

      // pos-2 will fail (already closed)
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'pos-2') {
          return Promise.resolve({ ...positions[1], status: 'CLOSED' });
        }
        return Promise.resolve(positions.find((p) => p.id === where.id));
      });

      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.success).toBe(false); // Partial success
      expect(result.totalPositions).toBe(3);
      expect(result.closedPositions).toBe(2);
      expect(result.failedPositions).toBe(1);
      expect(result.results.filter((r: any) => r.success)).toHaveLength(2);
      expect(result.results.filter((r: any) => !r.success)).toHaveLength(1);
    });

    it('should handle all positions failing', async () => {
      // Arrange
      const groupId = 'group-all-fail';
      const userId = 'user-123';
      const positions = [
        createMockPosition({ id: 'pos-1', groupId }),
        createMockPosition({ id: 'pos-2', groupId }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        // All positions are already closed
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, status: 'CLOSED' });
      });

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.totalPositions).toBe(2);
      expect(result.closedPositions).toBe(0);
      expect(result.failedPositions).toBe(2);
    });
  });

  describe('Close Reason', () => {
    it('should set closeReason to BATCH_CLOSE for all positions', async () => {
      // Arrange
      const groupId = 'group-batch';
      const userId = 'user-123';
      const positions = [
        createMockPosition({ id: 'pos-1', groupId }),
        createMockPosition({ id: 'pos-2', groupId }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve(positions.find((p) => p.id === where.id));
      });

      const updateCalls: any[] = [];
      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        updateCalls.push({ where, data });
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      // Act
      await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert - check that closeReason was set correctly
      const closedUpdates = updateCalls.filter((c) => c.data.status === 'CLOSED');
      expect(closedUpdates.length).toBeGreaterThan(0);
      closedUpdates.forEach((update) => {
        expect(update.data.closeReason).toBe('BATCH_CLOSE');
      });
    });
  });

  describe('Progress Callback', () => {
    it('should call onProgress callback for each position', async () => {
      // Arrange
      const groupId = 'group-progress';
      const userId = 'user-123';
      const positions = [
        createMockPosition({ id: 'pos-1', groupId }),
        createMockPosition({ id: 'pos-2', groupId }),
        createMockPosition({ id: 'pos-3', groupId }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve(positions.find((p) => p.id === where.id));
      });
      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      const onProgress = vi.fn();

      // Act
      await positionCloser.closeBatchPositions({
        userId,
        groupId,
        onProgress,
      });

      // Assert
      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          current: 1,
          total: 3,
          positionId: 'pos-1',
        })
      );
      expect(onProgress).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          current: 2,
          total: 3,
          positionId: 'pos-2',
        })
      );
      expect(onProgress).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          current: 3,
          total: 3,
          positionId: 'pos-3',
        })
      );
    });
  });

  describe('Conditional Order Cancellation', () => {
    it('should cancel all conditional orders for all positions in the group', async () => {
      // Arrange
      const groupId = 'group-with-sl-tp';
      const userId = 'user-123';
      const positions = [
        createMockPosition({
          id: 'pos-1',
          groupId,
          stopLossEnabled: true,
          longStopLossOrderId: 'sl-order-1',
          takeProfitEnabled: true,
          longTakeProfitOrderId: 'tp-order-1',
        }),
        createMockPosition({
          id: 'pos-2',
          groupId,
          stopLossEnabled: true,
          shortStopLossOrderId: 'sl-order-2',
        }),
      ];

      mockPrisma.position.findMany.mockResolvedValue(positions);
      mockPrisma.position.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve(positions.find((p) => p.id === where.id));
      });
      mockPrisma.position.update.mockImplementation(({ where, data }: any) => {
        const pos = positions.find((p) => p.id === where.id);
        return Promise.resolve({ ...pos, ...data });
      });
      mockPrisma.trade.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: `trade-${data.positionId}`,
          ...data,
        });
      });

      // Act
      const result = await positionCloser.closeBatchPositions({
        userId,
        groupId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.closedPositions).toBe(2);
      // Conditional orders should be cancelled as part of closePosition
      // We verify this through the mock function being called
      expect(mockCancelConditionalOrder).toHaveBeenCalled();
    });
  });
});
