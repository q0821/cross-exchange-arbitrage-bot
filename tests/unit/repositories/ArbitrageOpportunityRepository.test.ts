/**
 * Test: ArbitrageOpportunityRepository
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 2 - Foundational (RED)
 * Task: T004 - Repository 單元測試骨架
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

// Mock Prisma
const { mockCreate, mockUpdate, mockFindFirst, mockFindMany, mockCount } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    arbitrageOpportunity: {
      create: mockCreate,
      update: mockUpdate,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

// Import after mocks
import { ArbitrageOpportunityRepository } from '@/repositories/ArbitrageOpportunityRepository';
import type {
  CreateOpportunityInput,
  UpdateOpportunityInput,
  UpsertOpportunityInput,
  PublicOpportunitiesOptions
} from '@/models/ArbitrageOpportunity';

describe('ArbitrageOpportunityRepository', () => {
  let repository: ArbitrageOpportunityRepository;

  const mockNow = new Date('2026-01-18T10:00:00.000Z');

  const mockOpportunity = {
    id: 'opp-123',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    status: 'ACTIVE' as const,
    detectedAt: mockNow,
    endedAt: null,
    durationMs: null,
    initialSpread: new Decimal('0.75'),
    maxSpread: new Decimal('0.75'),
    maxSpreadAt: mockNow,
    currentSpread: new Decimal('0.75'),
    initialAPY: new Decimal('273.75'),
    maxAPY: new Decimal('273.75'),
    currentAPY: new Decimal('273.75'),
    longIntervalHours: 8,
    shortIntervalHours: 8,
    createdAt: mockNow,
    updatedAt: mockNow,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ArbitrageOpportunityRepository();
  });

  describe('create()', () => {
    it('應該建立新的 ACTIVE 狀態機會記錄', async () => {
      const input: CreateOpportunityInput = {
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        initialSpread: 0.75,
        currentSpread: 0.75,
        initialAPY: 273.75,
        currentAPY: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      };

      mockCreate.mockResolvedValue(mockOpportunity);

      const result = await repository.create(input);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          status: 'ACTIVE',
          initialSpread: 0.75,
          maxSpread: 0.75,
          currentSpread: 0.75,
          initialAPY: 273.75,
          maxAPY: 273.75,
          currentAPY: 273.75,
          longIntervalHours: 8,
          shortIntervalHours: 8,
        }),
      });
      expect(result).toEqual(mockOpportunity);
    });
  });

  describe('findActiveByKey()', () => {
    it('應該根據 key 找到 ACTIVE 狀態的記錄', async () => {
      mockFindFirst.mockResolvedValue(mockOpportunity);

      const result = await repository.findActiveByKey('BTCUSDT', 'binance', 'okx');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          status: 'ACTIVE',
        },
      });
      expect(result).toEqual(mockOpportunity);
    });

    it('找不到記錄時應回傳 null', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await repository.findActiveByKey('ETHUSDT', 'gateio', 'binance');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    it('應該更新進行中的機會', async () => {
      const input: UpdateOpportunityInput = {
        currentSpread: 0.85,
        currentAPY: 310.25,
        maxSpread: 0.85,
        maxSpreadAt: new Date('2026-01-18T11:00:00.000Z'),
        maxAPY: 310.25,
      };

      const updated = { ...mockOpportunity, ...input };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.update('opp-123', input);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'opp-123' },
        data: input,
      });
      expect(result).toEqual(updated);
    });
  });

  describe('markAsEnded()', () => {
    it('應該將機會標記為 ENDED 狀態', async () => {
      const endedOpportunity = {
        ...mockOpportunity,
        status: 'ENDED' as const,
        endedAt: new Date('2026-01-18T12:00:00.000Z'),
        durationMs: BigInt(2 * 60 * 60 * 1000), // 2 hours
        currentSpread: new Decimal('0.48'),
        currentAPY: new Decimal('175.2'),
      };

      mockFindFirst.mockResolvedValue(mockOpportunity);
      mockUpdate.mockResolvedValue(endedOpportunity);

      const result = await repository.markAsEnded(
        'BTCUSDT',
        'binance',
        'okx',
        0.48,
        175.2
      );

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          status: 'ACTIVE',
        },
      });
      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(endedOpportunity);
    });

    it('找不到 ACTIVE 記錄時應回傳 null', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await repository.markAsEnded('ETHUSDT', 'gateio', 'binance', 0.5, 200);

      expect(result).toBeNull();
    });
  });

  describe('upsert()', () => {
    it('應該建立新記錄（若不存在）', async () => {
      const input: UpsertOpportunityInput = {
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      };

      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockOpportunity);

      const result = await repository.upsert(input);

      expect(mockFindFirst).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();
      expect(result).toEqual(mockOpportunity);
    });

    it('應該更新現有記錄（若已存在）', async () => {
      const input: UpsertOpportunityInput = {
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.85,
        apy: 310.25,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      };

      const updated = {
        ...mockOpportunity,
        currentSpread: new Decimal('0.85'),
        currentAPY: new Decimal('310.25'),
        maxSpread: new Decimal('0.85'),
        maxAPY: new Decimal('310.25'),
      };

      mockFindFirst.mockResolvedValue(mockOpportunity);
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.upsert(input);

      expect(mockFindFirst).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe('getPublicOpportunities()', () => {
    it('應該回傳分頁結果和總數', async () => {
      const options: PublicOpportunitiesOptions = {
        days: 7,
        page: 1,
        limit: 20,
        status: 'ENDED',
      };

      const opportunities = [mockOpportunity];
      mockFindMany.mockResolvedValue(opportunities);
      mockCount.mockResolvedValue(1);

      const result = await repository.getPublicOpportunities(options);

      expect(mockFindMany).toHaveBeenCalled();
      expect(mockCount).toHaveBeenCalled();
      expect(result.opportunities).toEqual(opportunities);
      expect(result.total).toBe(1);
    });

    it('空結果時應回傳空陣列', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await repository.getPublicOpportunities({});

      expect(result.opportunities).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findAllActiveBySymbol()', () => {
    it('應該找到指定 symbol 的所有 ACTIVE 記錄', async () => {
      const opportunities = [mockOpportunity];
      mockFindMany.mockResolvedValue(opportunities);

      const result = await repository.findAllActiveBySymbol('BTCUSDT');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          status: 'ACTIVE',
        },
      });
      expect(result).toEqual(opportunities);
    });
  });
});
