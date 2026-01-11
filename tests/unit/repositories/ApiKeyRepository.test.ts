/**
 * Test: ApiKeyRepository
 *
 * API Key Repository 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyRepository } from '@/repositories/ApiKeyRepository';
import { ApiKey } from '@models/ApiKey';
import { DatabaseError, NotFoundError } from '@lib/errors';

// Mock logger
vi.mock('@lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

describe('ApiKeyRepository', () => {
  let repository: ApiKeyRepository;
  let mockPrisma: any;

  const mockApiKeyData = {
    id: 'apikey-123',
    userId: 'user-123',
    exchange: 'binance',
    environment: 'MAINNET',
    label: 'my-key',
    encryptedKey: 'encrypted-key',
    encryptedSecret: 'encrypted-secret',
    encryptedPassphrase: null,
    isActive: true,
    lastValidatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      apiKey: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    repository = new ApiKeyRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should return ApiKey when found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKeyData);

      const result = await repository.findById('apikey-123');

      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
      });
      expect(result).toBeInstanceOf(ApiKey);
      expect(result?.id).toBe('apikey-123');
    });

    it('should return null when not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.apiKey.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repository.findById('apikey-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByUserId', () => {
    it('should return array of ApiKeys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKeyData, { ...mockApiKeyData, id: 'apikey-456' }]);

      const result = await repository.findByUserId('user-123');

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(ApiKey);
    });

    it('should return empty array when no keys found', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await repository.findByUserId('user-no-keys');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.apiKey.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repository.findByUserId('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByUserIdAndExchange', () => {
    it('should return ApiKeys for specific exchange', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKeyData]);

      const result = await repository.findByUserIdAndExchange('user-123', 'BINANCE');

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          exchange: 'binance', // Should be lowercased
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should lowercase exchange name', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      await repository.findByUserIdAndExchange('user-123', 'OKX');

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            exchange: 'okx',
          }),
        }),
      );
    });
  });

  describe('findByUserIdExchangeAndLabel', () => {
    it('should return ApiKey when found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKeyData);

      const result = await repository.findByUserIdExchangeAndLabel('user-123', 'BINANCE', 'my-key');

      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: {
          userId_exchange_label: {
            userId: 'user-123',
            exchange: 'binance',
            label: 'my-key',
          },
        },
      });
      expect(result).toBeInstanceOf(ApiKey);
    });

    it('should return null when not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await repository.findByUserIdExchangeAndLabel('user-123', 'binance', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create ApiKey successfully', async () => {
      mockPrisma.apiKey.create.mockResolvedValue(mockApiKeyData);

      const createData = {
        userId: 'user-123',
        exchange: 'BINANCE',
        environment: 'MAINNET' as const,
        label: 'my-key',
        encryptedKey: 'encrypted-key',
        encryptedSecret: 'encrypted-secret',
      };

      const result = await repository.create(createData);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          exchange: 'binance',
          environment: 'MAINNET',
          label: 'my-key',
          encryptedKey: 'encrypted-key',
          encryptedSecret: 'encrypted-secret',
          encryptedPassphrase: undefined,
        },
      });
      expect(result).toBeInstanceOf(ApiKey);
    });

    it('should create ApiKey with passphrase', async () => {
      const dataWithPassphrase = { ...mockApiKeyData, encryptedPassphrase: 'encrypted-pass' };
      mockPrisma.apiKey.create.mockResolvedValue(dataWithPassphrase);

      const createData = {
        userId: 'user-123',
        exchange: 'okx',
        environment: 'MAINNET' as const,
        label: 'okx-key',
        encryptedKey: 'encrypted-key',
        encryptedSecret: 'encrypted-secret',
        encryptedPassphrase: 'encrypted-pass',
      };

      await repository.create(createData);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          encryptedPassphrase: 'encrypted-pass',
        }),
      });
    });

    it('should throw DatabaseError on unique constraint violation', async () => {
      mockPrisma.apiKey.create.mockRejectedValue(new Error('Unique constraint failed'));

      const createData = {
        userId: 'user-123',
        exchange: 'binance',
        environment: 'MAINNET' as const,
        label: 'existing-key',
        encryptedKey: 'key',
        encryptedSecret: 'secret',
      };

      await expect(repository.create(createData)).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on other database errors', async () => {
      mockPrisma.apiKey.create.mockRejectedValue(new Error('Connection failed'));

      const createData = {
        userId: 'user-123',
        exchange: 'binance',
        environment: 'MAINNET' as const,
        label: 'new-key',
        encryptedKey: 'key',
        encryptedSecret: 'secret',
      };

      await expect(repository.create(createData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update ApiKey successfully', async () => {
      const updatedData = { ...mockApiKeyData, isActive: false };
      mockPrisma.apiKey.update.mockResolvedValue(updatedData);

      const result = await repository.update('apikey-123', { isActive: false });

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
        data: { isActive: false },
      });
      expect(result).toBeInstanceOf(ApiKey);
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundError when record not found', async () => {
      mockPrisma.apiKey.update.mockRejectedValue(new Error('Record to update not found'));

      await expect(repository.update('nonexistent', { isActive: false })).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      mockPrisma.apiKey.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.update('apikey-123', { isActive: false })).rejects.toThrow(DatabaseError);
    });
  });

  describe('markAsValidated', () => {
    it('should update lastValidatedAt', async () => {
      const now = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockPrisma.apiKey.update.mockResolvedValue({
        ...mockApiKeyData,
        lastValidatedAt: now,
      });

      const result = await repository.markAsValidated('apikey-123');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
        data: { lastValidatedAt: now },
      });
      expect(result.lastValidatedAt).toEqual(now);

      vi.useRealTimers();
    });
  });

  describe('setActive', () => {
    it('should enable ApiKey', async () => {
      mockPrisma.apiKey.update.mockResolvedValue({ ...mockApiKeyData, isActive: true });

      const result = await repository.setActive('apikey-123', true);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('should disable ApiKey', async () => {
      mockPrisma.apiKey.update.mockResolvedValue({ ...mockApiKeyData, isActive: false });

      const result = await repository.setActive('apikey-123', false);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete ApiKey successfully', async () => {
      mockPrisma.apiKey.delete.mockResolvedValue(mockApiKeyData);

      await repository.delete('apikey-123');

      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'apikey-123' },
      });
    });

    it('should throw NotFoundError when record not found', async () => {
      mockPrisma.apiKey.delete.mockRejectedValue(new Error('Record to delete does not exist'));

      await expect(repository.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      mockPrisma.apiKey.delete.mockRejectedValue(new Error('DB error'));

      await expect(repository.delete('apikey-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAllActive', () => {
    it('should return all active ApiKeys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        mockApiKeyData,
        { ...mockApiKeyData, id: 'apikey-456' },
      ]);

      const result = await repository.findAllActive();

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      result.forEach((key) => expect(key).toBeInstanceOf(ApiKey));
    });

    it('should return empty array when no active keys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.apiKey.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repository.findAllActive()).rejects.toThrow(DatabaseError);
    });
  });
});
