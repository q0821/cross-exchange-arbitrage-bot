import { NextResponse } from 'next/server';
import { getRedisClient, isRedisAvailable, isRedisConfigured } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/locks - 列出所有開倉鎖
 */
export async function GET() {
  try {
    // 驗證登入狀態
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 檢查 Redis 狀態
    if (!isRedisConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          redisConfigured: false,
          redisAvailable: false,
          locks: [],
          message: 'Redis 未配置，分散式鎖已停用',
        },
      });
    }

    if (!isRedisAvailable()) {
      return NextResponse.json({
        success: true,
        data: {
          redisConfigured: true,
          redisAvailable: false,
          locks: [],
          message: 'Redis 已配置但無法連線',
        },
      });
    }

    const redis = getRedisClient();
    const keys = await redis.keys('position:open:*');

    const locks = await Promise.all(
      keys.map(async (key) => {
        const ttl = await redis.ttl(key);
        const value = await redis.get(key);
        return { key, ttl, value };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        redisConfigured: true,
        redisAvailable: true,
        locks,
        message: locks.length === 0 ? '沒有找到任何開倉鎖' : `找到 ${locks.length} 個開倉鎖`,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list position locks');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/locks - 清除所有開倉鎖
 */
export async function DELETE() {
  try {
    // 驗證登入狀態
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 檢查 Redis 狀態
    if (!isRedisConfigured() || !isRedisAvailable()) {
      return NextResponse.json({
        success: true,
        data: {
          deleted: 0,
          message: 'Redis 未配置或無法連線',
        },
      });
    }

    const redis = getRedisClient();
    const keys = await redis.keys('position:open:*');

    if (keys.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          deleted: 0,
          message: '沒有找到任何開倉鎖',
        },
      });
    }

    const deleted = await redis.del(...keys);

    logger.info({ deleted, keys }, 'Position locks cleared by admin');

    return NextResponse.json({
      success: true,
      data: {
        deleted,
        message: `已清除 ${deleted} 個開倉鎖`,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to clear position locks');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
