/**
 * GET /api/positions/[id]/details
 *
 * 查詢持倉詳情：即時價格、資金費率明細、未實現損益、年化報酬率
 * Feature: 045-position-details-view
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionDetailsService } from '@/src/services/trading/PositionDetailsService';
import type { PositionDetailsResponse } from '@/src/types/trading';

const positionDetailsService = new PositionDetailsService(prisma);

/**
 * GET /api/positions/[id]/details
 *
 * 查詢持倉詳情（即時查詢交易所 API）
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "positionId": "...",
 *     "symbol": "BTCUSDT",
 *     "longExchange": "binance",
 *     "shortExchange": "okx",
 *     "longEntryPrice": "95000.00",
 *     "shortEntryPrice": "95010.00",
 *     "longCurrentPrice": 95100.50,
 *     "shortCurrentPrice": 95105.20,
 *     "priceQuerySuccess": true,
 *     "totalUnrealizedPnL": 0.053,
 *     "fundingFees": { ... },
 *     "fundingFeeQuerySuccess": true,
 *     "annualizedReturn": { ... },
 *     "queriedAt": "2025-12-28T12:30:00Z"
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<PositionDetailsResponse>> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);
    const { id: positionId } = await context.params;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionId,
      },
      'Fetching position details',
    );

    // 2. 查詢持倉詳情
    const details = await positionDetailsService.getPositionDetails(positionId, user.userId);

    logger.info(
      {
        correlationId,
        positionId,
        symbol: details.symbol,
        priceQuerySuccess: details.priceQuerySuccess,
        fundingFeeQuerySuccess: details.fundingFeeQuerySuccess,
      },
      'Position details fetched successfully',
    );

    return NextResponse.json(
      {
        success: true,
        data: details,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 處理特定錯誤
    if (errorMessage === 'Position not found') {
      logger.warn({ correlationId, error: errorMessage }, 'Position not found');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Position not found',
          },
        },
        { status: 404 },
      );
    }

    if (errorMessage.includes('Forbidden')) {
      logger.warn({ correlationId, error: errorMessage }, 'Forbidden access');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this position',
          },
        },
        { status: 403 },
      );
    }

    if (errorMessage.includes('Invalid status')) {
      logger.warn({ correlationId, error: errorMessage }, 'Invalid position status');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Position is not open. Only OPEN positions can view details.',
          },
        },
        { status: 400 },
      );
    }

    // 其他錯誤使用通用錯誤處理
    return handleError(error, correlationId);
  }
}
