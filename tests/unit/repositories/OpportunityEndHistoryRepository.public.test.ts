import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { OpportunityEndHistoryRepository } from '@/repositories/OpportunityEndHistoryRepository';
import type { PublicOpportunityDTO } from '@/types/public-opportunity';

// Mock Prisma
const mockFindMany = vi.fn();
const mockCount = vi.fn();

const mockPrisma = {
  opportunityEndHistory: {
    findMany: mockFindMany,
    count: mockCount,
  },
} as unknown as PrismaClient;

describe('OpportunityEndHistoryRepository - findAllPublic', () => {
  let repository: OpportunityEndHistoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OpportunityEndHistoryRepository(mockPrisma);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('時間範圍篩選', () => {
    it('應正確過濾 7 天內的記錄', async () => {
      const now = new Date('2026-01-18T00:00:00Z');
      vi.setSystemTime(now);

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findAllPublic({ days: 7, page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            disappearedAt: {
              gte: new Date('2026-01-11T00:00:00Z'), // 7 天前
            },
          }),
        })
      );
    });

    it('應正確過濾 30 天內的記錄', async () => {
      const now = new Date('2026-01-18T00:00:00Z');
      vi.setSystemTime(now);

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findAllPublic({ days: 30, page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            disappearedAt: {
              gte: new Date('2025-12-19T00:00:00Z'), // 30 天前
            },
          }),
        })
      );
    });

    it('應正確過濾 90 天內的記錄', async () => {
      const now = new Date('2026-01-18T00:00:00Z');
      vi.setSystemTime(now);

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findAllPublic({ days: 90, page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            disappearedAt: {
              gte: new Date('2025-10-20T00:00:00Z'), // 90 天前
            },
          }),
        })
      );
    });
  });

  describe('分頁', () => {
    it('應正確處理第一頁（page=1, limit=20）', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(50);

      await repository.findAllPublic({ days: 90, page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (page - 1) * limit = 0
          take: 20,
        })
      );
    });

    it('應正確處理第二頁（page=2, limit=20）', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(50);

      await repository.findAllPublic({ days: 90, page: 2, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (2 - 1) * 20 = 20
          take: 20,
        })
      );
    });

    it('應正確處理自訂 limit', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      await repository.findAllPublic({ days: 90, page: 1, limit: 50 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });

    it('應按 disappearedAt DESC 排序', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findAllPublic({ days: 90, page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { disappearedAt: 'desc' },
        })
      );
    });
  });

  describe('去識別化（toPublicDTO）', () => {
    it('應排除 userId 和 notificationCount', async () => {
      const mockRecord = {
        id: 'hist-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        detectedAt: new Date('2026-01-17T10:00:00Z'),
        disappearedAt: new Date('2026-01-17T18:00:00Z'),
        durationMs: BigInt(8 * 60 * 60 * 1000), // 8 hours
        initialSpread: 0.0025,
        maxSpread: 0.0045,
        maxSpreadAt: new Date('2026-01-17T14:00:00Z'),
        finalSpread: 0.0015,
        longIntervalHours: 8,
        shortIntervalHours: 8,
        settlementRecords: [],
        longSettlementCount: 1,
        shortSettlementCount: 1,
        totalFundingProfit: 5.2,
        totalCost: 0.8,
        netProfit: 4.4,
        realizedAPY: 12.5,
        notificationCount: 3, // 應被排除
        userId: 'user-123', // 應被排除
        createdAt: new Date('2026-01-17T18:00:00Z'),
      };

      mockFindMany.mockResolvedValue([mockRecord]);
      mockCount.mockResolvedValue(1);

      const result = await repository.findAllPublic({ days: 90, page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      const publicDTO = result.data[0] as PublicOpportunityDTO & { userId?: string; notificationCount?: number };

      // 應包含的欄位
      expect(publicDTO.id).toBe('hist-1');
      expect(publicDTO.symbol).toBe('BTCUSDT');
      expect(publicDTO.longExchange).toBe('binance');
      expect(publicDTO.shortExchange).toBe('okx');
      expect(publicDTO.status).toBe('ENDED');
      expect(publicDTO.maxSpread).toBe(0.0045);
      expect(publicDTO.currentSpread).toBe(0.0015);
      expect(publicDTO.currentAPY).toBe(12.5);
      expect(publicDTO.durationMs).toBe(8 * 60 * 60 * 1000);
      expect(publicDTO.appearedAt).toEqual(new Date('2026-01-17T10:00:00Z'));
      expect(publicDTO.disappearedAt).toEqual(new Date('2026-01-17T18:00:00Z'));

      // 不應包含的欄位
      expect(publicDTO.userId).toBeUndefined();
      expect(publicDTO.notificationCount).toBeUndefined();
      expect(publicDTO).not.toHaveProperty('settlementRecords');
    });

    it('應正確處理多筆記錄', async () => {
      const mockRecords = [
        {
          id: 'hist-1',
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          detectedAt: new Date('2026-01-17T10:00:00Z'),
          disappearedAt: new Date('2026-01-17T18:00:00Z'),
          durationMs: BigInt(8 * 60 * 60 * 1000),
          initialSpread: 0.0025,
          maxSpread: 0.0045,
          maxSpreadAt: new Date('2026-01-17T14:00:00Z'),
          finalSpread: 0.0015,
          longIntervalHours: 8,
          shortIntervalHours: 8,
          settlementRecords: [],
          longSettlementCount: 1,
          shortSettlementCount: 1,
          totalFundingProfit: 5.2,
          totalCost: 0.8,
          netProfit: 4.4,
          realizedAPY: 12.5,
          notificationCount: 3,
          userId: 'user-123',
          createdAt: new Date('2026-01-17T18:00:00Z'),
        },
        {
          id: 'hist-2',
          symbol: 'ETHUSDT',
          longExchange: 'gateio',
          shortExchange: 'mexc',
          detectedAt: new Date('2026-01-16T10:00:00Z'),
          disappearedAt: new Date('2026-01-16T14:00:00Z'),
          durationMs: BigInt(4 * 60 * 60 * 1000),
          initialSpread: 0.0018,
          maxSpread: 0.0032,
          maxSpreadAt: new Date('2026-01-16T12:00:00Z'),
          finalSpread: 0.0008,
          longIntervalHours: 4,
          shortIntervalHours: 4,
          settlementRecords: [],
          longSettlementCount: 1,
          shortSettlementCount: 1,
          totalFundingProfit: 3.1,
          totalCost: 0.5,
          netProfit: 2.6,
          realizedAPY: 8.3,
          notificationCount: 1,
          userId: 'user-456',
          createdAt: new Date('2026-01-16T14:00:00Z'),
        },
      ];

      mockFindMany.mockResolvedValue(mockRecords);
      mockCount.mockResolvedValue(2);

      const result = await repository.findAllPublic({ days: 90, page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].symbol).toBe('BTCUSDT');
      expect(result.data[1].symbol).toBe('ETHUSDT');
    });
  });

  describe('回傳格式', () => {
    it('應回傳正確的分頁格式', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      const result = await repository.findAllPublic({ days: 90, page: 2, limit: 20 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.total).toBe(100);
    });
  });
});
