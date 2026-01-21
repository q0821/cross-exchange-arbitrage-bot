/**
 * Test: TradingSettingsRepository - Exit Suggestion Fields
 *
 * Feature 067: 持倉平倉建議監控
 * 測試 exitSuggestion 相關欄位的 Repository 操作
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockFindUnique, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    tradingSettings: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

// Import after mocks
import { TradingSettingsRepository } from '@/repositories/TradingSettingsRepository';

describe('TradingSettingsRepository - Exit Suggestion Fields (Feature 067)', () => {
  let repository: TradingSettingsRepository;

  const mockUserId = 'user-067-test';

  // Mock settings with exitSuggestion fields
  const mockSettingsWithExitSuggestion = {
    id: 'settings-067',
    userId: mockUserId,
    // Existing fields
    defaultStopLossEnabled: true,
    defaultStopLossPercent: 5.0,
    defaultTakeProfitEnabled: false,
    defaultTakeProfitPercent: 3.0,
    defaultLeverage: 1,
    maxPositionSizeUSD: 10000,
    // Feature 067: Exit Suggestion fields
    exitSuggestionEnabled: true,
    exitSuggestionThreshold: 100.0,
    exitNotificationEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TradingSettingsRepository();
  });

  describe('getOrCreate with exitSuggestion fields', () => {
    it('should return settings with exitSuggestion default values', async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockSettingsWithExitSuggestion);

      const result = await repository.getOrCreate(mockUserId);

      // Verify exitSuggestion fields are included in create
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          exitSuggestionEnabled: true,
          exitSuggestionThreshold: 100,
          exitNotificationEnabled: true,
        }),
      });
      expect(result.exitSuggestionEnabled).toBe(true);
      expect(result.exitSuggestionThreshold).toBe(100.0);
      expect(result.exitNotificationEnabled).toBe(true);
    });

    it('should return existing settings with exitSuggestion fields', async () => {
      const customSettings = {
        ...mockSettingsWithExitSuggestion,
        exitSuggestionEnabled: false,
        exitSuggestionThreshold: 50.0,
        exitNotificationEnabled: false,
      };
      mockFindUnique.mockResolvedValue(customSettings);

      const result = await repository.getOrCreate(mockUserId);

      expect(result.exitSuggestionEnabled).toBe(false);
      expect(result.exitSuggestionThreshold).toBe(50.0);
      expect(result.exitNotificationEnabled).toBe(false);
    });
  });

  describe('update exitSuggestion fields', () => {
    it('should update exitSuggestionEnabled', async () => {
      const updateData = { exitSuggestionEnabled: false };
      const updatedSettings = { ...mockSettingsWithExitSuggestion, ...updateData };

      mockFindUnique.mockResolvedValue(mockSettingsWithExitSuggestion);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { exitSuggestionEnabled: false },
      });
      expect(result.exitSuggestionEnabled).toBe(false);
    });

    it('should update exitSuggestionThreshold', async () => {
      const updateData = { exitSuggestionThreshold: 50.0 };
      const updatedSettings = { ...mockSettingsWithExitSuggestion, ...updateData };

      mockFindUnique.mockResolvedValue(mockSettingsWithExitSuggestion);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { exitSuggestionThreshold: 50.0 },
      });
      expect(result.exitSuggestionThreshold).toBe(50.0);
    });

    it('should update exitNotificationEnabled', async () => {
      const updateData = { exitNotificationEnabled: false };
      const updatedSettings = { ...mockSettingsWithExitSuggestion, ...updateData };

      mockFindUnique.mockResolvedValue(mockSettingsWithExitSuggestion);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { exitNotificationEnabled: false },
      });
      expect(result.exitNotificationEnabled).toBe(false);
    });

    it('should update all exitSuggestion fields at once', async () => {
      const updateData = {
        exitSuggestionEnabled: false,
        exitSuggestionThreshold: 200.0,
        exitNotificationEnabled: false,
      };
      const updatedSettings = { ...mockSettingsWithExitSuggestion, ...updateData };

      mockFindUnique.mockResolvedValue(mockSettingsWithExitSuggestion);
      mockUpdate.mockResolvedValue(updatedSettings);

      const result = await repository.update(mockUserId, updateData);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: updateData,
      });
      expect(result.exitSuggestionEnabled).toBe(false);
      expect(result.exitSuggestionThreshold).toBe(200.0);
      expect(result.exitNotificationEnabled).toBe(false);
    });
  });

  describe('toApiType with exitSuggestion fields', () => {
    it('should convert exitSuggestion fields to API type', () => {
      const result = repository.toApiType(mockSettingsWithExitSuggestion as any);

      expect(result.exitSuggestionEnabled).toBe(true);
      expect(result.exitSuggestionThreshold).toBe(100.0);
      expect(result.exitNotificationEnabled).toBe(true);
    });

    it('should handle Decimal exitSuggestionThreshold', () => {
      const settingsWithDecimal = {
        ...mockSettingsWithExitSuggestion,
        exitSuggestionThreshold: { valueOf: () => 75.5 },
      };

      const result = repository.toApiType(settingsWithDecimal as any);

      expect(result.exitSuggestionThreshold).toBe(75.5);
    });
  });

  describe('getDefaults with exitSuggestion fields', () => {
    it('should include exitSuggestion default values', () => {
      const defaults = repository.getDefaults();

      expect(defaults.exitSuggestionEnabled).toBe(true);
      expect(defaults.exitSuggestionThreshold).toBe(100);
      expect(defaults.exitNotificationEnabled).toBe(true);
    });
  });
});
