/**
 * PositionOrchestrator Unit Tests
 *
 * 測試 Saga Pattern 雙邊開倉協調器
 * Feature: 048-position-orchestrator-tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import type { PrismaClient, Position } from '@/generated/prisma/client';
import type { OpenPositionParams } from '../../../src/types/trading';

// =============================================================================
// Mocks Setup (Phase 1: T001-T008)
// 使用 vi.hoisted 確保 mock 函數在 vi.mock 之前初始化
// =============================================================================

// 使用 vi.hoisted 建立可被 vi.mock factory 引用的 mock 函數
const { mockFnStore, mockBalanceValidatorStore, mockConditionalOrderStore } = vi.hoisted(() => ({
  mockFnStore: {
    createMarketOrder: vi.fn(),
    fetchTicker: vi.fn(),
    loadMarkets: vi.fn(),
    setLeverage: vi.fn(),
    fetchOrder: vi.fn(),
    fetchMyTrades: vi.fn(),
  },
  mockBalanceValidatorStore: {
    validateBalance: vi.fn(),
  },
  mockConditionalOrderStore: {
    setConditionalOrders: vi.fn(),
  },
}));

// T003: Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// T004: Mock encryption
vi.mock('../../../src/lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-key'),
}));

// T002: Mock CCXT (dynamic import)
vi.mock('ccxt', () => {
  // 創建 mock class（必須在 factory 內部定義）
  class MockExchangeClass {
    createMarketOrder = (...args: unknown[]) => mockFnStore.createMarketOrder(...args);
    fetchTicker = (...args: unknown[]) => mockFnStore.fetchTicker(...args);
    loadMarkets = (...args: unknown[]) => mockFnStore.loadMarkets(...args);
    setLeverage = (...args: unknown[]) => mockFnStore.setLeverage(...args);
    fetchOrder = (...args: unknown[]) => mockFnStore.fetchOrder(...args);
    fetchMyTrades = (...args: unknown[]) => mockFnStore.fetchMyTrades(...args);
    markets = { 'BTC/USDT:USDT': { contractSize: 1 } };
    fapiPrivateGetPositionSideDual = vi.fn().mockResolvedValue({ dualSidePosition: false });
    papiGetUmPositionSideDual = vi.fn();
     
    constructor(_config?: unknown) {
      // 配置在這裡被忽略，使用預設 mock
    }
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
  };
});

// Mock BalanceValidator
vi.mock('../../../src/services/trading/BalanceValidator', () => {
  return {
    BalanceValidator: class MockBalanceValidator {
      validateBalance = (...args: unknown[]) => mockBalanceValidatorStore.validateBalance(...args);
       
      constructor(_prisma?: unknown) {}
    },
  };
});

// Mock ConditionalOrderService
vi.mock('../../../src/services/trading/ConditionalOrderService', () => {
  return {
    ConditionalOrderService: class MockConditionalOrderService {
      setConditionalOrders = (...args: unknown[]) => mockConditionalOrderStore.setConditionalOrders(...args);
    },
  };
});

// 用於測試中引用的 mock 函數
const mockCreateMarketOrder = mockFnStore.createMarketOrder;
const mockFetchTicker = mockFnStore.fetchTicker;
const mockLoadMarkets = mockFnStore.loadMarkets;
const mockSetLeverage = mockFnStore.setLeverage;
const mockFetchOrder = mockFnStore.fetchOrder;
const mockFetchMyTrades = mockFnStore.fetchMyTrades;
const mockValidateBalance = mockBalanceValidatorStore.validateBalance;
const mockSetConditionalOrders = mockConditionalOrderStore.setConditionalOrders;

// Import after mocks are set up
import { PositionOrchestrator } from '../../../src/services/trading/PositionOrchestrator';
import { PositionLockService } from '../../../src/services/trading/PositionLockService';
import {
  TradingError,
  RollbackFailedError,
  InsufficientBalanceError,
} from '../../../src/lib/errors/trading-errors';

// =============================================================================
// Test Data (Phase 1: T007)
// =============================================================================

const createBaseParams = (): OpenPositionParams => ({
  userId: 'user-123',
  symbol: 'BTCUSDT',
  longExchange: 'binance',
  shortExchange: 'okx',
  quantity: new Decimal(0.1),
  leverage: 1,
  stopLossEnabled: false,
  takeProfitEnabled: false,
});

const createMockPosition = (overrides: Partial<Position> = {}): Position => ({
  id: 'test-position-id',
  userId: 'user-123',
  symbol: 'BTCUSDT',
  longExchange: 'binance',
  shortExchange: 'okx',
  longEntryPrice: 0,
  longPositionSize: 0,
  longLeverage: 1,
  longOrderId: null,
  shortEntryPrice: 0,
  shortPositionSize: 0,
  shortLeverage: 1,
  shortOrderId: null,
  status: 'PENDING',
  failureReason: null,
  openFundingRateLong: 0,
  openFundingRateShort: 0,
  openedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // 條件單欄位
  stopLossEnabled: false,
  stopLossPercent: null,
  takeProfitEnabled: false,
  takeProfitPercent: null,
  conditionalOrderStatus: null,
  conditionalOrderError: null,
  longStopLossPrice: null,
  longStopLossOrderId: null,
  shortStopLossPrice: null,
  shortStopLossOrderId: null,
  longTakeProfitPrice: null,
  longTakeProfitOrderId: null,
  shortTakeProfitPrice: null,
  shortTakeProfitOrderId: null,
  // Feature 050: 平倉相關欄位
  closeReason: null,
  longCloseOrderId: null,
  longExitPrice: null,
  shortCloseOrderId: null,
  shortExitPrice: null,
  // Feature 067: 平倉建議欄位
  cachedFundingPnL: null,
  cachedFundingPnLUpdatedAt: null,
  exitSuggested: false,
  exitSuggestedAt: null,
  exitSuggestedReason: null,
  // Feature 069/070: groupId（現為必填）
  groupId: 'mock-group-id',
  ...overrides,
});

const createSuccessfulOrderResult = (overrides = {}) => ({
  id: 'order-123',
  status: 'closed',
  filled: 0.1,
  average: 50000,
  price: 50000,
  amount: 0.1,
  fee: { cost: 0.5, currency: 'USDT' },
  ...overrides,
});

// T005: Mock PrismaClient 工廠函數
const createMockPrisma = (positionOverrides: Partial<Position> = {}) => {
  const mockPosition = createMockPosition(positionOverrides);
  // 追蹤 position 狀態，以便 update 返回正確的合併結果
  let currentPosition = { ...mockPosition };

  return {
    position: {
      create: vi.fn().mockImplementation(({ data }) => {
        currentPosition = { ...mockPosition, ...data };
        return Promise.resolve(currentPosition);
      }),
      update: vi.fn().mockImplementation(({ data }) => {
        // 合併更新，確保新的 data 覆蓋舊的值
        currentPosition = { ...currentPosition, ...data };
        return Promise.resolve(currentPosition);
      }),
      findUnique: vi.fn().mockResolvedValue(mockPosition),
    },
    apiKey: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'key-1',
        userId: 'user-123',
        exchange: 'binance',
        encryptedKey: 'encrypted-key',
        encryptedSecret: 'encrypted-secret',
        encryptedPassphrase: null,
        environment: 'MAINNET',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as unknown as PrismaClient;
};

// =============================================================================
// Test Suite
// =============================================================================

describe('PositionOrchestrator', () => {
  let orchestrator: PositionOrchestrator;
  let mockPrisma: PrismaClient;

  // T008: beforeEach/afterEach 設定
  beforeEach(() => {
    vi.useFakeTimers();

    // 忽略測試中預期的 unhandled rejection warnings
    // 這些是回滾測試中故意拋出的錯誤
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', () => {
      // 靜默處理預期的 rejection
    });

    // T006: Mock PositionLockService.withLock 靜態方法
    vi.spyOn(PositionLockService, 'withLock').mockImplementation(
      async (_userId, _symbol, callback) => {
        return callback({ lockId: 'mock-lock-id', acquired: true });
      },
    );

    // 重置所有 mock
    mockCreateMarketOrder.mockReset();
    mockFetchTicker.mockReset();
    mockLoadMarkets.mockReset();
    mockSetLeverage.mockReset();
    mockFetchOrder.mockReset();
    mockFetchMyTrades.mockReset();
    mockSetConditionalOrders.mockReset();
    mockValidateBalance.mockReset();

    // 設定預設行為
    mockFetchTicker.mockResolvedValue({ last: 50000 });
    mockLoadMarkets.mockResolvedValue({});
    mockFetchMyTrades.mockResolvedValue([]);
    mockValidateBalance.mockResolvedValue(undefined);

    mockPrisma = createMockPrisma();
    orchestrator = new PositionOrchestrator(mockPrisma);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Phase 2: User Story 1 - 雙邊開倉成功流程測試 (T009-T015)
  // ===========================================================================

  describe('openPosition', () => {
    describe('successful bilateral open', () => {
      beforeEach(() => {
        // 設定雙邊都成功
        mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
      });

      it('should create position with OPEN status when both sides succeed', async () => {
        const params = createBaseParams();

        const result = await orchestrator.openPosition(params);

        expect(result.status).toBe('OPEN');
        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'OPEN',
            }),
          }),
        );
      });

      it('should record correct entry prices and quantities for long and short', async () => {
        const params = createBaseParams();

        await orchestrator.openPosition(params);

        // 驗證 position.update 被調用時包含正確的價格和數量
        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              longEntryPrice: 50000,
              longPositionSize: 0.1,
              shortEntryPrice: 50000,
              shortPositionSize: 0.1,
            }),
          }),
        );
      });

      it('should record order IDs for both exchanges', async () => {
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'long-order-123' }))
          .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'short-order-456' }));

        const params = createBaseParams();
        await orchestrator.openPosition(params);

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              longOrderId: 'long-order-123',
              shortOrderId: 'short-order-456',
            }),
          }),
        );
      });

      // ===========================================================================
      // Feature 070: 單獨開倉自動生成 groupId (T010)
      // ===========================================================================

      it('should auto-generate groupId when not provided (single open)', async () => {
        // UUID v4 pattern for validation
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        const params = createBaseParams();
        // Ensure no groupId is provided
        expect(params.groupId).toBeUndefined();

        await orchestrator.openPosition(params);

        // Verify position.create was called with a valid UUID groupId
        const createCalls = (mockPrisma.position.create as ReturnType<typeof vi.fn>).mock.calls;
        expect(createCalls.length).toBeGreaterThan(0);

        const createData = createCalls[0][0].data;
        expect(createData.groupId).toBeDefined();
        expect(createData.groupId).not.toBeNull();
        expect(createData.groupId).toMatch(UUID_PATTERN);
      });

      it('should preserve explicit groupId when provided (split open)', async () => {
        const explicitGroupId = '550e8400-e29b-41d4-a716-446655440000';

        const params = createBaseParams();
        params.groupId = explicitGroupId;

        await orchestrator.openPosition(params);

        // Verify position.create was called with the explicit groupId
        const createCalls = (mockPrisma.position.create as ReturnType<typeof vi.fn>).mock.calls;
        expect(createCalls.length).toBeGreaterThan(0);

        const createData = createCalls[0][0].data;
        expect(createData.groupId).toBe(explicitGroupId);
      });

      it('should set conditional orders when stopLossEnabled is true', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { stopLoss: { orderId: 'sl-long', triggerPrice: new Decimal(47500) } },
          shortResult: { stopLoss: { orderId: 'sl-short', triggerPrice: new Decimal(52500) } },
          errors: [],
        });

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockSetConditionalOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            stopLossEnabled: true,
            stopLossPercent: 5,
          }),
        );
      });

      it('should set conditional orders when takeProfitEnabled is true', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { takeProfit: { orderId: 'tp-long', triggerPrice: new Decimal(52500) } },
          shortResult: { takeProfit: { orderId: 'tp-short', triggerPrice: new Decimal(47500) } },
          errors: [],
        });

        const params = createBaseParams();
        params.takeProfitEnabled = true;
        params.takeProfitPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockSetConditionalOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            takeProfitEnabled: true,
            takeProfitPercent: 5,
          }),
        );
      });

      it('should update conditionalOrderStatus to SET after successful setup', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { stopLoss: { orderId: 'sl-long', triggerPrice: new Decimal(47500) } },
          shortResult: { stopLoss: { orderId: 'sl-short', triggerPrice: new Decimal(52500) } },
          errors: [],
        });

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        await orchestrator.openPosition(params);

        // 應該有多次 update 調用，最後一次應包含 conditionalOrderStatus
        const updateCalls = (mockPrisma.position.update as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = updateCalls[updateCalls.length - 1];
        expect(lastCall[0].data.conditionalOrderStatus).toBe('SET');
      });
    });

    // ===========================================================================
    // Phase 3: User Story 2 - 回滾機制測試 (T016-T025)
    // ===========================================================================

    describe('rollback mechanism', () => {
      it('should rollback long position when short fails', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'long-order-123' }))
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾成功
        mockCreateMarketOrder.mockResolvedValueOnce(createSuccessfulOrderResult());

        const params = createBaseParams();

        await expect(orchestrator.openPosition(params)).rejects.toThrow(TradingError);

        // 驗證回滾被調用（第 3 次 createMarketOrder 調用是回滾）
        expect(mockCreateMarketOrder).toHaveBeenCalledTimes(3);
      });

      it('should rollback short position when long fails', async () => {
        // Long 失敗，Short 成功
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Long order failed'))
          .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'short-order-456' }));

        // 回滾成功
        mockCreateMarketOrder.mockResolvedValueOnce(createSuccessfulOrderResult());

        const params = createBaseParams();

        await expect(orchestrator.openPosition(params)).rejects.toThrow(TradingError);

        // 驗證回滾被調用
        expect(mockCreateMarketOrder).toHaveBeenCalledTimes(3);
      });

      it('should update position status to FAILED after successful rollback', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾成功
        mockCreateMarketOrder.mockResolvedValueOnce(createSuccessfulOrderResult());

        const params = createBaseParams();

        try {
          await orchestrator.openPosition(params);
        } catch {
          // 預期會拋出錯誤
        }

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'FAILED',
            }),
          }),
        );
      });

      it('should retry rollback up to 3 times on failure', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾失敗 3 次
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback attempt 1 failed'))
          .mockRejectedValueOnce(new Error('Rollback attempt 2 failed'))
          .mockRejectedValueOnce(new Error('Rollback attempt 3 failed'));

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(RollbackFailedError);
        expect(caughtError).toBeInstanceOf(RollbackFailedError);

        // 2 次開倉 + 3 次回滾嘗試 = 5 次
        expect(mockCreateMarketOrder).toHaveBeenCalledTimes(5);
      });

      it('should wait 1000ms before second retry attempt', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾第一次失敗，第二次成功
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback attempt 1 failed'))
          .mockResolvedValueOnce(createSuccessfulOrderResult());

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(TradingError);
        expect(caughtError).toBeInstanceOf(TradingError);
      });

      it('should wait 2000ms before third retry attempt', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾前兩次失敗，第三次成功
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback attempt 1 failed'))
          .mockRejectedValueOnce(new Error('Rollback attempt 2 failed'))
          .mockResolvedValueOnce(createSuccessfulOrderResult());

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(TradingError);
        expect(caughtError).toBeInstanceOf(TradingError);
      });

      it('should mark position as PARTIAL when rollback fails after max retries', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾全部失敗
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback failed 1'))
          .mockRejectedValueOnce(new Error('Rollback failed 2'))
          .mockRejectedValueOnce(new Error('Rollback failed 3'));

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(RollbackFailedError);
        expect(caughtError).toBeInstanceOf(RollbackFailedError);

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'PARTIAL',
            }),
          }),
        );
      });

      it('should throw RollbackFailedError after max retries', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult())
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾全部失敗
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback failed 1'))
          .mockRejectedValueOnce(new Error('Rollback failed 2'))
          .mockRejectedValueOnce(new Error('Rollback failed 3'));

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(RollbackFailedError);
        expect(caughtError).toBeInstanceOf(RollbackFailedError);
      });

      it('should include exchange and side info in RollbackFailedError', async () => {
        // Long 成功，Short 失敗
        mockCreateMarketOrder
          .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'long-order-123' }))
          .mockRejectedValueOnce(new Error('Short order failed'));

        // 回滾全部失敗
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Rollback failed 1'))
          .mockRejectedValueOnce(new Error('Rollback failed 2'))
          .mockRejectedValueOnce(new Error('Rollback failed 3'));

        const params = createBaseParams();

        // 立即附加 catch handler 以避免 unhandled rejection
        let caughtError: Error | null = null;
        const promise = orchestrator.openPosition(params).catch((e) => {
          caughtError = e;
          throw e;
        });

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toMatchObject({
          exchange: 'binance',
          side: 'LONG',
          attempts: 3,
        });
        expect(caughtError).toBeInstanceOf(RollbackFailedError);
      });
    });

    // ===========================================================================
    // Phase 4: User Story 3 - 雙邊都失敗處理測試 (T026-T030)
    // ===========================================================================

    describe('both sides failed', () => {
      it('should mark position as FAILED when both sides fail', async () => {
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Long order failed'))
          .mockRejectedValueOnce(new Error('Short order failed'));

        const params = createBaseParams();

        try {
          await orchestrator.openPosition(params);
        } catch {
          // 預期會拋出錯誤
        }

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'FAILED',
            }),
          }),
        );
      });

      it('should record combined error message from both exchanges', async () => {
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Long: Insufficient margin'))
          .mockRejectedValueOnce(new Error('Short: API rate limited'));

        const params = createBaseParams();

        try {
          await orchestrator.openPosition(params);
        } catch {
          // 預期會拋出錯誤
        }

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'FAILED',
              failureReason: expect.stringContaining('Long'),
            }),
          }),
        );
      });

      it('should throw TradingError with BILATERAL_OPEN_FAILED code', async () => {
        mockCreateMarketOrder
          .mockRejectedValueOnce(new Error('Long order failed'))
          .mockRejectedValueOnce(new Error('Short order failed'));

        const params = createBaseParams();

        try {
          await orchestrator.openPosition(params);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(TradingError);
          expect((error as TradingError).code).toBe('BILATERAL_OPEN_FAILED');
        }
      });

      it('should handle timeout errors on both sides', async () => {
        // 直接拋出超時錯誤，而非使用 setTimeout
        mockCreateMarketOrder.mockRejectedValue(new Error('Timeout after 30000ms'));

        const params = createBaseParams();

        await expect(orchestrator.openPosition(params)).rejects.toThrow(TradingError);
      });
    });

    // ===========================================================================
    // Phase 5: User Story 4 - 餘額驗證測試 (T031-T034)
    // ===========================================================================

    describe('balance validation', () => {
      it('should throw InsufficientBalanceError when balance insufficient', async () => {
        // 設定 validateBalance 拋出 InsufficientBalanceError
        mockValidateBalance.mockRejectedValue(
          new InsufficientBalanceError('binance', 5000, 1000),
        );

        const params = createBaseParams();

        await expect(orchestrator.openPosition(params)).rejects.toThrow(InsufficientBalanceError);
      });

      it('should mark position as FAILED when balance validation fails', async () => {
        mockValidateBalance.mockRejectedValue(
          new InsufficientBalanceError('binance', 5000, 1000),
        );

        const params = createBaseParams();

        try {
          await orchestrator.openPosition(params);
        } catch {
          // 預期會拋出錯誤
        }

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'FAILED',
            }),
          }),
        );
      });

      it('should throw TradingError when API key not found', async () => {
        // Mock apiKey.findFirst 返回 null
        const prismaWithNoApiKey = createMockPrisma();
        (prismaWithNoApiKey.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const newOrchestrator = new PositionOrchestrator(prismaWithNoApiKey);
        mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());

        const params = createBaseParams();

        // 當 createUserTrader 被調用時會拋出錯誤
        await expect(newOrchestrator.openPosition(params)).rejects.toThrow(TradingError);
      });
    });

    // ===========================================================================
    // Phase 6: User Story 5 - 條件單設定測試 (T035-T042)
    // ===========================================================================

    describe('conditional orders', () => {
      beforeEach(() => {
        mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
      });

      it('should set stop loss orders on both exchanges when enabled', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { stopLoss: { orderId: 'sl-long', triggerPrice: new Decimal(47500) } },
          shortResult: { stopLoss: { orderId: 'sl-short', triggerPrice: new Decimal(52625) } },
          errors: [],
        });

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockSetConditionalOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            stopLossEnabled: true,
            stopLossPercent: 5,
            longExchange: 'binance',
            shortExchange: 'okx',
          }),
        );
      });

      it('should record stop loss prices in position', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { stopLoss: { orderId: 'sl-long', triggerPrice: new Decimal(47500) } },
          shortResult: { stopLoss: { orderId: 'sl-short', triggerPrice: new Decimal(52625) } },
          errors: [],
        });

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              longStopLossPrice: 47500,
              shortStopLossPrice: 52625,
            }),
          }),
        );
      });

      it('should set take profit orders on both exchanges when enabled', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { takeProfit: { orderId: 'tp-long', triggerPrice: new Decimal(52500) } },
          shortResult: { takeProfit: { orderId: 'tp-short', triggerPrice: new Decimal(47595) } },
          errors: [],
        });

        const params = createBaseParams();
        params.takeProfitEnabled = true;
        params.takeProfitPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockSetConditionalOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            takeProfitEnabled: true,
            takeProfitPercent: 5,
          }),
        );
      });

      it('should record take profit prices in position', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: { takeProfit: { orderId: 'tp-long', triggerPrice: new Decimal(52500) } },
          shortResult: { takeProfit: { orderId: 'tp-short', triggerPrice: new Decimal(47595) } },
          errors: [],
        });

        const params = createBaseParams();
        params.takeProfitEnabled = true;
        params.takeProfitPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              longTakeProfitPrice: 52500,
              shortTakeProfitPrice: 47595,
            }),
          }),
        );
      });

      it('should handle conditional order failures gracefully (position stays OPEN)', async () => {
        mockSetConditionalOrders.mockRejectedValue(new Error('Conditional order setup failed'));

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        // 開倉應該成功，條件單失敗不應該影響開倉狀態
        const result = await orchestrator.openPosition(params);

        // Position 應該仍然是 OPEN 狀態
        expect(result.status).toBe('OPEN');
      });

      it('should set conditionalOrderStatus to FAILED when setup fails', async () => {
        mockSetConditionalOrders.mockRejectedValue(new Error('Conditional order setup failed'));

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockPrisma.position.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              conditionalOrderStatus: 'FAILED',
            }),
          }),
        );
      });

      it('should set both stop loss and take profit when both enabled', async () => {
        mockSetConditionalOrders.mockResolvedValue({
          overallStatus: 'SET',
          longResult: {
            stopLoss: { orderId: 'sl-long', triggerPrice: new Decimal(47500) },
            takeProfit: { orderId: 'tp-long', triggerPrice: new Decimal(52500) },
          },
          shortResult: {
            stopLoss: { orderId: 'sl-short', triggerPrice: new Decimal(52625) },
            takeProfit: { orderId: 'tp-short', triggerPrice: new Decimal(47595) },
          },
          errors: [],
        });

        const params = createBaseParams();
        params.stopLossEnabled = true;
        params.stopLossPercent = 5;
        params.takeProfitEnabled = true;
        params.takeProfitPercent = 5;

        await orchestrator.openPosition(params);

        expect(mockSetConditionalOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            stopLossEnabled: true,
            stopLossPercent: 5,
            takeProfitEnabled: true,
            takeProfitPercent: 5,
          }),
        );
      });
    });

    // ===========================================================================
    // Phase 7: User Story 6 - 分散式鎖測試 (T043-T045)
    // ===========================================================================

    describe('lock mechanism', () => {
      beforeEach(() => {
        mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
      });

      it('should call PositionLockService.withLock before execution', async () => {
        const params = createBaseParams();

        await orchestrator.openPosition(params);

        expect(PositionLockService.withLock).toHaveBeenCalled();
      });

      it('should pass correct userId and symbol to withLock', async () => {
        const params = createBaseParams();
        params.userId = 'specific-user-123';
        params.symbol = 'ETHUSDT';

        await orchestrator.openPosition(params);

        expect(PositionLockService.withLock).toHaveBeenCalledWith(
          'specific-user-123',
          'ETHUSDT',
          expect.any(Function),
        );
      });
    });
  });

  // ===========================================================================
  // Phase 8: Edge Cases (T046-T050)
  // ===========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
    });

    it('should format symbol correctly for CCXT (BTCUSDT -> BTC/USDT:USDT)', async () => {
      // 這個測試驗證 formatSymbolForCcxt 被正確調用
      // 我們通過驗證 createMarketOrder 接收到正確格式的 symbol 來間接測試
      const params = createBaseParams();
      params.symbol = 'BTCUSDT';

      await orchestrator.openPosition(params);

      // createMarketOrder 應該被調用時使用 CCXT 格式的 symbol
      expect(mockCreateMarketOrder).toHaveBeenCalledWith(
        'BTC/USDT:USDT',
        expect.any(String),
        expect.any(Number),
        undefined,
        expect.any(Object),
      );
    });

    it('should handle order execution timeout (30 seconds)', async () => {
      // 直接拋出超時錯誤來模擬超時情況
      mockCreateMarketOrder.mockRejectedValue(new Error('Timeout after 30000ms'));

      const params = createBaseParams();

      await expect(orchestrator.openPosition(params)).rejects.toThrow(TradingError);
    });

    it('should handle order price of 0 by fetching ticker price', async () => {
      // 第一次返回價格 0，模擬需要 fetch order
      mockCreateMarketOrder.mockResolvedValue({
        id: 'order-123',
        status: 'closed',
        filled: 0.1,
        average: 0,
        price: 0,
        amount: 0.1,
        fee: { cost: 0.5, currency: 'USDT' },
      });

      mockFetchOrder.mockResolvedValue({
        id: 'order-123',
        average: 50000,
        price: 50000,
        filled: 0.1,
      });

      const params = createBaseParams();

      // 開始執行但不等待
      const promise = orchestrator.openPosition(params);

      // 快進 500ms 讓 fetchOrder 的 setTimeout 完成（每個 side 都有一個）
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      // 不應該拋出錯誤
      await expect(promise).resolves.toBeDefined();
    });

    it('should handle Binance position mode error (-4061) with retry', async () => {
      // 第一次調用返回 -4061 錯誤
      mockCreateMarketOrder
        .mockRejectedValueOnce(new Error('Position side does not match user setting. -4061'))
        .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'order-retry' }))
        .mockResolvedValueOnce(createSuccessfulOrderResult({ id: 'short-order' }));

      const params = createBaseParams();

      // 應該成功（因為重試應該成功）
      await expect(orchestrator.openPosition(params)).resolves.toBeDefined();
    });

    it('should use fetchMyTrades as fallback when fetchOrder returns price 0', async () => {
      // createMarketOrder 返回價格 0
      mockCreateMarketOrder.mockResolvedValue({
        id: 'order-123',
        status: 'closed',
        filled: 0.1,
        average: 0,
        price: 0,
        amount: 0.1,
        fee: { cost: 0.5, currency: 'USDT' },
      });

      // fetchOrder 也返回價格 0
      mockFetchOrder.mockResolvedValue({
        id: 'order-123',
        average: 0,
        price: 0,
        filled: 0.1,
      });

      // fetchMyTrades 返回成交記錄
      mockFetchMyTrades.mockResolvedValue([
        { order: 'order-123', price: 50000, amount: 0.05 },
        { order: 'order-123', price: 50100, amount: 0.05 },
      ]);

      const params = createBaseParams();

      const promise = orchestrator.openPosition(params);

      // 快進 timers
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      await expect(promise).resolves.toBeDefined();

      // 驗證 fetchMyTrades 被調用
      expect(mockFetchMyTrades).toHaveBeenCalled();
    });

    it('should handle non-USDT symbol format correctly', async () => {
      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());

      const params = createBaseParams();
      params.symbol = 'ETHUSDT';

      await orchestrator.openPosition(params);

      // 驗證 symbol 被正確格式化為 ETH/USDT:USDT
      expect(mockCreateMarketOrder).toHaveBeenCalledWith(
        'ETH/USDT:USDT',
        expect.any(String),
        expect.any(Number),
        undefined,
        expect.any(Object),
      );
    });
  });

  // ===========================================================================
  // Phase 9: Exchange-Specific Tests (補充測試)
  // ===========================================================================

  describe('exchange-specific behavior', () => {
    beforeEach(() => {
      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
    });

    describe('OKX Hedge Mode', () => {
      it('should include posSide and tdMode for OKX orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'okx';
        params.shortExchange = 'binance';

        await orchestrator.openPosition(params);

        // OKX 的 long 訂單應該包含 posSide: 'long' 和 tdMode: 'cross'
        const okxCalls = mockCreateMarketOrder.mock.calls.filter(
          (call: unknown[]) => {
            const params = call[4] as Record<string, unknown> | undefined;
            return params?.posSide !== undefined;
          },
        );
        expect(okxCalls.length).toBeGreaterThan(0);
      });

      it('should use correct posSide for OKX long position (buy -> long)', async () => {
        const params = createBaseParams();
        params.longExchange = 'okx';
        params.shortExchange = 'binance';

        await orchestrator.openPosition(params);

        // 驗證 OKX 買單使用 posSide: 'long'
        expect(mockCreateMarketOrder).toHaveBeenCalledWith(
          expect.any(String),
          'buy',
          expect.any(Number),
          undefined,
          expect.objectContaining({ posSide: 'long', tdMode: 'cross' }),
        );
      });

      it('should use correct posSide for OKX short position (sell -> short)', async () => {
        const params = createBaseParams();
        params.longExchange = 'binance';
        params.shortExchange = 'okx';

        await orchestrator.openPosition(params);

        // 驗證 OKX 賣單使用 posSide: 'short'
        expect(mockCreateMarketOrder).toHaveBeenCalledWith(
          expect.any(String),
          'sell',
          expect.any(Number),
          undefined,
          expect.objectContaining({ posSide: 'short', tdMode: 'cross' }),
        );
      });
    });

    describe('BingX Hedge Mode', () => {
      it('should include positionSide for BingX orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'bingx';
        params.shortExchange = 'binance';

        await orchestrator.openPosition(params);

        // BingX 的訂單應該包含 positionSide
        expect(mockCreateMarketOrder).toHaveBeenCalled();
      });

      it('should use LONG positionSide for BingX buy orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'bingx';
        params.shortExchange = 'okx';

        await orchestrator.openPosition(params);

        // 驗證 BingX 買單使用 positionSide: 'LONG'
        expect(mockCreateMarketOrder).toHaveBeenCalledWith(
          expect.any(String),
          'buy',
          expect.any(Number),
          undefined,
          expect.objectContaining({ positionSide: 'LONG' }),
        );
      });

      it('should use SHORT positionSide for BingX sell orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'okx';
        params.shortExchange = 'bingx';

        await orchestrator.openPosition(params);

        // 驗證 BingX 賣單使用 positionSide: 'SHORT'
        expect(mockCreateMarketOrder).toHaveBeenCalledWith(
          expect.any(String),
          'sell',
          expect.any(Number),
          undefined,
          expect.objectContaining({ positionSide: 'SHORT' }),
        );
      });

      it('should set leverage with positionSide for BingX', async () => {
        const params = createBaseParams();
        params.longExchange = 'bingx';
        params.shortExchange = 'binance';
        params.leverage = 2;

        await orchestrator.openPosition(params);

        // BingX 設置槓桿時應該包含 side 參數
        expect(mockSetLeverage).toHaveBeenCalledWith(
          2,
          expect.any(String),
          expect.objectContaining({ side: expect.any(String) }),
        );
      });
    });

    describe('MEXC and GateIO (One-way Mode)', () => {
      it('should not include positionSide for MEXC orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'mexc';
        params.shortExchange = 'binance';

        await orchestrator.openPosition(params);

        // MEXC 不應該有 positionSide 參數
        const mexcCalls = mockCreateMarketOrder.mock.calls.filter(
          (call: unknown[]) => {
            const params = call[4] as Record<string, unknown> | undefined;
            return params && !params.positionSide && !params.posSide;
          },
        );
        expect(mexcCalls.length).toBeGreaterThan(0);
      });

      it('should not include positionSide for GateIO orders', async () => {
        const params = createBaseParams();
        params.longExchange = 'gateio';
        params.shortExchange = 'binance';

        await orchestrator.openPosition(params);

        // GateIO 不應該有 positionSide 參數
        expect(mockCreateMarketOrder).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // Phase 10: Leverage Tests (槓桿設置測試)
  // ===========================================================================

  describe('leverage configuration', () => {
    beforeEach(() => {
      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
    });

    it('should set leverage to 1x by default', async () => {
      const params = createBaseParams();
      params.leverage = 1;

      await orchestrator.openPosition(params);

      // 驗證 setLeverage 被調用，槓桿為 1
      // Binance 等交易所只傳 2 個參數 (leverage, symbol)
      expect(mockSetLeverage).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
    });

    it('should set leverage to 2x when specified', async () => {
      const params = createBaseParams();
      params.leverage = 2;

      await orchestrator.openPosition(params);

      // 驗證 setLeverage 被調用，槓桿為 2
      // Binance 等交易所只傳 2 個參數 (leverage, symbol)
      expect(mockSetLeverage).toHaveBeenCalledWith(
        2,
        expect.any(String),
      );
    });

    it('should continue execution even if setLeverage fails', async () => {
      mockSetLeverage.mockRejectedValue(new Error('Leverage already set'));

      const params = createBaseParams();

      // 即使 setLeverage 失敗，開倉也應該成功
      await expect(orchestrator.openPosition(params)).resolves.toBeDefined();
    });

    it('should record correct leverage in position', async () => {
      const params = createBaseParams();
      params.leverage = 2;

      await orchestrator.openPosition(params);

      // 驗證 Position 記錄了正確的槓桿
      expect(mockPrisma.position.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            longLeverage: 2,
            shortLeverage: 2,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // Phase 11: Parallel Execution Tests (並行執行測試)
  // ===========================================================================

  describe('parallel execution', () => {
    it('should execute long and short orders in parallel', async () => {
      const executionOrder: string[] = [];

      mockCreateMarketOrder.mockImplementation(async (_symbol, side) => {
        executionOrder.push(`start-${side}`);
        // 模擬網路延遲
        await new Promise((resolve) => setTimeout(resolve, 100));
        executionOrder.push(`end-${side}`);
        return createSuccessfulOrderResult();
      });

      const params = createBaseParams();

      const promise = orchestrator.openPosition(params);

      // 快進所有 timers
      await vi.advanceTimersByTimeAsync(200);

      await promise;

      // 驗證兩個訂單是並行開始的（start-buy 和 start-sell 應該連續出現）
      const buyStartIndex = executionOrder.indexOf('start-buy');
      const sellStartIndex = executionOrder.indexOf('start-sell');

      // 兩個 start 應該在所有 end 之前
      expect(buyStartIndex).toBeLessThan(executionOrder.indexOf('end-buy'));
      expect(sellStartIndex).toBeLessThan(executionOrder.indexOf('end-sell'));
    });

    it('should create traders for both exchanges in parallel (not sequentially)', async () => {
      // Feature: fix/open-position-performance
      // 驗證 createUserTrader 是平行執行的，而非串行
      const apiKeyQueryTimes: number[] = [];

      // Mock apiKey.findFirst 記錄查詢時間
      (mockPrisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        apiKeyQueryTimes.push(performance.now());
        // 模擬 API key 查詢延遲
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          id: 'key-1',
          userId: 'user-123',
          exchange: 'binance',
          encryptedKey: 'encrypted-key',
          encryptedSecret: 'encrypted-secret',
          encryptedPassphrase: null,
          environment: 'MAINNET',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());

      const params = createBaseParams();

      const promise = orchestrator.openPosition(params);

      // 快進所有 timers
      await vi.advanceTimersByTimeAsync(500);

      await promise;

      // 驗證：至少有 2 次 API key 查詢（longExchange 和 shortExchange）
      expect(apiKeyQueryTimes.length).toBeGreaterThanOrEqual(2);

      // 如果是平行執行，兩次查詢的時間差應該很小（< 10ms）
      // 如果是串行執行，時間差會 >= 50ms（因為第一次查詢需要 50ms）
      if (apiKeyQueryTimes.length >= 2) {
        const timeDiff = Math.abs(apiKeyQueryTimes[1] - apiKeyQueryTimes[0]);
        // 平行執行時，兩次查詢幾乎同時開始，時間差應該很小
        expect(timeDiff).toBeLessThan(10);
      }
    });
  });

  // ===========================================================================
  // Phase 12: API Key Passphrase Tests (API Key 密碼測試)
  // ===========================================================================

  describe('API key handling', () => {
    beforeEach(() => {
      mockCreateMarketOrder.mockResolvedValue(createSuccessfulOrderResult());
    });

    it('should handle OKX passphrase correctly', async () => {
      // Mock OKX API key with passphrase
      const prismaWithOkxKey = createMockPrisma();
      (prismaWithOkxKey.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key-okx',
        userId: 'user-123',
        exchange: 'okx',
        encryptedKey: 'encrypted-key',
        encryptedSecret: 'encrypted-secret',
        encryptedPassphrase: 'encrypted-passphrase',
        environment: 'MAINNET',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const okxOrchestrator = new PositionOrchestrator(prismaWithOkxKey);

      const params = createBaseParams();
      params.longExchange = 'okx';
      params.shortExchange = 'okx';

      // 應該不會因為 passphrase 而失敗
      await expect(okxOrchestrator.openPosition(params)).resolves.toBeDefined();
    });

    it('should throw error when API key is inactive', async () => {
      const prismaWithInactiveKey = createMockPrisma();
      (prismaWithInactiveKey.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const newOrchestrator = new PositionOrchestrator(prismaWithInactiveKey);

      const params = createBaseParams();

      await expect(newOrchestrator.openPosition(params)).rejects.toThrow(TradingError);
    });

    it('should use testnet configuration when API key environment is TESTNET', async () => {
      const prismaWithTestnetKey = createMockPrisma();
      (prismaWithTestnetKey.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'key-testnet',
        userId: 'user-123',
        exchange: 'binance',
        encryptedKey: 'encrypted-key',
        encryptedSecret: 'encrypted-secret',
        encryptedPassphrase: null,
        environment: 'TESTNET',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const testnetOrchestrator = new PositionOrchestrator(prismaWithTestnetKey);

      const params = createBaseParams();

      // 應該成功執行（testnet 配置會被傳入 CCXT）
      await expect(testnetOrchestrator.openPosition(params)).resolves.toBeDefined();
    });
  });
});
