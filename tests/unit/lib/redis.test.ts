/**
 * Test: Redis Library
 *
 * 測試 Redis 工具函數：分散式鎖、快取、速率限制
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis instance methods - these must be defined before vi.mock
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDel = vi.fn();
const mockSetex = vi.fn();
const mockEval = vi.fn();
const mockZadd = vi.fn();
const mockZcard = vi.fn();
const mockZremrangebyscore = vi.fn();
const mockExpire = vi.fn();
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockOn = vi.fn();

// Create mock Redis instance
const mockRedisInstance = {
  set: mockSet,
  get: mockGet,
  del: mockDel,
  setex: mockSetex,
  eval: mockEval,
  zadd: mockZadd,
  zcard: mockZcard,
  zremrangebyscore: mockZremrangebyscore,
  expire: mockExpire,
  quit: mockQuit,
  on: mockOn,
};

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    default: function MockRedis() {
      return mockRedisInstance;
    },
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock env module
vi.mock('@/lib/env', () => ({
  isRedisConfigured: vi.fn(() => true),
  env: {
    REDIS_URL: '',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
  },
}));

// Import after mocks
import {
  isRedisConfigured,
  isRedisAvailable,
  setRedisAvailable,
  getRedisClient,
  closeRedisClient,
  acquireLock,
  releaseLock,
  checkRateLimit,
  getCached,
  setCached,
  deleteCached,
} from '@/lib/redis';
import { isRedisConfigured as envIsRedisConfigured } from '@/lib/env';

describe('Redis Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset availability state
    setRedisAvailable(true);
  });

  describe('isRedisConfigured', () => {
    it('should return true when Redis is configured', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(true);

      const result = isRedisConfigured();

      expect(result).toBe(true);
    });

    it('should return false when Redis is not configured', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(false);

      const result = isRedisConfigured();

      expect(result).toBe(false);
    });
  });

  describe('isRedisAvailable', () => {
    it('should return false when Redis is not configured', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(false);

      const result = isRedisAvailable();

      expect(result).toBe(false);
    });

    it('should return cached availability status when set to false', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(true);
      setRedisAvailable(false);

      const result = isRedisAvailable();

      expect(result).toBe(false);
    });

    it('should return true when configured and available', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(true);
      setRedisAvailable(true);

      const result = isRedisAvailable();

      expect(result).toBe(true);
    });
  });

  describe('setRedisAvailable', () => {
    it('should set availability to true', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(true);
      setRedisAvailable(true);

      expect(isRedisAvailable()).toBe(true);
    });

    it('should set availability to false', () => {
      vi.mocked(envIsRedisConfigured).mockReturnValue(true);
      setRedisAvailable(false);

      expect(isRedisAvailable()).toBe(false);
    });
  });

  describe('getRedisClient', () => {
    it('should create Redis client', () => {
      const client = getRedisClient();

      expect(client).toBeDefined();
    });

    it('should return same client instance on subsequent calls', () => {
      const client1 = getRedisClient();
      const client2 = getRedisClient();

      expect(client1).toBe(client2);
    });

    it('should have expected methods', () => {
      const client = getRedisClient();

      expect(client.set).toBeDefined();
      expect(client.get).toBeDefined();
      expect(client.del).toBeDefined();
      expect(client.on).toBeDefined();
    });
  });

  describe('closeRedisClient', () => {
    it('should close Redis connection gracefully', async () => {
      // Ensure client exists
      getRedisClient();

      await closeRedisClient();

      expect(mockQuit).toHaveBeenCalled();
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully when key does not exist', async () => {
      mockSet.mockResolvedValue('OK');

      const result = await acquireLock('test:lock', 30);

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        'test:lock',
        expect.any(String),
        'EX',
        30,
        'NX'
      );
    });

    it('should fail to acquire lock when key already exists', async () => {
      mockSet.mockResolvedValue(null);

      const result = await acquireLock('test:lock', 30);

      expect(result).toBe(false);
    });

    it('should use custom value when provided', async () => {
      mockSet.mockResolvedValue('OK');

      await acquireLock('test:lock', 30, 'custom-value');

      expect(mockSet).toHaveBeenCalledWith(
        'test:lock',
        'custom-value',
        'EX',
        30,
        'NX'
      );
    });

    it('should return false on Redis error', async () => {
      mockSet.mockRejectedValue(new Error('Connection refused'));

      const result = await acquireLock('test:lock', 30);

      expect(result).toBe(false);
    });

    it('should use timestamp as default value', async () => {
      mockSet.mockResolvedValue('OK');
      const beforeTime = Date.now();

      await acquireLock('test:lock', 30);

      const afterTime = Date.now();
      const calledValue = mockSet.mock.calls[0][1];
      const valueAsNumber = parseInt(calledValue, 10);

      expect(valueAsNumber).toBeGreaterThanOrEqual(beforeTime);
      expect(valueAsNumber).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully when value matches', async () => {
      mockEval.mockResolvedValue(1);

      const result = await releaseLock('test:lock', 'lock-value');

      expect(result).toBe(true);
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'test:lock',
        'lock-value'
      );
    });

    it('should fail to release lock when value does not match', async () => {
      mockEval.mockResolvedValue(0);

      const result = await releaseLock('test:lock', 'wrong-value');

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      mockEval.mockRejectedValue(new Error('Connection refused'));

      const result = await releaseLock('test:lock', 'lock-value');

      expect(result).toBe(false);
    });

    it('should use Lua script for atomic check and delete', async () => {
      mockEval.mockResolvedValue(1);

      await releaseLock('test:lock', 'lock-value');

      const luaScript = mockEval.mock.calls[0][0];
      expect(luaScript).toContain('redis.call("get", KEYS[1])');
      expect(luaScript).toContain('redis.call("del", KEYS[1])');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValue(5);
      mockZadd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await checkRateLimit('ratelimit:test', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1
    });

    it('should reject request when at limit', async () => {
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValue(10);

      const result = await checkRateLimit('ratelimit:test', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reject request when over limit', async () => {
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValue(15);

      const result = await checkRateLimit('ratelimit:test', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should fail open on Redis error', async () => {
      mockZremrangebyscore.mockRejectedValue(new Error('Connection refused'));

      const result = await checkRateLimit('ratelimit:test', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should clean old entries outside window', async () => {
      mockZremrangebyscore.mockResolvedValue(5);
      mockZcard.mockResolvedValue(3);
      mockZadd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await checkRateLimit('ratelimit:test', 10, 60);

      expect(mockZremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:test',
        0,
        expect.any(Number)
      );
    });

    it('should set expiry on rate limit key', async () => {
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValue(0);
      mockZadd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await checkRateLimit('ratelimit:test', 10, 120);

      expect(mockExpire).toHaveBeenCalledWith('ratelimit:test', 120);
    });

    it('should add timestamp entry to sorted set', async () => {
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValue(0);
      mockZadd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const beforeTime = Date.now();
      await checkRateLimit('ratelimit:test', 10, 60);
      const afterTime = Date.now();

      const calledTimestamp = mockZadd.mock.calls[0][1];
      expect(calledTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(calledTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('getCached', () => {
    it('should return cached value when exists', async () => {
      const cachedData = { foo: 'bar', count: 42 };
      mockGet.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getCached<typeof cachedData>('cache:test');

      expect(result).toEqual(cachedData);
    });

    it('should return null when key does not exist', async () => {
      mockGet.mockResolvedValue(null);

      const result = await getCached('cache:test');

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockGet.mockRejectedValue(new Error('Connection refused'));

      const result = await getCached('cache:test');

      expect(result).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        user: { id: 1, name: 'Test' },
        items: [1, 2, 3],
        nested: { deep: { value: true } },
      };
      mockGet.mockResolvedValue(JSON.stringify(complexData));

      const result = await getCached<typeof complexData>('cache:complex');

      expect(result).toEqual(complexData);
    });

    it('should handle array values', async () => {
      const arrayData = [1, 2, 3, 4, 5];
      mockGet.mockResolvedValue(JSON.stringify(arrayData));

      const result = await getCached<number[]>('cache:array');

      expect(result).toEqual(arrayData);
    });
  });

  describe('setCached', () => {
    it('should set cached value without TTL', async () => {
      mockSet.mockResolvedValue('OK');

      const result = await setCached('cache:test', { foo: 'bar' });

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        'cache:test',
        JSON.stringify({ foo: 'bar' })
      );
    });

    it('should set cached value with TTL', async () => {
      mockSetex.mockResolvedValue('OK');

      const result = await setCached('cache:test', { foo: 'bar' }, 300);

      expect(result).toBe(true);
      expect(mockSetex).toHaveBeenCalledWith(
        'cache:test',
        300,
        JSON.stringify({ foo: 'bar' })
      );
    });

    it('should return false on Redis error', async () => {
      mockSet.mockRejectedValue(new Error('Connection refused'));

      const result = await setCached('cache:test', { foo: 'bar' });

      expect(result).toBe(false);
    });

    it('should serialize arrays correctly', async () => {
      mockSet.mockResolvedValue('OK');

      await setCached('cache:array', [1, 2, 3]);

      expect(mockSet).toHaveBeenCalledWith(
        'cache:array',
        JSON.stringify([1, 2, 3])
      );
    });

    it('should serialize primitive values', async () => {
      mockSet.mockResolvedValue('OK');

      await setCached('cache:string', 'hello');

      expect(mockSet).toHaveBeenCalledWith(
        'cache:string',
        JSON.stringify('hello')
      );
    });

    it('should serialize null values', async () => {
      mockSet.mockResolvedValue('OK');

      await setCached('cache:null', null);

      expect(mockSet).toHaveBeenCalledWith(
        'cache:null',
        JSON.stringify(null)
      );
    });
  });

  describe('deleteCached', () => {
    it('should delete cached value successfully', async () => {
      mockDel.mockResolvedValue(1);

      const result = await deleteCached('cache:test');

      expect(result).toBe(true);
      expect(mockDel).toHaveBeenCalledWith('cache:test');
    });

    it('should return true even when key does not exist', async () => {
      mockDel.mockResolvedValue(0);

      const result = await deleteCached('cache:nonexistent');

      expect(result).toBe(true);
    });

    it('should return false on Redis error', async () => {
      mockDel.mockRejectedValue(new Error('Connection refused'));

      const result = await deleteCached('cache:test');

      expect(result).toBe(false);
    });
  });

  describe('Lock Integration Scenarios', () => {
    it('should handle acquire then release flow', async () => {
      const lockKey = 'position:open:user123:BTCUSDT';
      const lockValue = 'unique-lock-id';

      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      // Acquire lock
      const acquired = await acquireLock(lockKey, 30, lockValue);
      expect(acquired).toBe(true);

      // Release lock
      const released = await releaseLock(lockKey, lockValue);
      expect(released).toBe(true);
    });

    it('should prevent double acquisition', async () => {
      const lockKey = 'position:open:user123:BTCUSDT';

      // First acquisition succeeds
      mockSet.mockResolvedValueOnce('OK');
      const first = await acquireLock(lockKey, 30);
      expect(first).toBe(true);

      // Second acquisition fails
      mockSet.mockResolvedValueOnce(null);
      const second = await acquireLock(lockKey, 30);
      expect(second).toBe(false);
    });
  });

  describe('Cache Integration Scenarios', () => {
    it('should handle set then get flow', async () => {
      const cacheKey = 'opportunity:BTCUSDT';
      const data = { spread: 0.05, timestamp: Date.now() };

      mockSet.mockResolvedValue('OK');
      mockGet.mockResolvedValue(JSON.stringify(data));

      // Set cache
      const setResult = await setCached(cacheKey, data);
      expect(setResult).toBe(true);

      // Get cache
      const getResult = await getCached<typeof data>(cacheKey);
      expect(getResult).toEqual(data);
    });

    it('should handle set then delete then get flow', async () => {
      const cacheKey = 'user:session:123';

      mockSet.mockResolvedValue('OK');
      mockDel.mockResolvedValue(1);
      mockGet.mockResolvedValue(null);

      // Set cache
      await setCached(cacheKey, { token: 'abc' });

      // Delete cache
      const deleted = await deleteCached(cacheKey);
      expect(deleted).toBe(true);

      // Get returns null
      const result = await getCached(cacheKey);
      expect(result).toBeNull();
    });
  });

  describe('Rate Limit Integration Scenarios', () => {
    it('should track multiple requests in window', async () => {
      const rateLimitKey = 'ratelimit:api:user123';

      // First request - 0 existing
      mockZremrangebyscore.mockResolvedValue(0);
      mockZcard.mockResolvedValueOnce(0);
      mockZadd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const first = await checkRateLimit(rateLimitKey, 5, 60);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(4);

      // Subsequent requests - simulate count increase
      mockZcard.mockResolvedValueOnce(3);
      const fourth = await checkRateLimit(rateLimitKey, 5, 60);
      expect(fourth.allowed).toBe(true);
      expect(fourth.remaining).toBe(1);

      // At limit
      mockZcard.mockResolvedValueOnce(5);
      const atLimit = await checkRateLimit(rateLimitKey, 5, 60);
      expect(atLimit.allowed).toBe(false);
      expect(atLimit.remaining).toBe(0);
    });
  });
});
