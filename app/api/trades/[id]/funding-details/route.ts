/**
 * GET /api/trades/[id]/funding-details
 *
 * 查詢指定交易的資金費率明細
 * 即時從交易所查詢，返回多頭和空頭各筆資金費率結算記錄
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { FundingFeeQueryService } from '@/src/services/trading/FundingFeeQueryService';
import type { SupportedExchange, FundingFeeEntry } from '@/src/types/trading';

interface FundingFeeDetailEntry {
  timestamp: number;
  datetime: string;
  amount: string;
  symbol: string;
  id: string;
}

interface FundingDetailsResponse {
  tradeId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  openedAt: string;
  closedAt: string;
  longEntries: FundingFeeDetailEntry[];
  shortEntries: FundingFeeDetailEntry[];
  longTotal: string;
  shortTotal: string;
  total: string;
}

/**
 * GET /api/trades/[id]/funding-details
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     tradeId: "...",
 *     symbol: "BTCUSDT",
 *     longExchange: "binance",
 *     shortExchange: "okx",
 *     openedAt: "2025-01-01T00:00:00Z",
 *     closedAt: "2025-01-02T00:00:00Z",
 *     longEntries: [...],
 *     shortEntries: [...],
 *     longTotal: "1.23",
 *     shortTotal: "-0.45",
 *     total: "0.78"
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id: tradeId } = await params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        tradeId,
      },
      'Fetching funding details for trade',
    );

    // 2. 查詢 Trade 記錄
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TRADE_NOT_FOUND',
            message: '找不到指定的交易記錄',
          },
        },
        { status: 404 },
      );
    }

    // 3. 驗證用戶有權限查看此交易
    if (trade.userId !== user.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '無權限查看此交易記錄',
          },
        },
        { status: 403 },
      );
    }

    // 4. 使用 FundingFeeQueryService 查詢資金費率明細
    const fundingFeeService = new FundingFeeQueryService();
    const result = await fundingFeeService.queryBilateralFundingFees(
      trade.longExchange as SupportedExchange,
      trade.shortExchange as SupportedExchange,
      trade.symbol,
      trade.openedAt,
      trade.closedAt,
      user.userId,
    );

    // 5. 轉換為響應格式
    const convertEntries = (entries: FundingFeeEntry[]): FundingFeeDetailEntry[] => {
      return entries.map((entry) => ({
        timestamp: entry.timestamp,
        datetime: entry.datetime,
        amount: entry.amount.toFixed(8),
        symbol: entry.symbol,
        id: entry.id,
      }));
    };

    const response: FundingDetailsResponse = {
      tradeId: trade.id,
      symbol: trade.symbol,
      longExchange: trade.longExchange,
      shortExchange: trade.shortExchange,
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt.toISOString(),
      longEntries: convertEntries(result.longResult.entries),
      shortEntries: convertEntries(result.shortResult.entries),
      longTotal: result.longResult.totalAmount.toFixed(8),
      shortTotal: result.shortResult.totalAmount.toFixed(8),
      total: result.totalFundingFee.toFixed(8),
    };

    logger.info(
      {
        correlationId,
        tradeId,
        longEntriesCount: response.longEntries.length,
        shortEntriesCount: response.shortEntries.length,
        total: response.total,
      },
      'Funding details fetched successfully',
    );

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error(
      {
        correlationId,
        tradeId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to fetch funding details',
    );
    return handleError(error, correlationId);
  }
}
