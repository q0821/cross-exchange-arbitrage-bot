/**
 * AdminDashboardService Unit Tests (Feature 068)
 *
 * T019: Unit test for AdminDashboardService
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma - must be defined inside vi.mock for hoisting
vi.mock('@lib/db', () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
    position: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    trade: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from '@lib/db';
import { AdminDashboardService } from '@services/admin/AdminDashboardService';

// Type-safe mock references
const mockPrisma = prisma as unknown as {
  user: { count: ReturnType<typeof vi.fn> };
  position: { count: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> };
  trade: { count: ReturnType<typeof vi.fn>; aggregate: ReturnType<typeof vi.fn> };
  auditLog: { count: ReturnType<typeof vi.fn> };
};

describe('AdminDashboardService (Feature 068)', () => {
  let service: AdminDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminDashboardService();
  });

  describe('getUserStats', () => {
    it('should return correct user statistics', async () => {
      // Arrange
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // active
        .mockResolvedValueOnce(15) // inactive
        .mockResolvedValueOnce(5); // todayNew

      mockPrisma.auditLog.count
        .mockResolvedValueOnce(50) // weekActive
        .mockResolvedValueOnce(70); // monthActive

      // Act
      const result = await service.getUserStats();

      // Assert
      expect(result).toEqual({
        total: 100,
        active: 85,
        inactive: 15,
        todayNew: 5,
        weekActive: 50,
        monthActive: 70,
      });
    });

    it('should return zero stats when no users exist', async () => {
      // Arrange
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      // Act
      const result = await service.getUserStats();

      // Assert
      expect(result).toEqual({
        total: 0,
        active: 0,
        inactive: 0,
        todayNew: 0,
        weekActive: 0,
        monthActive: 0,
      });
    });
  });

  describe('getPositionStats', () => {
    it('should return correct position statistics', async () => {
      // Arrange
      mockPrisma.position.count.mockResolvedValue(25);
      mockPrisma.position.groupBy.mockResolvedValue([
        { longExchange: 'binance', _count: { _all: 10 } },
        { longExchange: 'okx', _count: { _all: 8 } },
        { longExchange: 'gateio', _count: { _all: 7 } },
      ]);

      // Act
      const result = await service.getPositionStats();

      // Assert
      expect(result).toEqual({
        activeCount: 25,
        byExchange: {
          binance: 10,
          okx: 8,
          gateio: 7,
        },
      });
    });

    it('should return zero stats when no active positions exist', async () => {
      // Arrange
      mockPrisma.position.count.mockResolvedValue(0);
      mockPrisma.position.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getPositionStats();

      // Assert
      expect(result).toEqual({
        activeCount: 0,
        byExchange: {},
      });
    });
  });

  describe('getTradeStats', () => {
    it('should return correct trade statistics', async () => {
      // Arrange
      mockPrisma.trade.count
        .mockResolvedValueOnce(500) // closedCount
        .mockResolvedValueOnce(10); // todayCount

      mockPrisma.trade.aggregate
        .mockResolvedValueOnce({
          _sum: { totalPnL: { toNumber: () => 12500.50 } },
          _avg: { roi: { toNumber: () => 2.35 } },
        }) // all trades
        .mockResolvedValueOnce({
          _sum: { totalPnL: { toNumber: () => 350.25 } },
        }); // today trades

      // Act
      const result = await service.getTradeStats();

      // Assert
      expect(result).toEqual({
        closedCount: 500,
        totalPnL: '12500.50',
        averageROI: '2.35',
        todayCount: 10,
        todayPnL: '350.25',
      });
    });

    it('should return zero stats when no trades exist', async () => {
      // Arrange
      mockPrisma.trade.count.mockResolvedValue(0);
      mockPrisma.trade.aggregate.mockResolvedValue({
        _sum: { totalPnL: null },
        _avg: { roi: null },
      });

      // Act
      const result = await service.getTradeStats();

      // Assert
      expect(result).toEqual({
        closedCount: 0,
        totalPnL: '0.00',
        averageROI: '0.00',
        todayCount: 0,
        todayPnL: '0.00',
      });
    });
  });

  describe('getDashboardStats', () => {
    it('should return combined dashboard statistics', async () => {
      // Arrange
      // User stats
      mockPrisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(85)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(70);

      // Position stats
      mockPrisma.position.count.mockResolvedValue(25);
      mockPrisma.position.groupBy.mockResolvedValue([
        { longExchange: 'binance', _count: { _all: 15 } },
        { longExchange: 'okx', _count: { _all: 10 } },
      ]);

      // Trade stats
      mockPrisma.trade.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(10);
      mockPrisma.trade.aggregate
        .mockResolvedValueOnce({
          _sum: { totalPnL: { toNumber: () => 12500.50 } },
          _avg: { roi: { toNumber: () => 2.35 } },
        })
        .mockResolvedValueOnce({
          _sum: { totalPnL: { toNumber: () => 350.25 } },
        });

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('positions');
      expect(result).toHaveProperty('trades');
      expect(result.users.total).toBe(100);
      expect(result.positions.activeCount).toBe(25);
      expect(result.trades.closedCount).toBe(500);
    });
  });
});
