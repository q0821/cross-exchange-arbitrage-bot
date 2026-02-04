/**
 * GET /api/positions
 *
 * 查詢用戶的持倉列表
 * Feature: 033-manual-open-position (T011)
 * Feature: 069-position-group-close (T013) - 新增分組查詢支援
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionGroupService } from '@/src/services/trading/PositionGroupService';
import type { PositionInfo, PositionStatus } from '@/src/types/trading';
import type { PositionStatusFilter } from '@/src/types/position-group';

/**
 * GET /api/positions
 *
 * Query Parameters:
 * - status: 逗號分隔的狀態列表 (e.g., "OPEN,OPENING,PARTIAL") - 可選，預設返回所有非 CLOSED 狀態
 * - limit: 返回數量上限 (預設 50)
 * - offset: 分頁偏移 (預設 0)
 * - grouped: 是否返回分組後的持倉 (true/false) - Feature 069
 *
 * Response (grouped=false, default):
 * {
 *   success: true,
 *   data: {
 *     positions: [ ... ],
 *     total: 10
 *   }
 * }
 *
 * Response (grouped=true):
 * {
 *   success: true,
 *   data: {
 *     positions: [ ... ],    // 未分組的持倉
 *     groups: [ ... ],       // 分組後的持倉
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
    const grouped = searchParams.get('grouped') === 'true';
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
        grouped,
        limit,
        offset,
      },
      'Get positions request received',
    );

    // 4. 如果請求分組格式，使用 PositionGroupService
    if (grouped) {
      const groupService = new PositionGroupService(prisma);
      // 直接傳遞狀態陣列，讓 Service 處理多狀態過濾
      const groupedResult = await groupService.getPositionsGrouped(
        user.userId,
        statusFilter as PositionStatusFilter
      );

      // Feature 070: 計算總數（所有持倉都在 groups 中）
      const total = groupedResult.groups.reduce((sum, g) => sum + g.positions.length, 0);

      logger.info(
        {
          correlationId,
          userId: user.userId,
          groupCount: groupedResult.groups.length,
          total,
        },
        'Get grouped positions request completed',
      );

      // Feature 070: 回應只包含 groups，不再有獨立的 positions 陣列
      return NextResponse.json(
        {
          success: true,
          data: {
            groups: groupedResult.groups.map((g) => ({
              groupId: g.groupId,
              symbol: g.symbol,
              longExchange: g.longExchange,
              shortExchange: g.shortExchange,
              positions: g.positions.map(formatPositionInfo),
              aggregate: {
                totalQuantity: g.aggregate.totalQuantity.toString(),
                avgLongEntryPrice: g.aggregate.avgLongEntryPrice.toString(),
                avgShortEntryPrice: g.aggregate.avgShortEntryPrice.toString(),
                totalFundingPnL: g.aggregate.totalFundingPnL?.toString() ?? null,
                totalUnrealizedPnL: g.aggregate.totalUnrealizedPnL?.toString() ?? null,
                positionCount: g.aggregate.positionCount,
                firstOpenedAt: g.aggregate.firstOpenedAt?.toISOString() ?? null,
                stopLossPercent: g.aggregate.stopLossPercent?.toString() ?? null,
                takeProfitPercent: g.aggregate.takeProfitPercent?.toString() ?? null,
              },
            })),
            total,
          },
        },
        { status: 200 },
      );
    }

    // 5. 標準查詢（非分組）
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

    // 6. 格式化回應（含停損停利資訊 Feature 038, 分組資訊 Feature 069）
    const positionInfos: PositionInfo[] = positions.map(formatPositionInfo);

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

/**
 * 格式化 Position 為 PositionInfo
 */
function formatPositionInfo(p: {
  id: string;
  userId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longLeverage: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  stopLossEnabled: boolean;
  stopLossPercent: { toString(): string } | null;
  takeProfitEnabled: boolean;
  takeProfitPercent: { toString(): string } | null;
  conditionalOrderStatus: string;
  conditionalOrderError: string | null;
  longStopLossPrice: { toNumber(): number } | null;
  shortStopLossPrice: { toNumber(): number } | null;
  longTakeProfitPrice: { toNumber(): number } | null;
  shortTakeProfitPrice: { toNumber(): number } | null;
  groupId: string | null;
}): PositionInfo {
  return {
    id: p.id,
    userId: p.userId,
    symbol: p.symbol,
    longExchange: p.longExchange as PositionInfo['longExchange'],
    shortExchange: p.shortExchange as PositionInfo['shortExchange'],
    leverage: p.longLeverage,
    status: p.status as PositionInfo['status'],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    // 停損停利資訊 (Feature 038)
    stopLossEnabled: p.stopLossEnabled,
    stopLossPercent: p.stopLossPercent ? Number(p.stopLossPercent) : undefined,
    takeProfitEnabled: p.takeProfitEnabled,
    takeProfitPercent: p.takeProfitPercent ? Number(p.takeProfitPercent) : undefined,
    conditionalOrderStatus: p.conditionalOrderStatus as PositionInfo['conditionalOrderStatus'],
    conditionalOrderError: p.conditionalOrderError,
    longStopLossPrice: p.longStopLossPrice ? p.longStopLossPrice.toNumber() : null,
    shortStopLossPrice: p.shortStopLossPrice ? p.shortStopLossPrice.toNumber() : null,
    longTakeProfitPrice: p.longTakeProfitPrice ? p.longTakeProfitPrice.toNumber() : null,
    shortTakeProfitPrice: p.shortTakeProfitPrice ? p.shortTakeProfitPrice.toNumber() : null,
    // 持倉組別 (Feature 069/070: 所有持倉必須有 groupId)
    // Note: Prisma 類型可能顯示為 string | null，但 migration 已確保不會有 null
    groupId: p.groupId!,
  };
}
