/**
 * GET /api/trades
 *
 * 查詢用戶的交易歷史（績效記錄）
 * Feature: 035-close-position (T016)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import type { TradePerformanceInfo } from '@/src/types/trading';

const prisma = new PrismaClient();

/**
 * GET /api/trades
 *
 * Query Parameters:
 * - limit: 返回數量上限 (預設 20, 最大 100)
 * - offset: 分頁偏移 (預設 0)
 * - symbol: 交易對過濾 (可選)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     trades: [...],
 *     total: 10
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const symbol = searchParams.get('symbol');

    logger.info(
      {
        correlationId,
        userId: user.userId,
        limit,
        offset,
        symbol,
      },
      'Get trades request received',
    );

    // 3. 構建查詢條件
    const where: {
      userId: string;
      symbol?: string;
    } = {
      userId: user.userId,
    };

    if (symbol) {
      where.symbol = symbol;
    }

    // 4. 查詢交易記錄
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.trade.count({ where }),
    ]);

    // 5. 格式化回應
    const tradeInfos: TradePerformanceInfo[] = trades.map((t) => ({
      id: t.id,
      positionId: t.positionId,
      symbol: t.symbol,
      longExchange: t.longExchange,
      shortExchange: t.shortExchange,
      longEntryPrice: t.longEntryPrice.toString(),
      longExitPrice: t.longExitPrice.toString(),
      shortEntryPrice: t.shortEntryPrice.toString(),
      shortExitPrice: t.shortExitPrice.toString(),
      longPositionSize: t.longPositionSize.toString(),
      shortPositionSize: t.shortPositionSize.toString(),
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt.toISOString(),
      holdingDuration: t.holdingDuration,
      priceDiffPnL: t.priceDiffPnL.toString(),
      fundingRatePnL: t.fundingRatePnL.toString(),
      totalPnL: t.totalPnL.toString(),
      roi: t.roi.toString(),
      status: t.status as 'SUCCESS' | 'PARTIAL',
      createdAt: t.createdAt.toISOString(),
    }));

    logger.info(
      {
        correlationId,
        userId: user.userId,
        tradeCount: trades.length,
        total,
      },
      'Get trades request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          trades: tradeInfos,
          total,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}
