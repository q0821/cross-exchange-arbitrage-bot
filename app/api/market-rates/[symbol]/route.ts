/**
 * GET /api/market-rates/[symbol]
 * 獲取單一交易對的詳細資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { ratesCache } from '@/src/services/monitor/RatesCache';
import { logger } from '@/src/lib/logger';

interface RouteParams {
  params: {
    symbol: string;
  };
}

/**
 * GET /api/market-rates/[symbol]
 * 返回單一交易對的詳細資訊
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { symbol } = params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol,
      },
      'Get market rate for symbol request received',
    );

    // 2. 從快取獲取交易對數據
    const rate = ratesCache.get(symbol);

    if (!rate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SYMBOL_NOT_FOUND',
            message: `交易對 ${symbol} 未被監控或數據已過期`,
          },
        },
        { status: 404 },
      );
    }

    // 3. 計算詳細資訊
    const TOTAL_COST_RATE = 0.005; // 0.5%
    const spreadPercent = rate.spreadPercent;
    const netSpread = (spreadPercent / 100) - TOTAL_COST_RATE;
    const netAnnualized = netSpread * 365 * 3 * 100;

    // 判斷狀態
    let status: 'opportunity' | 'approaching' | 'normal';
    if (spreadPercent >= 0.5) {
      status = 'opportunity';
    } else if (spreadPercent >= 0.4 && spreadPercent < 0.5) {
      status = 'approaching';
    } else {
      status = 'normal';
    }

    // 判斷套利方向
    const shouldLongOnBinance = rate.binance.fundingRate < rate.okx.fundingRate;
    const longExchange = shouldLongOnBinance ? 'binance' : 'okx';
    const shortExchange = shouldLongOnBinance ? 'okx' : 'binance';

    // 4. 返回詳細資訊
    const response = NextResponse.json(
      {
        success: true,
        data: {
          symbol: rate.symbol,
          binance: {
            rate: rate.binance.fundingRate,
            ratePercent: (rate.binance.fundingRate * 100).toFixed(4),
            annualized: (rate.binance.getAnnualizedRate() * 100).toFixed(2),
            price: rate.binancePrice || rate.binance.markPrice,
            nextFundingTime: rate.binance.nextFundingTime.toISOString(),
            timeUntilFunding: rate.binance.getTimeUntilNextFunding(),
          },
          okx: {
            rate: rate.okx.fundingRate,
            ratePercent: (rate.okx.fundingRate * 100).toFixed(4),
            annualized: (rate.okx.getAnnualizedRate() * 100).toFixed(2),
            price: rate.okxPrice || rate.okx.markPrice,
            nextFundingTime: rate.okx.nextFundingTime.toISOString(),
            timeUntilFunding: rate.okx.getTimeUntilNextFunding(),
          },
          spread: {
            absolute: spreadPercent / 100,
            percent: spreadPercent.toFixed(4),
            annualized: rate.spreadAnnualized.toFixed(2),
            netAnnualized: netAnnualized.toFixed(2),
          },
          priceDiff: {
            absolute: rate.binancePrice && rate.okxPrice
              ? Math.abs(rate.binancePrice - rate.okxPrice)
              : null,
            percent: rate.priceDiffPercent?.toFixed(4) || null,
          },
          arbitrage: {
            status,
            longExchange,
            shortExchange,
            isValid: status === 'opportunity',
            reason: status === 'opportunity'
              ? '費率差異超過閾值，且價差方向有利'
              : status === 'approaching'
              ? '費率差異接近閾值'
              : '費率差異低於閾值',
          },
          cost: {
            totalCostRate: TOTAL_COST_RATE,
            totalCostPercent: (TOTAL_COST_RATE * 100).toFixed(2),
            breakdown: {
              tradingFees: '0.20%',
              slippage: '0.10%',
              priceDiff: '0.15%',
              safetyMargin: '0.05%',
            },
          },
          timestamp: rate.recordedAt.toISOString(),
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol,
        status,
      },
      'Market rate detail retrieved successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
