/**
 * GET /api/positions
 *
 * 查詢用戶的持倉列表
 * Feature: 033-manual-open-position (T011)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import type { PositionInfo, PositionStatus } from '@/src/types/trading';

/**
 * GET /api/positions
 *
 * Query Parameters:
 * - status: 逗號分隔的狀態列表 (e.g., "OPEN,OPENING,PARTIAL") - 可選，預設返回所有非 CLOSED 狀態
 * - limit: 返回數量上限 (預設 50)
 * - offset: 分頁偏移 (預設 0)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     positions: [
 *       {
 *         id: "...",
 *         symbol: "BTCUSDT",
 *         longExchange: "binance",
 *         shortExchange: "okx",
 *         status: "OPEN",
 *         ...
 *       }
 *     ],
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
    const statusParam = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 3. 構建狀態過濾條件
    let statusFilter: PositionStatus[] | undefined;

    if (statusParam) {
      statusFilter = statusParam.split(',').map((s) => s.trim().toUpperCase()) as PositionStatus[];
    } else {
      // 預設返回非 CLOSED 狀態的持倉
      statusFilter = ['PENDING', 'OPENING', 'OPEN', 'CLOSING', 'FAILED', 'PARTIAL'];
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        statusFilter,
        limit,
        offset,
      },
      'Get positions request received',
    );

    // 4. 查詢持倉
    const [positions, total] = await Promise.all([
      prisma.position.findMany({
        where: {
          userId: user.userId,
          status: { in: statusFilter },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.position.count({
        where: {
          userId: user.userId,
          status: { in: statusFilter },
        },
      }),
    ]);

    // 5. 格式化回應（含停損停利資訊 Feature 038）
    const positionInfos: PositionInfo[] = positions.map((p) => ({
      id: p.id,
      userId: p.userId,
      symbol: p.symbol,
      longExchange: p.longExchange as any,
      shortExchange: p.shortExchange as any,
      leverage: p.longLeverage,
      status: p.status as any,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      // 停損停利資訊 (Feature 038)
      stopLossEnabled: p.stopLossEnabled,
      stopLossPercent: p.stopLossPercent ? Number(p.stopLossPercent) : undefined,
      takeProfitEnabled: p.takeProfitEnabled,
      takeProfitPercent: p.takeProfitPercent ? Number(p.takeProfitPercent) : undefined,
      conditionalOrderStatus: p.conditionalOrderStatus as any,
      conditionalOrderError: p.conditionalOrderError,
      longStopLossPrice: p.longStopLossPrice ? Number(p.longStopLossPrice) : null,
      shortStopLossPrice: p.shortStopLossPrice ? Number(p.shortStopLossPrice) : null,
      longTakeProfitPrice: p.longTakeProfitPrice ? Number(p.longTakeProfitPrice) : null,
      shortTakeProfitPrice: p.shortTakeProfitPrice ? Number(p.shortTakeProfitPrice) : null,
    }));

    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionCount: positions.length,
        total,
      },
      'Get positions request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          positions: positionInfos,
          total,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}
