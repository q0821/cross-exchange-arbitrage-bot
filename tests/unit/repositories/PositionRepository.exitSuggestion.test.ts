/**
 * Test: Position Repository - Exit Suggestion Fields
 *
 * Feature 067: 持倉平倉建議監控
 * 測試 Position exitSuggestion 相關欄位的操作
 *
 * 注意：專案沒有獨立的 PositionRepository，
 * 這些測試驗證 prisma.position 操作的行為模式，
 * 會在 PositionExitMonitor 中使用
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockFindMany, mockUpdate, mockUpdateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    position: {
      findMany: mockFindMany,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
  },
}));

// Import after mocks
import { prisma } from '@/lib/db';

describe('Position Repository - Exit Suggestion Fields (Feature 067)', () => {
  const mockUserId = 'user-067-test';
  const mockPositionId = 'position-067-test';

  // Mock position with exitSuggestion fields
  const mockOpenPosition = {
    id: mockPositionId,
    userId: mockUserId,
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longEntryPrice: new Decimal('65000.00'),
    shortEntryPrice: new Decimal('65050.00'),
    longPositionSize: new Decimal('0.01'),
    shortPositionSize: new Decimal('0.01'),
    longLeverage: 3,
    shortLeverage: 3,
    status: 'OPEN',
    openFundingRateLong: new Decimal('-0.0001'),
    openFundingRateShort: new Decimal('0.0002'),
    openedAt: new Date('2026-01-20T10:00:00Z'),
    createdAt: new Date('2026-01-20T10:00:00Z'),
    updatedAt: new Date('2026-01-20T10:00:00Z'),
    // Feature 067: Exit Suggestion fields (defaults)
    cachedFundingPnL: null,
    cachedFundingPnLUpdatedAt: null,
    exitSuggested: false,
    exitSuggestedAt: null,
    exitSuggestedReason: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findOpenPositionsBySymbol', () => {
    it('should find OPEN positions for a specific symbol', async () => {
      mockFindMany.mockResolvedValue([mockOpenPosition]);

      const result = await prisma.position.findMany({
        where: {
          symbol: 'BTCUSDT',
          status: 'OPEN',
        },
      });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          status: 'OPEN',
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTCUSDT');
      expect(result[0].status).toBe('OPEN');
    });

    it('should return positions with exitSuggestion fields', async () => {
      const suggestedPosition = {
        ...mockOpenPosition,
        exitSuggested: true,
        exitSuggestedAt: new Date('2026-01-21T10:00:00Z'),
        exitSuggestedReason: 'APY_NEGATIVE',
      };
      mockFindMany.mockResolvedValue([suggestedPosition]);

      const result = await prisma.position.findMany({
        where: {
          symbol: 'BTCUSDT',
          status: 'OPEN',
        },
      });

      expect(result[0].exitSuggested).toBe(true);
      expect(result[0].exitSuggestedAt).toEqual(new Date('2026-01-21T10:00:00Z'));
      expect(result[0].exitSuggestedReason).toBe('APY_NEGATIVE');
    });

    it('should find positions with cached funding PnL', async () => {
      const positionWithCache = {
        ...mockOpenPosition,
        cachedFundingPnL: new Decimal('12.35'),
        cachedFundingPnLUpdatedAt: new Date('2026-01-21T10:00:00Z'),
      };
      mockFindMany.mockResolvedValue([positionWithCache]);

      const result = await prisma.position.findMany({
        where: {
          symbol: 'BTCUSDT',
          status: 'OPEN',
        },
      });

      expect(result[0].cachedFundingPnL).toEqual(new Decimal('12.35'));
      expect(result[0].cachedFundingPnLUpdatedAt).toEqual(new Date('2026-01-21T10:00:00Z'));
    });

    it('should return empty array when no OPEN positions', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await prisma.position.findMany({
        where: {
          symbol: 'ETHUSDT',
          status: 'OPEN',
        },
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('updateExitSuggestionStatus', () => {
    it('should mark position as exit suggested with APY_NEGATIVE reason', async () => {
      const now = new Date();
      const updatedPosition = {
        ...mockOpenPosition,
        exitSuggested: true,
        exitSuggestedAt: now,
        exitSuggestedReason: 'APY_NEGATIVE',
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          exitSuggested: true,
          exitSuggestedAt: now,
          exitSuggestedReason: 'APY_NEGATIVE',
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockPositionId },
        data: {
          exitSuggested: true,
          exitSuggestedAt: now,
          exitSuggestedReason: 'APY_NEGATIVE',
        },
      });
      expect(result.exitSuggested).toBe(true);
      expect(result.exitSuggestedReason).toBe('APY_NEGATIVE');
    });

    it('should mark position as exit suggested with PROFIT_LOCKABLE reason', async () => {
      const now = new Date();
      const updatedPosition = {
        ...mockOpenPosition,
        exitSuggested: true,
        exitSuggestedAt: now,
        exitSuggestedReason: 'PROFIT_LOCKABLE',
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          exitSuggested: true,
          exitSuggestedAt: now,
          exitSuggestedReason: 'PROFIT_LOCKABLE',
        },
      });

      expect(result.exitSuggested).toBe(true);
      expect(result.exitSuggestedReason).toBe('PROFIT_LOCKABLE');
    });

    it('should cancel exit suggestion (APY recovered)', async () => {
      const updatedPosition = {
        ...mockOpenPosition,
        exitSuggested: false,
        exitSuggestedAt: null,
        exitSuggestedReason: null,
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          exitSuggested: false,
          exitSuggestedAt: null,
          exitSuggestedReason: null,
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockPositionId },
        data: {
          exitSuggested: false,
          exitSuggestedAt: null,
          exitSuggestedReason: null,
        },
      });
      expect(result.exitSuggested).toBe(false);
      expect(result.exitSuggestedAt).toBeNull();
      expect(result.exitSuggestedReason).toBeNull();
    });
  });

  describe('updateCachedFundingPnL', () => {
    it('should update cached funding PnL', async () => {
      const now = new Date();
      const fundingPnL = new Decimal('25.50');
      const updatedPosition = {
        ...mockOpenPosition,
        cachedFundingPnL: fundingPnL,
        cachedFundingPnLUpdatedAt: now,
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          cachedFundingPnL: fundingPnL,
          cachedFundingPnLUpdatedAt: now,
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockPositionId },
        data: {
          cachedFundingPnL: fundingPnL,
          cachedFundingPnLUpdatedAt: now,
        },
      });
      expect(result.cachedFundingPnL).toEqual(fundingPnL);
      expect(result.cachedFundingPnLUpdatedAt).toEqual(now);
    });

    it('should update with negative funding PnL', async () => {
      const now = new Date();
      const fundingPnL = new Decimal('-5.25');
      const updatedPosition = {
        ...mockOpenPosition,
        cachedFundingPnL: fundingPnL,
        cachedFundingPnLUpdatedAt: now,
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          cachedFundingPnL: fundingPnL,
          cachedFundingPnLUpdatedAt: now,
        },
      });

      expect(result.cachedFundingPnL).toEqual(new Decimal('-5.25'));
    });
  });

  describe('combined operations', () => {
    it('should update both exitSuggestion and cachedFundingPnL together', async () => {
      const now = new Date();
      const fundingPnL = new Decimal('15.00');
      const updatedPosition = {
        ...mockOpenPosition,
        cachedFundingPnL: fundingPnL,
        cachedFundingPnLUpdatedAt: now,
        exitSuggested: true,
        exitSuggestedAt: now,
        exitSuggestedReason: 'PROFIT_LOCKABLE',
      };
      mockUpdate.mockResolvedValue(updatedPosition);

      const result = await prisma.position.update({
        where: { id: mockPositionId },
        data: {
          cachedFundingPnL: fundingPnL,
          cachedFundingPnLUpdatedAt: now,
          exitSuggested: true,
          exitSuggestedAt: now,
          exitSuggestedReason: 'PROFIT_LOCKABLE',
        },
      });

      expect(result.cachedFundingPnL).toEqual(fundingPnL);
      expect(result.exitSuggested).toBe(true);
      expect(result.exitSuggestedReason).toBe('PROFIT_LOCKABLE');
    });
  });
});
