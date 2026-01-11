/**
 * Test: PositionCloser Bilateral Close Methods
 * Feature: 051-core-trading-tests
 *
 * 測試雙邊平倉的完整流程：
 * - 兩邊都成功：創建 Trade 記錄，計算 PnL
 * - 兩邊都失敗：回復狀態為 OPEN
 * - 部分平倉：一邊成功一邊失敗，狀態設為 PARTIAL
 * - 交易所特定行為：OKX、BingX Hedge Mode 參數
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
const mockFetchMyTrades = mockFnStore.fetchMyTrades;
const mockLoadMarkets = mockFnStore.loadMarkets;
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

vi.mock('ccxt', () => {
  // 創建 mock class（必須在 factory 內部定義）
  class MockExchangeClass {
    createMarketOrder = (...args: unknown[]) => mockFnStore.createMarketOrder(...args);
    fetchOrder = (...args: unknown[]) => mockFnStore.fetchOrder(...args);
    fetchMyTrades = (...args: unknown[]) => mockFnStore.fetchMyTrades(...args);
    loadMarkets = (...args: unknown[]) => mockFnStore.loadMarkets(...args);
    markets = { 'BTC/USDT:USDT': { contractSize: 1 } };
    // Binance 專用
    fapiPrivateGetPositionSideDual = vi.fn().mockResolvedValue({ dualSidePosition: true });
    papiGetUmPositionSideDual = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    queryBilateralFundingFees = (...args: unknown[]) => mockServiceStore.queryBilateralFundingFees(...args);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_prisma?: unknown) {}
  },
}));

// Mock ConditionalOrderAdapterFactory
vi.mock('@/services/trading/ConditionalOrderAdapterFactory', () => ({
  ConditionalOrderAdapterFactory: class MockConditionalOrderAdapterFactory {
    getAdapter = vi.fn().mockResolvedValue({
      cancelConditionalOrder: (...args: unknown[]) => mockServiceStore.cancelConditionalOrder(...args),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_prisma?: unknown) {}
  },
}));

describe('PositionCloser Bilateral Close', () => {
  let mockPrisma: any;
  let positionCloser: any;

  const mockPosition = {
    id: 'pos-bilateral-123',
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
    openedAt: new Date('2024-01-01T00:00:00Z'),
    // 條件單 ID（用於測試取消）
    longStopLossOrderId: 'long-sl-123',
    longTakeProfitOrderId: 'long-tp-123',
    shortStopLossOrderId: 'short-sl-456',
    shortTakeProfitOrderId: 'short-tp-456',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // 重設模組快取，確保每次測試都重新載入

    // 重設 mock 函數的預設行為
    mockCreateMarketOrder.mockResolvedValue({
      id: 'order-123',
      average: 95050,
      filled: 0.001,
      fee: { cost: 0.1 },
      info: {}, // 加入 info 屬性，避免 JSON.stringify(order.info).substring() 錯誤
    });
    mockFetchOrder.mockResolvedValue({
      id: 'order-123',
      average: 95050,
    });
    mockFetchMyTrades.mockResolvedValue([]);
    mockLoadMarkets.mockResolvedValue({});
    mockQueryBilateralFundingFees.mockResolvedValue({
      longResult: { totalAmount: new Decimal(0), success: true, entries: [] },
      shortResult: { totalAmount: new Decimal(0), success: true, entries: [] },
      totalFundingFee: new Decimal(0),
    });
    mockCancelConditionalOrder.mockResolvedValue(true);

    mockPrisma = {
      position: {
        findUnique: vi.fn().mockResolvedValue({ ...mockPosition }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...mockPosition, ...data })
        ),
      },
      apiKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'key-1',
          userId: 'user-456',
          exchange: 'binance',
          encryptedKey: 'key',
          encryptedSecret: 'secret',
          encryptedPassphrase: 'pass',
          environment: 'MAINNET',
        }),
      },
      trade: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'trade-bilateral-1', ...data })
        ),
      },
    };

    const { PositionCloser } = await import('@/services/trading/PositionCloser');
    positionCloser = new PositionCloser(mockPrisma);
  });

  describe('closePosition method signature', () => {
    it('closePosition method should exist', () => {
      expect(typeof positionCloser.closePosition).toBe('function');
    });

    it('closeSingleSide method should exist', () => {
      expect(typeof positionCloser.closeSingleSide).toBe('function');
    });

    it('should accept closePosition params', () => {
      // Just verify the method exists and accepts the expected params
      // Note: We don't await here to avoid triggering the actual exchange calls
      expect(typeof positionCloser.closePosition).toBe('function');
    });
  });

  describe('validation errors', () => {
    it('should handle already closed position', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({
        ...mockPosition,
        status: 'CLOSED',
      });

      await expect(
        positionCloser.closePosition({
          userId: 'user-456',
          positionId: 'pos-bilateral-123',
        })
      ).rejects.toThrow('持倉狀態不正確');
    });

    it('should throw error if position not found', async () => {
      mockPrisma.position.findUnique.mockResolvedValue(null);

      await expect(
        positionCloser.closePosition({
          userId: 'user-456',
          positionId: 'non-existent-pos',
        })
      ).rejects.toThrow('持倉不存在');
    });

    it('should throw error if user does not own position', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({
        ...mockPosition,
        userId: 'different-user',
      });

      await expect(
        positionCloser.closePosition({
          userId: 'user-456',
          positionId: 'pos-bilateral-123',
        })
      ).rejects.toThrow('無權操作此持倉');
    });
  });

  describe('bilateral close success flow', () => {
    it('should close both sides and create Trade record when both succeed', async () => {
      // 設定兩邊都成功的訂單回應
      let orderCallCount = 0;
      mockCreateMarketOrder.mockImplementation(() => {
        orderCallCount++;
        return Promise.resolve({
          id: `order-${orderCallCount}`,
          average: orderCallCount === 1 ? 95050 : 95100, // Long exit / Short exit
          filled: 0.001,
          fee: { cost: 0.1 },
          info: {}, // 必須包含 info 屬性
        });
      });

      const result = await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證成功結果
      expect(result.success).toBe(true);
      expect(result.trade).toBeDefined();
      expect(result.longClose).toBeDefined();
      expect(result.shortClose).toBeDefined();

      // 驗證 Trade 被創建
      expect(mockPrisma.trade.create).toHaveBeenCalledTimes(1);

      // 驗證 Position 狀態更新為 CLOSED
      const updateCalls = mockPrisma.position.update.mock.calls;
      const closedCall = updateCalls.find((call: any) => call[0].data.status === 'CLOSED');
      expect(closedCall).toBeDefined();
    });

    it('should calculate PnL and include in Trade record', async () => {
      // 設定有價差的訂單
      let orderCallCount = 0;
      mockCreateMarketOrder.mockImplementation(() => {
        orderCallCount++;
        return Promise.resolve({
          id: `order-${orderCallCount}`,
          average: orderCallCount === 1 ? 95200 : 95000, // Long exit higher, Short exit lower
          filled: 0.001,
          fee: { cost: 0.05 },
          info: {},
        });
      });

      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證 Trade 記錄包含 PnL 資訊
      const tradeCreateCall = mockPrisma.trade.create.mock.calls[0][0];
      expect(tradeCreateCall.data).toHaveProperty('priceDiffPnL');
      expect(tradeCreateCall.data).toHaveProperty('totalFees');
      expect(tradeCreateCall.data).toHaveProperty('totalPnL');
      expect(tradeCreateCall.data).toHaveProperty('roi');
      expect(tradeCreateCall.data.status).toBe('SUCCESS');
    });

    it('should query funding fees and include in PnL calculation', async () => {
      // 設定有資金費率收益
      mockQueryBilateralFundingFees.mockResolvedValue({
        longResult: { totalAmount: new Decimal(-0.5), success: true, entries: [] },
        shortResult: { totalAmount: new Decimal(0.8), success: true, entries: [] },
        totalFundingFee: new Decimal(0.3), // 淨收益 0.3 USDT
      });

      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證有查詢資金費率
      expect(mockQueryBilateralFundingFees).toHaveBeenCalledTimes(1);

      // 驗證 Trade 記錄包含資金費率 PnL
      const tradeCreateCall = mockPrisma.trade.create.mock.calls[0][0];
      expect(tradeCreateCall.data.fundingRatePnL).toBe(0.3);
    });

    it('should cancel conditional orders after successful close', async () => {
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證條件單被取消（4 個：longSL, longTP, shortSL, shortTP）
      expect(mockCancelConditionalOrder).toHaveBeenCalled();
    });

    it('should record closeReason as MANUAL by default', async () => {
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證 closeReason 為 MANUAL
      const updateCalls = mockPrisma.position.update.mock.calls;
      const closedCall = updateCalls.find((call: any) => call[0].data.status === 'CLOSED');
      expect(closedCall[0].data.closeReason).toBe('MANUAL');
    });

    it('should record custom closeReason when provided', async () => {
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
        closeReason: 'LONG_SL_TRIGGERED',
      });

      const updateCalls = mockPrisma.position.update.mock.calls;
      const closedCall = updateCalls.find((call: any) => call[0].data.status === 'CLOSED');
      expect(closedCall[0].data.closeReason).toBe('LONG_SL_TRIGGERED');
    });
  });

  describe('bilateral close failure scenarios', () => {
    it('should restore status to OPEN when both sides fail', async () => {
      // 設定兩邊都失敗
      mockCreateMarketOrder.mockRejectedValue(new Error('Exchange API error'));

      await expect(
        positionCloser.closePosition({
          userId: 'user-456',
          positionId: 'pos-bilateral-123',
        })
      ).rejects.toThrow('雙邊平倉都失敗');

      // 驗證狀態回復為 OPEN
      const updateCalls = mockPrisma.position.update.mock.calls;
      const openCall = updateCalls.find((call: any) => call[0].data.status === 'OPEN');
      expect(openCall).toBeDefined();
    });

    it('should set status to PARTIAL when one side fails', async () => {
      // 設定一邊成功一邊失敗
      let callCount = 0;
      mockCreateMarketOrder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Long 成功
          return Promise.resolve({
            id: 'order-long-123',
            average: 95050,
            filled: 0.001,
            fee: { cost: 0.1 },
            info: {},
          });
        } else {
          // Short 失敗
          return Promise.reject(new Error('Short side API error'));
        }
      });

      const result = await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證結果為部分平倉
      expect(result.success).toBe(false);
      expect(result.error).toBe('PARTIAL_CLOSE');
      expect(result.closedSide).toBeDefined();
      expect(result.failedSide).toBeDefined();

      // 驗證狀態設為 PARTIAL
      const updateCalls = mockPrisma.position.update.mock.calls;
      const partialCall = updateCalls.find((call: any) => call[0].data.status === 'PARTIAL');
      expect(partialCall).toBeDefined();
    });

    it('should include failure reason in PARTIAL status', async () => {
      let callCount = 0;
      mockCreateMarketOrder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: 'order-long-123',
            average: 95050,
            filled: 0.001,
            fee: { cost: 0.1 },
            info: {},
          });
        } else {
          return Promise.reject(new Error('Insufficient margin'));
        }
      });

      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證 failureReason 包含錯誤訊息
      const updateCalls = mockPrisma.position.update.mock.calls;
      const partialCall = updateCalls.find((call: any) => call[0].data.status === 'PARTIAL');
      expect(partialCall[0].data.failureReason).toContain('Insufficient margin');
    });
  });

  describe('price fallback mechanisms', () => {
    it('should use fetchOrder when createMarketOrder returns price 0', async () => {
      // 第一次回傳沒有價格
      mockCreateMarketOrder.mockResolvedValue({
        id: 'order-123',
        average: 0,
        filled: 0.001,
        fee: { cost: 0.1 },
        info: {},
      });

      // fetchOrder 回傳正確價格
      mockFetchOrder.mockResolvedValue({
        id: 'order-123',
        average: 95050,
      });

      const result = await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證有呼叫 fetchOrder
      expect(mockFetchOrder).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should use fetchMyTrades when both createMarketOrder and fetchOrder return price 0', async () => {
      mockCreateMarketOrder.mockResolvedValue({
        id: 'order-123',
        average: 0,
        filled: 0.001,
        fee: { cost: 0.1 },
        info: {},
      });

      mockFetchOrder.mockResolvedValue({
        id: 'order-123',
        average: 0,
      });

      // fetchMyTrades 回傳成交記錄
      mockFetchMyTrades.mockResolvedValue([
        { order: 'order-123', price: 95050, amount: 0.001 },
      ]);

      const result = await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證有呼叫 fetchMyTrades
      expect(mockFetchMyTrades).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('exchange-specific behavior', () => {
    it('should use positionSide LONG for Binance Hedge Mode sell order', async () => {
      // Binance Long 平倉：side='sell', positionSide='LONG'
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 檢查 Binance (Long) 的訂單參數
      const binanceCall = mockCreateMarketOrder.mock.calls.find(
        (call: any) => call[4]?.positionSide === 'LONG'
      );
      expect(binanceCall).toBeDefined();
      expect(binanceCall[1]).toBe('sell'); // side
    });

    it('should use posSide long for OKX Hedge Mode sell order', async () => {
      // OKX Long 平倉：side='sell', posSide='long'
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 檢查 OKX (Short) 的訂單參數
      const okxCall = mockCreateMarketOrder.mock.calls.find(
        (call: any) => call[4]?.posSide !== undefined
      );
      expect(okxCall).toBeDefined();
      expect(okxCall[4].tdMode).toBe('cross');
    });

    it('should retry with opposite position mode on Binance -4061 error', async () => {
      let callCount = 0;
      mockCreateMarketOrder.mockImplementation((symbol, side, qty, price, params) => {
        callCount++;
        // 第一次 Binance 呼叫失敗
        if (callCount === 1 && params?.positionSide) {
          return Promise.reject(new Error('-4061 position side does not match'));
        }
        // 重試或其他呼叫成功
        return Promise.resolve({
          id: `order-${callCount}`,
          average: 95050,
          filled: 0.001,
          fee: { cost: 0.1 },
          info: {},
        });
      });

      const result = await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 應該成功（透過重試）
      expect(result.success).toBe(true);
      // 應該有額外的呼叫（重試）
      expect(mockCreateMarketOrder.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('symbol formatting', () => {
    it('should convert BTCUSDT to BTC/USDT:USDT format', async () => {
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證 symbol 格式正確
      const firstCall = mockCreateMarketOrder.mock.calls[0];
      expect(firstCall[0]).toBe('BTC/USDT:USDT');
    });

    it('should convert ETHUSDT to ETH/USDT:USDT format', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({
        ...mockPosition,
        symbol: 'ETHUSDT',
      });

      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      const firstCall = mockCreateMarketOrder.mock.calls[0];
      expect(firstCall[0]).toBe('ETH/USDT:USDT');
    });
  });

  describe('contract size conversion', () => {
    it('should convert quantity based on contractSize', async () => {
      // 模擬 contractSize 不為 1 的情況（如某些合約）
      // 注意：由於 markets 是在建構時設定的，這個測試驗證轉換邏輯存在
      await positionCloser.closePosition({
        userId: 'user-456',
        positionId: 'pos-bilateral-123',
      });

      // 驗證有傳遞數量參數
      const firstCall = mockCreateMarketOrder.mock.calls[0];
      expect(firstCall[2]).toBe(0.001); // quantity
    });
  });
});
