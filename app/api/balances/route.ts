/**
 * GET /api/balances
 *
 * 查詢用戶在指定交易所的可用餘額
 * Feature: 033-manual-open-position (T009)
 * Feature: 056-fix-balance-display - 區分 available 和 total
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { UserConnectorFactory } from '@/src/services/assets/UserConnectorFactory';
import { GetBalancesRequestSchema, type BalancesResponse, type SupportedExchange } from '@/src/types/trading';

/**
 * GET /api/balances?exchanges=binance,okx
 *
 * Query Parameters:
 * - exchanges: 逗號分隔的交易所列表 (e.g., "binance,okx")
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     balances: [
 *       { exchange: "binance", available: 1000.50, total: 1200.00, status: "success" },
 *       { exchange: "okx", available: 500.00, total: 600.00, status: "success" }
 *     ]
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
    const exchangesParam = searchParams.get('exchanges');

    // 3. 驗證參數
    const validatedInput = GetBalancesRequestSchema.parse({
      exchanges: exchangesParam,
    });

    const exchanges = validatedInput.exchanges
      .split(',')
      .map((e) => e.trim().toLowerCase()) as SupportedExchange[];

    logger.info(
      {
        correlationId,
        userId: user.userId,
        exchanges,
      },
      'Get balances request received',
    );

    // 4. 查詢餘額 (使用 UserConnectorFactory，只查詢指定交易所，平行執行)
    const userConnectorFactory = new UserConnectorFactory(prisma);
    const balanceResults = await userConnectorFactory.getBalancesForUser(user.userId, exchanges);

    // 5. 格式化回應 - Feature 056: 區分 available (可用餘額) 和 total (總權益)
    const balances = balanceResults.map((balanceResult) => {
      if (balanceResult.status !== 'success') {
        return {
          exchange: balanceResult.exchange,
          available: 0,
          total: 0,
          status: balanceResult.status as 'success' | 'no_api_key' | 'api_error' | 'rate_limited',
          errorMessage: balanceResult.errorMessage,
        };
      }

      return {
        exchange: balanceResult.exchange,
        available: balanceResult.availableBalanceUSD ?? 0, // 可用餘額（用於開倉）
        total: balanceResult.balanceUSD ?? 0,              // 總權益（用於資產總覽）
        status: 'success' as const,
      };
    });

    const response: BalancesResponse = {
      balances,
    };

    logger.info(
      {
        correlationId,
        userId: user.userId,
        balanceCount: balances.length,
      },
      'Get balances request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 },
    );
  } catch (error) {
    // 詳細記錄錯誤以便調試
    logger.error(
      {
        correlationId,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      'Get balances failed',
    );
    return handleError(error, correlationId);
  }
}
