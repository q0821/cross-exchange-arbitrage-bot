/**
 * Test: TradingSettingsRepository
 *
 * 交易設定 Repository 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockFindUnique, mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    tradingSettings: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

// Import after mocks
import { TradingSettingsRepository, tradingSettingsRepository } from '@/repositories/TradingSettingsRepository';

describe('TradingSettingsRepository', () => {
  let repository: TradingSettingsRepository;

  const mockUserId = 'user-123';
  const mockSettings = {
    id: 'settings-123',
    userId: mockUserId,
    defaultStopLossEnabled: true,
    defaultStopLossPercent: 5.0,
    defaultTakeProfitEnabled: false,
    defaultTakeProfitPercent: 3.0,
    defaultLeverage: 1,
    maxPositionSizeUSD: 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TradingSettingsRepository();
  });

  describe('getOrCreate', () => {
    it('should return existing settings if found', async () => {
      mockFindUnique.mockResolvedValue(mockSettings);

      const result = await repository.getOrCreate(mockUserId);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });

    it('should create default settings if not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockSettings);

      const result = await repository.getOrCreate(mockUserId);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          defaultStopLossEnabled: true,
          defaultStopLossPercent: 5.0,
          defaultTakeProfitEnabled: false,
          defaultTakeProfitPercent: 3.0,
          defaultLeverage: 1,
          maxPositionSizeUSD: 10000,
        },
      });
      expect(result).toEqual(mockSettings);
    });
  });

  describe('findByUserId', () => {
    it('should return settings when found', async () => {
      mockFindUnique.mockResolvedValue(mockSettings);

      const result = await repository.findByUserId(mockUserId);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result).toEqual(mockSettings);
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByUserId(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing settings', async () => {
      const updateData = {
        defaultStopLossPercent: 10.0,
        defaultTakeProfitEnabled: true,
      };
      const updatedSettings = { ...mockSettings, ...updateData };

      mockFindUnique.mockResolvedValue(mockSettings);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: updateData,
      });
      expect(result).toEqual(updatedSettings);
    });

    it('should create settings first if not exists', async () => {
      const updateData = { defaultStopLossPercent: 10.0 };
      const updatedSettings = { ...mockSettings, ...updateData };

      // First call to findUnique (in getOrCreate) returns null
      mockFindUnique.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValue(mockSettings);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedSettings);
    });
  });

  describe('create', () => {
    it('should create settings with default values', async () => {
      mockCreate.mockResolvedValue(mockSettings);

      const result = await repository.create(mockUserId);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          defaultStopLossEnabled: true,
          defaultStopLossPercent: 5.0,
          defaultTakeProfitEnabled: false,
          defaultTakeProfitPercent: 3.0,
          defaultLeverage: 1,
          maxPositionSizeUSD: 10000,
        },
      });
      expect(result).toEqual(mockSettings);
    });

    it('should create settings with custom values', async () => {
      const customData = {
        defaultStopLossPercent: 7.5,
        defaultLeverage: 3,
      };
      const customSettings = { ...mockSettings, ...customData };
      mockCreate.mockResolvedValue(customSettings);

      const result = await repository.create(mockUserId, customData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          defaultStopLossEnabled: true,
          defaultStopLossPercent: 7.5,
          defaultTakeProfitEnabled: false,
          defaultTakeProfitPercent: 3.0,
          defaultLeverage: 3,
          maxPositionSizeUSD: 10000,
        },
      });
      expect(result).toEqual(customSettings);
    });
  });

  describe('delete', () => {
    it('should delete settings', async () => {
      mockDelete.mockResolvedValue(mockSettings);

      await repository.delete(mockUserId);

      expect(mockDelete).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });
  });

  describe('toApiType', () => {
    it('should convert Prisma model to API type', () => {
      const result = repository.toApiType(mockSettings as any);

      expect(result).toEqual({
        defaultStopLossEnabled: true,
        defaultStopLossPercent: 5.0,
        defaultTakeProfitEnabled: false,
        defaultTakeProfitPercent: 3.0,
        defaultLeverage: 1,
        maxPositionSizeUSD: 10000,
      });
    });

    it('should handle Decimal-like objects (using Number() conversion)', () => {
      // The actual implementation uses Number() which calls valueOf() internally
      const settingsWithDecimal = {
        ...mockSettings,
        defaultStopLossPercent: { valueOf: () => 5.5 },
        defaultTakeProfitPercent: { valueOf: () => 3.5 },
        maxPositionSizeUSD: { valueOf: () => 15000 },
      };

      const result = repository.toApiType(settingsWithDecimal as any);

      expect(result.defaultStopLossPercent).toBe(5.5);
      expect(result.defaultTakeProfitPercent).toBe(3.5);
      expect(result.maxPositionSizeUSD).toBe(15000);
    });
  });

  describe('getDefaults', () => {
    it('should return default trading settings', () => {
      const defaults = repository.getDefaults();

      expect(defaults).toEqual({
        defaultStopLossEnabled: true,
        defaultStopLossPercent: 5.0,
        defaultTakeProfitEnabled: false,
        defaultTakeProfitPercent: 3.0,
        defaultLeverage: 1,
        maxPositionSizeUSD: 10000,
      });
    });

    it('should return a new object each time', () => {
      const defaults1 = repository.getDefaults();
      const defaults2 = repository.getDefaults();

      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(tradingSettingsRepository).toBeInstanceOf(TradingSettingsRepository);
    });
  });
});
