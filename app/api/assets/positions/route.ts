import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { UserConnectorFactory } from '@/src/services/assets/UserConnectorFactory';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();

/**
 * GET /api/assets/positions
 * 查詢用戶各交易所的當前持倉
 * Feature 031: Asset Tracking History (T035)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     exchanges: [
 *       {
 *         exchange: 'binance',
 *         status: 'success',
 *         positions: [
 *           { symbol: 'BTCUSDT', side: 'LONG', quantity: 0.1, ... },
 *           ...
 *         ]
 *       },
 *       ...
 *     ],
 *     totalUnrealizedPnl: 150.50,
 *     lastUpdated: '2025-12-11T00:00:00.000Z'
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
      },
      'Get positions request received'
    );

    // 2. 查詢各交易所持倉
    const connectorFactory = new UserConnectorFactory(prisma);
    const positionsResults = await connectorFactory.getPositionsForUser(user.userId);

    // 3. 計算總未實現損益
    let totalUnrealizedPnl = 0;
    const exchangeData = positionsResults.map((result) => {
      const exchangePnl = result.positions.reduce(
        (sum, pos) => sum + (pos.unrealizedPnl || 0),
        0
      );

      if (result.status === 'success') {
        totalUnrealizedPnl += exchangePnl;
      }

      return {
        exchange: result.exchange,
        status: result.status,
        positions: result.positions.map((pos) => ({
          symbol: pos.symbol,
          side: pos.side,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          markPrice: pos.markPrice,
          leverage: pos.leverage,
          marginUsed: pos.marginUsed,
          unrealizedPnl: pos.unrealizedPnl,
          liquidationPrice: pos.liquidationPrice,
        })),
        totalPnl: exchangePnl,
        errorMessage: result.errorMessage,
      };
    });

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          exchanges: exchangeData,
          totalUnrealizedPnl,
          lastUpdated: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
