/**
 * AdminTradeService Unit Tests (Feature 068)
 *
 * T042: Unit test for AdminTradeService.getUserPositions()
 * T043: Unit test for AdminTradeService.exportUserTrades()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';

// Mock logger
vi.mock('@lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Define mock functions inside vi.mock to avoid hoisting issues
vi.mock('@lib/db', () => {
  const mockPositionFindMany = vi.fn();
  const mockPositionCount = vi.fn();
  const mockUserFindUnique = vi.fn();
  const mockTradeFindMany = vi.fn();
  const mockTradeCount = vi.fn();

  return {
    prisma: {
      position: {
        findMany: mockPositionFindMany,
        count: mockPositionCount,
      },
      user: {
        findUnique: mockUserFindUnique,
      },
      trade: {
        findMany: mockTradeFindMany,
        count: mockTradeCount,
      },
    },
    __mocks: {
      mockPositionFindMany,
      mockPositionCount,
      mockUserFindUnique,
      mockTradeFindMany,
      mockTradeCount,
    },
  };
});

// Import after mocks
import { AdminTradeService, UserNotFoundError } from '@services/admin/AdminTradeService';
import { __mocks } from '@lib/db';

const {
  mockPositionFindMany,
  mockPositionCount,
  mockUserFindUnique,
  mockTradeFindMany,
  mockTradeCount,
} = __mocks as {
  mockPositionFindMany: ReturnType<typeof vi.fn>;
  mockPositionCount: ReturnType<typeof vi.fn>;
  mockUserFindUnique: ReturnType<typeof vi.fn>;
  mockTradeFindMany: ReturnType<typeof vi.fn>;
  mockTradeCount: ReturnType<typeof vi.fn>;
};

describe('AdminTradeService (Feature 068)', () => {
  let service: AdminTradeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminTradeService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // T042: getUserPositions
  // ===========================================================================

  describe('getUserPositions (T042)', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'USER',
      isActive: true,
    };

    const mockPositions = [
      {
        id: 'pos-1',
        userId: 'user-123',
        symbol: 'BTCUSDT',
        status: 'OPEN',
        longExchange: 'binance',
        longEntryPrice: new Decimal('45000.00'),
        longPositionSize: new Decimal('0.1'),
        longLeverage: 3,
        shortExchange: 'okx',
        shortEntryPrice: new Decimal('45050.00'),
        shortPositionSize: new Decimal('0.1'),
        shortLeverage: 3,
        openFundingRateLong: new Decimal('0.0001'),
        openFundingRateShort: new Decimal('-0.0002'),
        stopLossEnabled: false,
        stopLossPercent: null,
        takeProfitEnabled: false,
        takeProfitPercent: null,
        openedAt: new Date('2024-01-15T10:00:00Z'),
        closedAt: null,
        createdAt: new Date('2024-01-15T09:55:00Z'),
        user: mockUser,
        trade: null,
      },
      {
        id: 'pos-2',
        userId: 'user-123',
        symbol: 'ETHUSDT',
        status: 'CLOSED',
        longExchange: 'okx',
        longEntryPrice: new Decimal('2500.00'),
        longPositionSize: new Decimal('1.0'),
        longLeverage: 2,
        shortExchange: 'binance',
        shortEntryPrice: new Decimal('2510.00'),
        shortPositionSize: new Decimal('1.0'),
        shortLeverage: 2,
        openFundingRateLong: new Decimal('0.0003'),
        openFundingRateShort: new Decimal('-0.0001'),
        stopLossEnabled: true,
        stopLossPercent: new Decimal('5.00'),
        takeProfitEnabled: true,
        takeProfitPercent: new Decimal('10.00'),
        openedAt: new Date('2024-01-10T08:00:00Z'),
        closedAt: new Date('2024-01-12T16:00:00Z'),
        createdAt: new Date('2024-01-10T07:55:00Z'),
        user: mockUser,
        trade: {
          id: 'trade-1',
          longExitPrice: new Decimal('2550.00'),
          shortExitPrice: new Decimal('2540.00'),
          priceDiffPnL: new Decimal('40.00'),
          fundingRatePnL: new Decimal('5.00'),
          totalPnL: new Decimal('45.00'),
          roi: new Decimal('1.80'),
          holdingDuration: 201600, // 56 hours in seconds
        },
      },
    ];

    it('should return paginated positions for a user', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue(mockPositions);
      mockPositionCount.mockResolvedValue(2);

      // Act
      const result = await service.getUserPositions('user-123', {
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.positions).toHaveLength(2);
    });

    it('should return positions with openFundingRateLong and openFundingRateShort', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue([mockPositions[0]]);
      mockPositionCount.mockResolvedValue(1);

      // Act
      const result = await service.getUserPositions('user-123', {});

      // Assert
      const position = result.positions[0];
      expect(position.openFundingRateLong).toBe('0.0001');
      expect(position.openFundingRateShort).toBe('-0.0002');
    });

    it('should include trade data for closed positions', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue([mockPositions[1]]);
      mockPositionCount.mockResolvedValue(1);

      // Act
      const result = await service.getUserPositions('user-123', { status: 'closed' });

      // Assert
      const position = result.positions[0];
      expect(position.status).toBe('CLOSED');
      expect(position.trade).toBeDefined();
      expect(position.trade?.totalPnL).toBe('45');
      expect(position.trade?.roi).toBe('1.8');
    });

    it('should filter by status when specified', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue([mockPositions[0]]);
      mockPositionCount.mockResolvedValue(1);

      // Act
      await service.getUserPositions('user-123', { status: 'open' });

      // Assert
      expect(mockPositionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['OPEN', 'OPENING'] },
          }),
        })
      );
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserPositions('non-existent', {})).rejects.toThrow(UserNotFoundError);
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue([mockPositions[0]]);
      mockPositionCount.mockResolvedValue(25);

      // Act
      const result = await service.getUserPositions('user-123', { page: 2, limit: 10 });

      // Assert
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockPositionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should include user email in position details', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockPositionFindMany.mockResolvedValue([mockPositions[0]]);
      mockPositionCount.mockResolvedValue(1);

      // Act
      const result = await service.getUserPositions('user-123', {});

      // Assert
      expect(result.positions[0].userEmail).toBe('test@example.com');
    });
  });

  // ===========================================================================
  // T043: exportUserTrades
  // ===========================================================================

  describe('exportUserTrades (T043)', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'USER',
      isActive: true,
    };

    const mockTrades = [
      {
        id: 'trade-1',
        positionId: 'pos-1',
        userId: 'user-123',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longEntryPrice: new Decimal('45000.00'),
        shortEntryPrice: new Decimal('45050.00'),
        longExitPrice: new Decimal('46000.00'),
        shortExitPrice: new Decimal('45900.00'),
        longPositionSize: new Decimal('0.1'),
        shortPositionSize: new Decimal('0.1'),
        priceDiffPnL: new Decimal('85.00'),
        fundingRatePnL: new Decimal('10.00'),
        totalPnL: new Decimal('95.00'),
        roi: new Decimal('2.11'),
        holdingDuration: 86400, // 24 hours
        openedAt: new Date('2024-01-15T10:00:00Z'),
        closedAt: new Date('2024-01-16T10:00:00Z'),
        status: 'COMPLETED',
        user: mockUser,
        position: {
          openFundingRateLong: new Decimal('0.0001'),
          openFundingRateShort: new Decimal('-0.0002'),
        },
      },
      {
        id: 'trade-2',
        positionId: 'pos-2',
        userId: 'user-123',
        symbol: 'ETHUSDT',
        longExchange: 'okx',
        shortExchange: 'binance',
        longEntryPrice: new Decimal('2500.00'),
        shortEntryPrice: new Decimal('2510.00'),
        longExitPrice: new Decimal('2550.00'),
        shortExitPrice: new Decimal('2540.00'),
        longPositionSize: new Decimal('1.0'),
        shortPositionSize: new Decimal('1.0'),
        priceDiffPnL: new Decimal('40.00'),
        fundingRatePnL: new Decimal('5.00'),
        totalPnL: new Decimal('45.00'),
        roi: new Decimal('1.80'),
        holdingDuration: 201600,
        openedAt: new Date('2024-01-10T08:00:00Z'),
        closedAt: new Date('2024-01-12T16:00:00Z'),
        status: 'COMPLETED',
        user: mockUser,
        position: {
          openFundingRateLong: new Decimal('0.0003'),
          openFundingRateShort: new Decimal('-0.0001'),
        },
      },
    ];

    it('should export trades as CSV string', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockTradeFindMany.mockResolvedValue(mockTrades);

      // Act
      const csv = await service.exportUserTrades('user-123', {});

      // Assert
      expect(csv).toContain('Trade ID');
      expect(csv).toContain('Symbol');
      expect(csv).toContain('Total PnL');
      expect(csv).toContain('BTCUSDT');
      expect(csv).toContain('ETHUSDT');
    });

    it('should include open funding rates in CSV', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockTradeFindMany.mockResolvedValue(mockTrades);

      // Act
      const csv = await service.exportUserTrades('user-123', {});

      // Assert
      expect(csv).toContain('Open Funding Rate Long');
      expect(csv).toContain('Open Funding Rate Short');
      expect(csv).toContain('0.0001');
      expect(csv).toContain('-0.0002');
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.exportUserTrades('non-existent', {})).rejects.toThrow(UserNotFoundError);
    });

    it('should filter trades by date range', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);

      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-17T00:00:00Z');

      // Act
      await service.exportUserTrades('user-123', { startDate, endDate });

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            closedAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should return empty CSV with headers when no trades', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockTradeFindMany.mockResolvedValue([]);

      // Act
      const csv = await service.exportUserTrades('user-123', {});

      // Assert
      expect(csv).toContain('Trade ID');
      expect(csv.split('\n').length).toBe(1); // Header only (no data rows)
    });

    it('should format holding duration in hours', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);

      // Act
      const csv = await service.exportUserTrades('user-123', {});

      // Assert
      // 86400 seconds = 24 hours
      expect(csv).toContain('24'); // Duration in hours
    });
  });

  // ===========================================================================
  // T086: listAllTrades (Phase 9 - US8)
  // ===========================================================================

  describe('listAllTrades (T086)', () => {
    const mockTrades = [
      {
        id: 'trade-1',
        positionId: 'pos-1',
        userId: 'user-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longEntryPrice: new Decimal('45000.00'),
        shortEntryPrice: new Decimal('45050.00'),
        longExitPrice: new Decimal('46000.00'),
        shortExitPrice: new Decimal('45900.00'),
        positionSize: new Decimal('0.1'),
        priceDiffPnL: new Decimal('85.00'),
        fundingRatePnL: new Decimal('10.00'),
        totalPnL: new Decimal('95.00'),
        roi: new Decimal('2.11'),
        holdingDuration: 86400,
        openedAt: new Date('2024-01-15T10:00:00Z'),
        closedAt: new Date('2024-01-16T10:00:00Z'),
        status: 'COMPLETED',
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      },
      {
        id: 'trade-2',
        positionId: 'pos-2',
        userId: 'user-2',
        symbol: 'ETHUSDT',
        longExchange: 'okx',
        shortExchange: 'binance',
        longEntryPrice: new Decimal('2500.00'),
        shortEntryPrice: new Decimal('2510.00'),
        longExitPrice: new Decimal('2550.00'),
        shortExitPrice: new Decimal('2540.00'),
        positionSize: new Decimal('1.0'),
        priceDiffPnL: new Decimal('40.00'),
        fundingRatePnL: new Decimal('5.00'),
        totalPnL: new Decimal('45.00'),
        roi: new Decimal('1.80'),
        holdingDuration: 201600,
        openedAt: new Date('2024-01-10T08:00:00Z'),
        closedAt: new Date('2024-01-12T16:00:00Z'),
        status: 'COMPLETED',
        user: {
          id: 'user-2',
          email: 'user2@example.com',
        },
      },
    ];

    it('should return paginated trades for all users', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue(mockTrades);
      mockTradeCount.mockResolvedValue(2);

      // Act
      const result = await service.listAllTrades({ page: 1, limit: 20 });

      // Assert
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.items).toHaveLength(2);
    });

    it('should include user email in trade items', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue(mockTrades);
      mockTradeCount.mockResolvedValue(2);

      // Act
      const result = await service.listAllTrades({});

      // Assert
      expect(result.items[0].userEmail).toBe('user1@example.com');
      expect(result.items[1].userEmail).toBe('user2@example.com');
    });

    it('should filter by userId', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);
      mockTradeCount.mockResolvedValue(1);

      // Act
      await service.listAllTrades({ userId: 'user-1' });

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('should filter by symbol', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);
      mockTradeCount.mockResolvedValue(1);

      // Act
      await service.listAllTrades({ symbol: 'BTCUSDT' });

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: 'BTCUSDT',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);
      mockTradeCount.mockResolvedValue(1);

      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-17T00:00:00Z');

      // Act
      await service.listAllTrades({ startDate, endDate });

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            closedAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue([mockTrades[0]]);
      mockTradeCount.mockResolvedValue(50);

      // Act
      const result = await service.listAllTrades({ page: 2, limit: 10 });

      // Assert
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should sort by closedAt descending by default', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue(mockTrades);
      mockTradeCount.mockResolvedValue(2);

      // Act
      await service.listAllTrades({});

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { closedAt: 'desc' },
        })
      );
    });

    it('should support sorting by totalPnL', async () => {
      // Arrange
      mockTradeFindMany.mockResolvedValue(mockTrades);
      mockTradeCount.mockResolvedValue(2);

      // Act
      await service.listAllTrades({ sortBy: 'totalPnL', sortOrder: 'desc' });

      // Assert
      expect(mockTradeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalPnL: 'desc' },
        })
      );
    });
  });
});
