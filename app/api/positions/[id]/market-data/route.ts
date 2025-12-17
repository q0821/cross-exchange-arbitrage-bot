/**
 * GET /api/positions/[id]/market-data
 *
 * 查詢持倉的即時市場數據（用於平倉確認對話框）
 * Feature: 035-close-position (T008)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { TradingError } from '@/src/lib/errors/trading-errors';
import { estimatePnL } from '@/src/lib/pnl-calculator';
import type { SupportedExchange, PositionMarketDataResponse } from '@/src/types/trading';

const prisma = new PrismaClient();

/**
 * GET /api/positions/[id]/market-data
 *
 * 查詢持倉的即時市場數據
 *
 * Path Parameters:
 * - id: 持倉 ID
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     positionId: "...",
 *     symbol: "BTCUSDT",
 *     longExchange: {
 *       name: "binance",
 *       currentPrice: 42150.50,
 *       entryPrice: "42000.00",
 *       unrealizedPnL: 3.56
 *     },
 *     shortExchange: {
 *       name: "okx",
 *       currentPrice: 42148.30,
 *       entryPrice: "42010.00",
 *       unrealizedPnL: -3.28
 *     },
 *     estimatedPnL: {
 *       priceDiffPnL: 0.28,
 *       fees: 1.00,
 *       netPnL: -0.72
 *     },
 *     updatedAt: "2025-12-17T10:30:00.000Z"
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
      'Get position market data request received',
    );

    // 2. 獲取持倉
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new TradingError('持倉不存在', 'POSITION_NOT_FOUND', false, { positionId });
    }

    if (position.userId !== user.userId) {
      throw new TradingError('無權訪問此持倉', 'POSITION_ACCESS_DENIED', false, { positionId });
    }

    if (position.status !== 'OPEN') {
      throw new TradingError(
        `持倉狀態不正確，當前狀態：${position.status}`,
        'INVALID_POSITION_STATUS',
        false,
        { positionId, status: position.status },
      );
    }

    // 3. 獲取即時價格
    const [longPrice, shortPrice] = await Promise.all([
      getCurrentPrice(position.symbol, position.longExchange as SupportedExchange),
      getCurrentPrice(position.symbol, position.shortExchange as SupportedExchange),
    ]);

    // 4. 計算未實現損益
    const longEntryPrice = Number(position.longEntryPrice);
    const shortEntryPrice = Number(position.shortEntryPrice);
    const longPositionSize = Number(position.longPositionSize);
    const shortPositionSize = Number(position.shortPositionSize);

    const longUnrealizedPnL = (longPrice - longEntryPrice) * longPositionSize;
    const shortUnrealizedPnL = (shortEntryPrice - shortPrice) * shortPositionSize;

    // 5. 估算平倉損益
    const estimated = estimatePnL(
      longEntryPrice,
      longPrice,
      longPositionSize,
      shortEntryPrice,
      shortPrice,
      shortPositionSize,
    );

    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionId,
        longPrice,
        shortPrice,
        estimatedNetPnL: estimated.netPnL,
      },
      'Get position market data request completed',
    );

    const response: PositionMarketDataResponse = {
      success: true,
      data: {
        positionId,
        symbol: position.symbol,
        longExchange: {
          name: position.longExchange,
          currentPrice: longPrice,
          entryPrice: position.longEntryPrice.toString(),
          unrealizedPnL: longUnrealizedPnL,
        },
        shortExchange: {
          name: position.shortExchange,
          currentPrice: shortPrice,
          entryPrice: position.shortEntryPrice.toString(),
          unrealizedPnL: shortUnrealizedPnL,
        },
        estimatedPnL: {
          priceDiffPnL: estimated.priceDiffPnL,
          fees: estimated.estimatedFees,
          netPnL: estimated.netPnL,
        },
        updatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * 獲取即時價格
 */
async function getCurrentPrice(symbol: string, exchange: SupportedExchange): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ccxt = require('ccxt');

    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
    };

    const exchangeId = exchangeMap[exchange];
    const ExchangeClass = ccxt[exchangeId];

    const ccxtExchange = new ExchangeClass({
      sandbox: false,
      options: { defaultType: 'swap' },
    });

    // 格式化交易對
    const ccxtSymbol = formatSymbolForCcxt(symbol);

    const ticker = await ccxtExchange.fetchTicker(ccxtSymbol);

    return ticker.last || 0;
  } catch (error) {
    logger.error({ error, symbol, exchange }, 'Failed to fetch current price');
    throw new TradingError(
      `無法獲取 ${exchange} ${symbol} 價格`,
      'PRICE_FETCH_FAILED',
      true,
      { exchange, symbol },
    );
  }
}

/**
 * 格式化交易對為 CCXT 格式
 */
function formatSymbolForCcxt(symbol: string): string {
  // 例如 BTCUSDT -> BTC/USDT:USDT
  if (symbol.endsWith('USDT')) {
    const base = symbol.slice(0, -4);
    return `${base}/USDT:USDT`;
  }
  return symbol;
}
