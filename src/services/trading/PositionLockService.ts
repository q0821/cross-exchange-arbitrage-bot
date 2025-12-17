/**
 * PositionLockService
 *
 * 分散式鎖服務，防止同一用戶對同一交易對並發開倉
 * Feature: 033-manual-open-position
 *
 * 注意：當 Redis 不可用時，鎖機制會被跳過（單實例部署可接受）
 */

import { acquireLock, releaseLock, isRedisConfigured } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { LockConflictError } from '../../lib/errors/trading-errors';
import { randomUUID } from 'crypto';

/**
 * 鎖的配置
 */
const LOCK_CONFIG = {
  /** 鎖的 TTL (秒) - 30 秒超時 */
  TTL_SECONDS: 30,
  /** 鎖的 key 前綴 */
  KEY_PREFIX: 'position:open',
} as const;

/**
 * 鎖的上下文，用於釋放鎖時驗證
 */
export interface LockContext {
  key: string;
  value: string;
  userId: string;
  symbol: string;
  acquiredAt: number;
  /** 是否為無操作鎖（Redis 不可用時） */
  isNoOp?: boolean;
}

/**
 * PositionLockService
 *
 * 使用 Redis 分散式鎖防止並發開倉
 */
export class PositionLockService {
  /**
   * 生成鎖的 key
   */
  private static generateLockKey(userId: string, symbol: string): string {
    return `${LOCK_CONFIG.KEY_PREFIX}:${userId}:${symbol}`;
  }

  /**
   * 獲取分散式鎖
   *
   * @param userId 用戶 ID
   * @param symbol 交易對
   * @returns 鎖的上下文，用於後續釋放
   * @throws LockConflictError 如果鎖已被佔用
   */
  static async acquire(userId: string, symbol: string): Promise<LockContext> {
    const key = this.generateLockKey(userId, symbol);
    const value = randomUUID();
    const acquiredAt = Date.now();

    // 如果 Redis 未配置，跳過鎖機制
    if (!isRedisConfigured()) {
      logger.warn(
        { userId, symbol },
        'Redis not configured - skipping distributed lock (single instance mode)',
      );
      return {
        key,
        value,
        userId,
        symbol,
        acquiredAt,
        isNoOp: true,
      };
    }

    logger.info({ userId, symbol, key }, 'Attempting to acquire position lock');

    const acquired = await acquireLock(key, LOCK_CONFIG.TTL_SECONDS, value);

    if (!acquired) {
      logger.warn({ userId, symbol, key }, 'Failed to acquire position lock - already held');
      throw new LockConflictError(userId, symbol);
    }

    logger.info({ userId, symbol, key, value }, 'Position lock acquired successfully');

    return {
      key,
      value,
      userId,
      symbol,
      acquiredAt,
    };
  }

  /**
   * 釋放分散式鎖
   *
   * @param context 鎖的上下文
   * @returns 是否成功釋放
   */
  static async release(context: LockContext): Promise<boolean> {
    const { key, value, userId, symbol, acquiredAt, isNoOp } = context;
    const holdDuration = Date.now() - acquiredAt;

    // 如果是無操作鎖，直接返回成功
    if (isNoOp) {
      logger.debug({ userId, symbol, holdDuration }, 'No-op lock release (Redis not configured)');
      return true;
    }

    logger.info(
      { userId, symbol, key, holdDuration },
      'Releasing position lock',
    );

    const released = await releaseLock(key, value);

    if (released) {
      logger.info(
        { userId, symbol, key, holdDuration },
        'Position lock released successfully',
      );
    } else {
      // 鎖可能已過期或被其他進程釋放
      logger.warn(
        { userId, symbol, key, holdDuration },
        'Position lock release failed - lock may have expired or been released by another process',
      );
    }

    return released;
  }

  /**
   * 檢查是否持有鎖（用於調試）
   *
   * @param userId 用戶 ID
   * @param symbol 交易對
   * @returns 是否持有鎖
   */
  static async isLocked(userId: string, symbol: string): Promise<boolean> {
    const { getRedisClient } = await import('../../lib/redis');
    const redis = getRedisClient();
    const key = this.generateLockKey(userId, symbol);

    try {
      const value = await redis.get(key);
      return value !== null;
    } catch (error) {
      logger.error({ error, userId, symbol }, 'Failed to check lock status');
      return false;
    }
  }

  /**
   * 使用鎖執行操作
   *
   * 自動獲取和釋放鎖，確保鎖在操作完成後被釋放
   *
   * @param userId 用戶 ID
   * @param symbol 交易對
   * @param operation 要執行的操作
   * @returns 操作的結果
   */
  static async withLock<T>(
    userId: string,
    symbol: string,
    operation: (context: LockContext) => Promise<T>,
  ): Promise<T> {
    const context = await this.acquire(userId, symbol);

    try {
      return await operation(context);
    } finally {
      await this.release(context);
    }
  }
}

export default PositionLockService;
