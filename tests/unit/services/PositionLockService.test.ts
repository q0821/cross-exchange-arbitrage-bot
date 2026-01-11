/**
 * Test: PositionLockService
 * Feature: 033-manual-open-position
 *
 * 測試分散式鎖服務功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock redis module before importing PositionLockService
vi.mock('@/lib/redis', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  isRedisConfigured: vi.fn(),
  getRedisClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { PositionLockService, type LockContext } from '@/services/trading/PositionLockService';
import { acquireLock, releaseLock, isRedisConfigured, getRedisClient } from '@/lib/redis';
import { LockConflictError } from '@/lib/errors/trading-errors';

describe('PositionLockService', () => {
  const mockAcquireLock = vi.mocked(acquireLock);
  const mockReleaseLock = vi.mocked(releaseLock);
  const mockIsRedisConfigured = vi.mocked(isRedisConfigured);
  const mockGetRedisClient = vi.mocked(getRedisClient);

  beforeEach(() => {
    vi.clearAllMocks();
    // 預設 Redis 已配置
    mockIsRedisConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('acquire', () => {
    it('should successfully acquire a lock', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context = await PositionLockService.acquire('user-123', 'BTCUSDT');

      expect(context).toBeDefined();
      expect(context.userId).toBe('user-123');
      expect(context.symbol).toBe('BTCUSDT');
      expect(context.key).toBe('position:open:user-123:BTCUSDT');
      expect(context.value).toBeDefined();
      expect(context.acquiredAt).toBeDefined();
      expect(context.isNoOp).toBeUndefined();
    });

    it('should call acquireLock with correct parameters', async () => {
      mockAcquireLock.mockResolvedValue(true);

      await PositionLockService.acquire('user-456', 'ETHUSDT');

      expect(mockAcquireLock).toHaveBeenCalledTimes(1);
      expect(mockAcquireLock).toHaveBeenCalledWith(
        'position:open:user-456:ETHUSDT',
        30, // TTL_SECONDS
        expect.any(String), // UUID value
      );
    });

    it('should throw LockConflictError when lock is already held', async () => {
      mockAcquireLock.mockResolvedValue(false);

      await expect(PositionLockService.acquire('user-123', 'BTCUSDT')).rejects.toThrow(
        LockConflictError,
      );
    });

    it('should throw LockConflictError with correct properties', async () => {
      mockAcquireLock.mockResolvedValue(false);

      try {
        await PositionLockService.acquire('user-789', 'XRPUSDT');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LockConflictError);
        expect((error as LockConflictError).userId).toBe('user-789');
        expect((error as LockConflictError).symbol).toBe('XRPUSDT');
        expect((error as LockConflictError).code).toBe('LOCK_CONFLICT');
        expect((error as LockConflictError).retryable).toBe(true);
      }
    });

    it('should return no-op lock when Redis is not configured', async () => {
      mockIsRedisConfigured.mockReturnValue(false);

      const context = await PositionLockService.acquire('user-123', 'BTCUSDT');

      expect(context.isNoOp).toBe(true);
      expect(context.userId).toBe('user-123');
      expect(context.symbol).toBe('BTCUSDT');
      expect(mockAcquireLock).not.toHaveBeenCalled();
    });

    it('should generate unique lock keys for different user-symbol combinations', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context1 = await PositionLockService.acquire('user-1', 'BTCUSDT');
      const context2 = await PositionLockService.acquire('user-2', 'BTCUSDT');
      const context3 = await PositionLockService.acquire('user-1', 'ETHUSDT');

      expect(context1.key).toBe('position:open:user-1:BTCUSDT');
      expect(context2.key).toBe('position:open:user-2:BTCUSDT');
      expect(context3.key).toBe('position:open:user-1:ETHUSDT');
    });

    it('should generate unique values (UUIDs) for each lock', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context1 = await PositionLockService.acquire('user-1', 'BTCUSDT');
      const context2 = await PositionLockService.acquire('user-1', 'BTCUSDT');

      expect(context1.value).not.toBe(context2.value);
    });
  });

  describe('release', () => {
    it('should successfully release a lock', async () => {
      mockReleaseLock.mockResolvedValue(true);

      const context: LockContext = {
        key: 'position:open:user-123:BTCUSDT',
        value: 'test-uuid',
        userId: 'user-123',
        symbol: 'BTCUSDT',
        acquiredAt: Date.now() - 1000,
      };

      const result = await PositionLockService.release(context);

      expect(result).toBe(true);
      expect(mockReleaseLock).toHaveBeenCalledWith('position:open:user-123:BTCUSDT', 'test-uuid');
    });

    it('should return false when lock release fails', async () => {
      mockReleaseLock.mockResolvedValue(false);

      const context: LockContext = {
        key: 'position:open:user-123:BTCUSDT',
        value: 'test-uuid',
        userId: 'user-123',
        symbol: 'BTCUSDT',
        acquiredAt: Date.now() - 1000,
      };

      const result = await PositionLockService.release(context);

      expect(result).toBe(false);
    });

    it('should return true for no-op lock without calling releaseLock', async () => {
      const context: LockContext = {
        key: 'position:open:user-123:BTCUSDT',
        value: 'test-uuid',
        userId: 'user-123',
        symbol: 'BTCUSDT',
        acquiredAt: Date.now() - 1000,
        isNoOp: true,
      };

      const result = await PositionLockService.release(context);

      expect(result).toBe(true);
      expect(mockReleaseLock).not.toHaveBeenCalled();
    });

    it('should pass correct key and value to releaseLock', async () => {
      mockReleaseLock.mockResolvedValue(true);

      const context: LockContext = {
        key: 'position:open:user-456:ETHUSDT',
        value: 'specific-uuid-value',
        userId: 'user-456',
        symbol: 'ETHUSDT',
        acquiredAt: Date.now(),
      };

      await PositionLockService.release(context);

      expect(mockReleaseLock).toHaveBeenCalledWith(
        'position:open:user-456:ETHUSDT',
        'specific-uuid-value',
      );
    });
  });

  describe('isLocked', () => {
    it('should return true when key exists in Redis', async () => {
      const mockRedisGet = vi.fn().mockResolvedValue('some-lock-value');
      mockGetRedisClient.mockReturnValue({ get: mockRedisGet } as any);

      const result = await PositionLockService.isLocked('user-123', 'BTCUSDT');

      expect(result).toBe(true);
      expect(mockRedisGet).toHaveBeenCalledWith('position:open:user-123:BTCUSDT');
    });

    it('should return false when key does not exist in Redis', async () => {
      const mockRedisGet = vi.fn().mockResolvedValue(null);
      mockGetRedisClient.mockReturnValue({ get: mockRedisGet } as any);

      const result = await PositionLockService.isLocked('user-123', 'BTCUSDT');

      expect(result).toBe(false);
    });

    it('should return false when Redis throws an error', async () => {
      const mockRedisGet = vi.fn().mockRejectedValue(new Error('Redis connection error'));
      mockGetRedisClient.mockReturnValue({ get: mockRedisGet } as any);

      const result = await PositionLockService.isLocked('user-123', 'BTCUSDT');

      expect(result).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should acquire lock, execute operation, and release lock', async () => {
      mockAcquireLock.mockResolvedValue(true);
      mockReleaseLock.mockResolvedValue(true);

      const operation = vi.fn().mockResolvedValue('operation-result');

      const result = await PositionLockService.withLock('user-123', 'BTCUSDT', operation);

      expect(result).toBe('operation-result');
      expect(mockAcquireLock).toHaveBeenCalledTimes(1);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockReleaseLock).toHaveBeenCalledTimes(1);
    });

    it('should pass lock context to operation', async () => {
      mockAcquireLock.mockResolvedValue(true);
      mockReleaseLock.mockResolvedValue(true);

      const operation = vi.fn().mockImplementation((context: LockContext) => {
        expect(context.userId).toBe('user-123');
        expect(context.symbol).toBe('BTCUSDT');
        expect(context.key).toBe('position:open:user-123:BTCUSDT');
        return Promise.resolve('done');
      });

      await PositionLockService.withLock('user-123', 'BTCUSDT', operation);

      expect(operation).toHaveBeenCalled();
    });

    it('should release lock even when operation throws', async () => {
      mockAcquireLock.mockResolvedValue(true);
      mockReleaseLock.mockResolvedValue(true);

      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        PositionLockService.withLock('user-123', 'BTCUSDT', operation),
      ).rejects.toThrow('Operation failed');

      expect(mockAcquireLock).toHaveBeenCalledTimes(1);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockReleaseLock).toHaveBeenCalledTimes(1);
    });

    it('should propagate LockConflictError when acquire fails', async () => {
      mockAcquireLock.mockResolvedValue(false);

      const operation = vi.fn().mockResolvedValue('should not be called');

      await expect(
        PositionLockService.withLock('user-123', 'BTCUSDT', operation),
      ).rejects.toThrow(LockConflictError);

      expect(operation).not.toHaveBeenCalled();
      expect(mockReleaseLock).not.toHaveBeenCalled();
    });

    it('should work with async operations that take time', async () => {
      mockAcquireLock.mockResolvedValue(true);
      mockReleaseLock.mockResolvedValue(true);

      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'delayed-result';
      });

      const result = await PositionLockService.withLock('user-123', 'BTCUSDT', operation);

      expect(result).toBe('delayed-result');
      expect(mockReleaseLock).toHaveBeenCalled();
    });

    it('should handle complex return types', async () => {
      mockAcquireLock.mockResolvedValue(true);
      mockReleaseLock.mockResolvedValue(true);

      interface ComplexResult {
        orderId: string;
        price: number;
        timestamp: Date;
      }

      const expectedResult: ComplexResult = {
        orderId: 'order-123',
        price: 50000,
        timestamp: new Date(),
      };

      const operation = vi.fn().mockResolvedValue(expectedResult);

      const result = await PositionLockService.withLock<ComplexResult>(
        'user-123',
        'BTCUSDT',
        operation,
      );

      expect(result).toEqual(expectedResult);
    });
  });

  describe('lock key generation', () => {
    it('should generate consistent keys for same user-symbol combination', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context1 = await PositionLockService.acquire('user-abc', 'BTCUSDT');
      const context2 = await PositionLockService.acquire('user-abc', 'BTCUSDT');

      expect(context1.key).toBe(context2.key);
    });

    it('should handle special characters in symbol', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context = await PositionLockService.acquire('user-123', 'BTC/USDT:USDT');

      expect(context.key).toBe('position:open:user-123:BTC/USDT:USDT');
    });

    it('should handle UUIDs as userId', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const context = await PositionLockService.acquire(uuid, 'BTCUSDT');

      expect(context.key).toBe(`position:open:${uuid}:BTCUSDT`);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string userId', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context = await PositionLockService.acquire('', 'BTCUSDT');

      expect(context.key).toBe('position:open::BTCUSDT');
    });

    it('should handle empty string symbol', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const context = await PositionLockService.acquire('user-123', '');

      expect(context.key).toBe('position:open:user-123:');
    });

    it('should record accurate acquiredAt timestamp', async () => {
      mockAcquireLock.mockResolvedValue(true);

      const beforeTime = Date.now();
      const context = await PositionLockService.acquire('user-123', 'BTCUSDT');
      const afterTime = Date.now();

      expect(context.acquiredAt).toBeGreaterThanOrEqual(beforeTime);
      expect(context.acquiredAt).toBeLessThanOrEqual(afterTime);
    });
  });
});
