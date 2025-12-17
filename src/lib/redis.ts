import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis Client Singleton
 *
 * Provides Redis connection for:
 * - Distributed locks (prevent concurrent position opens)
 * - Rate limiting (API request throttling)
 * - Session storage (optional, NextAuth default is JWT)
 * - Caching (opportunity data, user API keys)
 *
 * Configuration from environment:
 * - REDIS_URL: Full connection string (redis://host:port)
 * - REDIS_HOST: Host (default: localhost)
 * - REDIS_PORT: Port (default: 6379)
 * - REDIS_PASSWORD: Password (optional)
 * - REDIS_DB: Database number (default: 0)
 */

let redisClient: Redis | null = null;
let redisAvailable: boolean | null = null;

/**
 * Check if Redis is configured and available
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/**
 * Check if Redis is available (cached result)
 */
export function isRedisAvailable(): boolean {
  // If not configured, it's not available
  if (!isRedisConfigured()) {
    return false;
  }
  // Return cached result if we've already checked
  if (redisAvailable !== null) {
    return redisAvailable;
  }
  // Default to true until proven otherwise
  return true;
}

/**
 * Set Redis availability status
 */
export function setRedisAvailable(available: boolean): void {
  redisAvailable = available;
}

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

  if (redisUrl) {
    // Use full connection string
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect if Redis is in readonly mode
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
    });
  } else {
    // Use individual connection parameters
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      db: redisDb,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
    });
  }

  // Event listeners
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (err) => {
    logger.error({ error: err.message }, 'Redis client error');
    // Mark Redis as unavailable on connection errors
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      setRedisAvailable(false);
    }
  });

  redisClient.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client connection closed gracefully');
  }
}

/**
 * Distributed Lock Helper
 *
 * Acquires a distributed lock using Redis SET NX EX
 * Returns true if lock acquired, false otherwise
 *
 * @param key Lock key (e.g., "position:open:userId123")
 * @param ttlSeconds Time to live in seconds
 * @param value Lock value (default: timestamp)
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number,
  value?: string,
): Promise<boolean> {
  const redis = getRedisClient();
  const lockValue = value || Date.now().toString();

  try {
    const result = await redis.set(key, lockValue, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.error(
      { error, key, ttl: ttlSeconds },
      'Failed to acquire distributed lock',
    );
    return false;
  }
}

/**
 * Release Distributed Lock
 *
 * Only releases lock if the value matches (prevent releasing someone else's lock)
 *
 * @param key Lock key
 * @param value Lock value to match
 */
export async function releaseLock(
  key: string,
  value: string,
): Promise<boolean> {
  const redis = getRedisClient();

  try {
    // Lua script to atomically check value and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redis.eval(script, 1, key, value);
    return result === 1;
  } catch (error) {
    logger.error({ error, key }, 'Failed to release distributed lock');
    return false;
  }
}

/**
 * Rate Limiter Helper (Sliding Window)
 *
 * Implements sliding window rate limiting using Redis sorted sets
 *
 * @param key Rate limit key (e.g., "ratelimit:api:userId123")
 * @param limit Maximum requests in window
 * @param windowSeconds Window size in seconds
 * @returns Object with allowed (boolean) and remaining (number)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Remove old entries outside window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current entries in window
    const count = await redis.zcard(key);

    if (count < limit) {
      // Add new entry
      await redis.zadd(key, now, `${now}`);
      // Set expiry
      await redis.expire(key, windowSeconds);

      return {
        allowed: true,
        remaining: limit - count - 1,
      };
    } else {
      return {
        allowed: false,
        remaining: 0,
      };
    }
  } catch (error) {
    logger.error(
      { error, key, limit, windowSeconds },
      'Failed to check rate limit',
    );
    // Fail open - allow request on error
    return {
      allowed: true,
      remaining: limit,
    };
  }
}

/**
 * Cache Helper - Get
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error({ error, key }, 'Failed to get cached value');
    return null;
  }
}

/**
 * Cache Helper - Set
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<boolean> {
  const redis = getRedisClient();

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error({ error, key, ttl: ttlSeconds }, 'Failed to set cached value');
    return false;
  }
}

/**
 * Cache Helper - Delete
 */
export async function deleteCached(key: string): Promise<boolean> {
  const redis = getRedisClient();

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Failed to delete cached value');
    return false;
  }
}

// Export singleton instance getter
export const redis = getRedisClient;
