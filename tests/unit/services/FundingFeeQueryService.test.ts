/**
 * FundingFeeQueryService Unit Tests
 *
 * Feature: 041-funding-rate-pnl-display
 * TDD Green Phase: Implement and verify tests pass
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Decimal } from 'decimal.js';
import type { SupportedExchange } from '@/types/trading';
import { FundingFeeQueryService } from '@/services/trading/FundingFeeQueryService';

// Mock CCXT
vi.mock('ccxt', () => ({
  default: {},
  binance: vi.fn(),
  okx: vi.fn(),
  gateio: vi.fn(),
  mexc: vi.fn(),
}));

// Mock Prisma
const mockPrismaApiKey = {
  findFirst: vi.fn(),
};

const mockPrisma = {
  apiKey: mockPrismaApiKey,
} as any;

// Mock encryption
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((value: string) => `decrypted_${value}`),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FundingFeeQueryService', () => {
  let service: FundingFeeQueryService;
  let mockCcxtExchange: {
    fetchFundingHistory: Mock;
    fapiPrivateGetPositionSideDual: Mock;
    papiGetUmPositionSideDual: Mock;
  };

  // Test fixtures
  const mockUserId = 'test-user-id';
  const mockSymbol = 'BTCUSDT';
  const mockStartTime = new Date('2024-01-01T00:00:00Z');
  const mockEndTime = new Date('2024-01-01T12:00:00Z');
  const mockApiKey = {
    encryptedKey: 'encrypted_key',
    encryptedSecret: 'encrypted_secret',
    encryptedPassphrase: null,
    environment: 'MAINNET',
    isActive: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock CCXT exchange
    mockCcxtExchange = {
      fetchFundingHistory: vi.fn(),
      // Mock for Binance account type detection - default to standard Futures
      fapiPrivateGetPositionSideDual: vi.fn().mockResolvedValue({ dualSidePosition: false }),
      papiGetUmPositionSideDual: vi.fn(),
    };

    // Mock CCXT constructor to return our mock exchange
    const ccxt = await import('ccxt');
    (ccxt.binance as Mock).mockImplementation(() => mockCcxtExchange);
    (ccxt.okx as Mock).mockImplementation(() => mockCcxtExchange);
    (ccxt.gateio as Mock).mockImplementation(() => mockCcxtExchange);
    (ccxt.mexc as Mock).mockImplementation(() => mockCcxtExchange);

    // Setup Prisma mock
    mockPrismaApiKey.findFirst.mockResolvedValue(mockApiKey);

    // Create service with mock Prisma
    service = new FundingFeeQueryService(mockPrisma);
  });

  describe('queryFundingFees', () => {
    // T006: queryFundingFees should return accumulated amount from settlement records
    it('should return sum of funding fees from settlement records', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([
        {
          id: '1',
          symbol: 'BTC/USDT:USDT',
          timestamp: 1704067200000,
          datetime: '2024-01-01T00:00:00.000Z',
          amount: 0.5,
        },
        {
          id: '2',
          symbol: 'BTC/USDT:USDT',
          timestamp: 1704096000000,
          datetime: '2024-01-01T08:00:00.000Z',
          amount: -0.2,
        },
      ]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Total should be 0.5 + (-0.2) = 0.3
      expect(result.totalAmount.toNumber()).toBe(0.3);
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
    });

    // T007: queryFundingFees should correctly accumulate multiple settlement records
    it('should correctly accumulate multiple settlement records', async () => {
      // Arrange: 5 settlement records with mixed positive/negative amounts
      // 使用有效的 timestamp 範圍（在 mockStartTime 和 mockEndTime 之間）
      const baseTimestamp = mockStartTime.getTime();
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([
        { id: '1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 1.0 },
        { id: '2', timestamp: baseTimestamp + 3600000, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.5 },
        { id: '3', timestamp: baseTimestamp + 7200000, datetime: '2024-01-01T02:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.3 },
        { id: '4', timestamp: baseTimestamp + 10800000, datetime: '2024-01-01T03:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.1 },
        { id: '5', timestamp: baseTimestamp + 14400000, datetime: '2024-01-01T04:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.2 },
      ]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Expected total: 1.0 - 0.5 + 0.3 - 0.1 + 0.2 = 0.9
      expect(result.totalAmount.toNumber()).toBe(0.9);
      expect(result.entries).toHaveLength(5);
    });

    it('should return 0 when no settlement records exist', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert
      expect(result.totalAmount.toNumber()).toBe(0);
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(0);
    });

    it('should convert internal symbol to CCXT format', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([]);

      // Act
      await service.queryFundingFees(
        'binance' as SupportedExchange,
        'BTCUSDT',
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Should call with CCXT format symbol
      expect(mockCcxtExchange.fetchFundingHistory).toHaveBeenCalledWith(
        'BTC/USDT:USDT',
        mockStartTime.getTime(),
        undefined,
        { until: mockEndTime.getTime() },
      );
    });
  });

  describe('queryBilateralFundingFees', () => {
    // T008: queryBilateralFundingFees should return Long and Short amounts separately and total
    it('should return Long and Short funding fees separately and combined total', async () => {
      // Arrange: Use same exchange for both sides
      const longExchange: SupportedExchange = 'binance';
      const shortExchange: SupportedExchange = 'binance';

      // 由於 Promise.all 並行執行，使用 mockImplementation 配合計數器確保順序
      // 使用有效的 timestamp 範圍（在 mockStartTime 和 mockEndTime 之間）
      const baseTimestamp = mockStartTime.getTime();
      let callCount = 0;
      const responses = [
        // First call: Long side - received 0.5 USDT
        [
          { id: 'long-1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.3 },
          { id: 'long-2', timestamp: baseTimestamp + 3600000, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.2 },
        ],
        // Second call: Short side - paid 0.3 USDT
        [
          { id: 'short-1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.2 },
          { id: 'short-2', timestamp: baseTimestamp + 3600000, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.1 },
        ],
      ];
      mockCcxtExchange.fetchFundingHistory.mockImplementation(() => {
        const response = responses[callCount];
        callCount++;
        return Promise.resolve(response || []);
      });

      // Act
      const result = await service.queryBilateralFundingFees(
        longExchange,
        shortExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Total should be 0.5 + (-0.3) = 0.2
      expect(result.totalFundingFee.toNumber()).toBe(0.2);
      // Both queries should succeed
      expect(result.longResult.success).toBe(true);
      expect(result.shortResult.success).toBe(true);
    });

    it('should handle same exchange for both Long and Short sides', async () => {
      // Arrange: Both sides on same exchange
      const exchange: SupportedExchange = 'binance';

      // 使用 mockImplementation 配合計數器
      // 使用有效的 timestamp 範圍
      const baseTimestamp = mockStartTime.getTime();
      let callCount = 0;
      const responses = [
        [{ id: '1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.4 }],
        [{ id: '2', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.15 }],
      ];
      mockCcxtExchange.fetchFundingHistory.mockImplementation(() => {
        const response = responses[callCount];
        callCount++;
        return Promise.resolve(response || []);
      });

      // Act
      const result = await service.queryBilateralFundingFees(
        exchange,
        exchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert
      expect(result.longResult.totalAmount.toNumber()).toBe(0.4);
      expect(result.shortResult.totalAmount.toNumber()).toBe(-0.15);
      expect(result.totalFundingFee.toNumber()).toBe(0.25);
    });

    it('should query both sides in parallel', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([]);

      // Act
      await service.queryBilateralFundingFees(
        'binance',
        'okx',
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Both queries should be called
      expect(mockCcxtExchange.fetchFundingHistory).toHaveBeenCalledTimes(2);
    });
  });

  // Phase 5: US3 - 處理不同結算頻率
  describe('Different Settlement Frequencies (US3)', () => {
    // T027: Different frequencies should return correct number of records
    it('should correctly handle 1h settlement frequency (3 records for 3 hours)', async () => {
      // Arrange: 1h frequency means 3 settlements in 3 hours
      const threeHourStart = new Date('2024-01-01T00:00:00Z');
      const threeHourEnd = new Date('2024-01-01T03:00:00Z');

      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([
        { id: '1', timestamp: 1704067200000, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.1 },
        { id: '2', timestamp: 1704070800000, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.2 },
        { id: '3', timestamp: 1704074400000, datetime: '2024-01-01T02:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.1 },
      ]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        threeHourStart,
        threeHourEnd,
        mockUserId,
      );

      // Assert: Should return 3 records with total = 0.1 + 0.2 - 0.1 = 0.2
      expect(result.entries).toHaveLength(3);
      expect(result.totalAmount.toNumber()).toBe(0.2);
    });

    it('should correctly handle 8h settlement frequency (1 record for 8 hours)', async () => {
      // Arrange: 8h frequency means 1 settlement in 8 hours
      const eightHourStart = new Date('2024-01-01T00:00:00Z');
      const eightHourEnd = new Date('2024-01-01T08:00:00Z');

      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([
        { id: '1', timestamp: 1704067200000, datetime: '2024-01-01T00:00:00Z', symbol: 'ETH/USDT:USDT', amount: 0.5 },
      ]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        'ETHUSDT',
        eightHourStart,
        eightHourEnd,
        mockUserId,
      );

      // Assert: Should return 1 record
      expect(result.entries).toHaveLength(1);
      expect(result.totalAmount.toNumber()).toBe(0.5);
    });

    // T028: Long 1h + Short 8h should calculate separately
    it('should handle Long 1h settlement + Short 8h settlement separately', async () => {
      // Arrange: Both sides on same exchange for deterministic order
      // Long side (1h) has 3 settlements, Short side (8h) has 1
      // 使用 mockImplementation 配合計數器
      // 使用有效的 timestamp 範圍
      const baseTimestamp = mockStartTime.getTime();
      let callCount = 0;
      const responses = [
        // Long side: 1h settlement (3 records)
        [
          { id: '1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.1 },
          { id: '2', timestamp: baseTimestamp + 3600000, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.1 },
          { id: '3', timestamp: baseTimestamp + 7200000, datetime: '2024-01-01T02:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.1 },
        ],
        // Short side: 8h settlement (1 record)
        [{ id: '4', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: -0.15 }],
      ];
      mockCcxtExchange.fetchFundingHistory.mockImplementation(() => {
        const response = responses[callCount];
        callCount++;
        return Promise.resolve(response || []);
      });

      // Act: Use same exchange for deterministic mock ordering
      const result = await service.queryBilateralFundingFees(
        'binance',
        'binance',
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Total is correct (0.3 - 0.15 = 0.15)
      expect(result.totalFundingFee.toNumber()).toBe(0.15);
      expect(result.longResult.success).toBe(true);
      expect(result.shortResult.success).toBe(true);
    });

    it('should use actual API response without calculating frequency', async () => {
      // This test verifies we use the exchange API response as-is
      // and don't try to calculate which settlements should exist
      // 使用有效的 timestamp 範圍
      const validTimestamp = mockStartTime.getTime() + 3600000; // 1 hour after start
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([
        { id: '1', timestamp: validTimestamp, datetime: '2024-01-01T01:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.123 },
      ]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: We accept whatever the API returns
      expect(result.entries).toHaveLength(1);
      expect(result.success).toBe(true);
    });
  });

  // Phase 6: US4 - 查詢失敗時的降級處理
  describe('Error Handling (US4)', () => {
    // T033: API failure should return 0 and log warning
    it('should return 0 and mark success=false when API fails', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockRejectedValue(
        new Error('API Error: Rate limit exceeded'),
      );

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert
      expect(result.totalAmount.toNumber()).toBe(0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error: Rate limit exceeded');
      expect(result.entries).toHaveLength(0);
    });

    // T034: Long success + Short failure
    it('should use Long result when Short fails', async () => {
      // Arrange: Use same exchange for deterministic order
      // 使用 mockImplementation 配合計數器
      // 使用有效的 timestamp 範圍（在 mockStartTime 和 mockEndTime 之間）
      const baseTimestamp = mockStartTime.getTime();
      let callCount = 0;
      mockCcxtExchange.fetchFundingHistory.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Long side success
          return Promise.resolve([
            { id: '1', timestamp: baseTimestamp, datetime: '2024-01-01T00:00:00Z', symbol: 'BTC/USDT:USDT', amount: 0.5 },
          ]);
        } else {
          // Short side failure
          return Promise.reject(new Error('Short side API failure'));
        }
      });

      // Act: Use same exchange for deterministic mock ordering
      const result = await service.queryBilateralFundingFees(
        'binance',
        'binance',
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: One side succeeded, one failed, total uses successful side
      expect(result.totalFundingFee.toNumber()).toBe(0.5);
      // At least one side should have succeeded
      const anySuccess = result.longResult.success || result.shortResult.success;
      expect(anySuccess).toBe(true);
    });

    // T035: Both sides fail
    it('should return 0 when both sides fail', async () => {
      // Arrange: Use same exchange for deterministic order
      mockCcxtExchange.fetchFundingHistory
        .mockRejectedValueOnce(new Error('Long side timeout'))
        .mockRejectedValueOnce(new Error('Short side timeout'));

      // Act
      const result = await service.queryBilateralFundingFees(
        'binance',
        'binance',
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert
      expect(result.longResult.success).toBe(false);
      expect(result.shortResult.success).toBe(false);
      expect(result.totalFundingFee.toNumber()).toBe(0);
    });

    // T036: Empty array is not an error
    it('should return 0 when API returns empty array (not an error)', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockResolvedValue([]);

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Empty array is success, just no settlements
      expect(result.totalAmount.toNumber()).toBe(0);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.entries).toHaveLength(0);
    });

    it('should handle network timeout gracefully', async () => {
      // Arrange
      mockCcxtExchange.fetchFundingHistory.mockRejectedValue(
        new Error('ETIMEDOUT: Connection timed out'),
      );

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.totalAmount.toNumber()).toBe(0);
    });

    it('should return 0 when API key is not found (graceful degradation)', async () => {
      // This simulates the scenario where the API key has been rotated or expired
      // The system should still allow position close with fundingRatePnL = 0
      mockPrismaApiKey.findFirst.mockResolvedValue(null); // No API key found

      // Act
      const result = await service.queryFundingFees(
        'binance' as SupportedExchange,
        mockSymbol,
        mockStartTime,
        mockEndTime,
        mockUserId,
      );

      // Assert: Should return 0 with error, not throw
      expect(result.success).toBe(false);
      expect(result.totalAmount.toNumber()).toBe(0);
      expect(result.error).toBe('No active API key found for binance');
    });
  });
});
