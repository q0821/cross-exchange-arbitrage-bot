/**
 * GET /api/balances
 *
 * 查詢用戶在指定交易所的可用餘額
 * Feature: 033-manual-open-position (T009)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { BalanceValidator } from '@/src/services/trading/BalanceValidator';
import { GetBalancesRequestSchema, type BalancesResponse, type SupportedExchange } from '@/src/types/trading';

const prisma = new PrismaClient();

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

    // 4. 查詢餘額
    const balanceValidator = new BalanceValidator(prisma);
    const balanceMap = await balanceValidator.getBalances(user.userId, exchanges);

    // 5. 格式化回應
    const balances = exchanges.map((exchange) => {
      const balance = balanceMap.get(exchange) ?? 0;
      return {
        exchange,
        available: balance,
        total: balance, // 目前只回傳可用餘額
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
    return handleError(error, correlationId);
  }
}
