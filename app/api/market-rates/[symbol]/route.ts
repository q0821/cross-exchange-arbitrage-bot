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
    const spreadPercent = rate.bestPair?.spreadPercent ?? 0;
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

    // 使用 bestPair 的套利方向
    const longExchange = rate.bestPair?.longExchange || null;
    const shortExchange = rate.bestPair?.shortExchange || null;

    // 構建所有交易所的詳細資訊
    const exchangesDetail: Record<string, any> = {};
    for (const [exchangeName, exchangeData] of rate.exchanges) {
      exchangesDetail[exchangeName] = {
        rate: exchangeData.rate.fundingRate,
        ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
        annualized: (exchangeData.rate.getAnnualizedRate() * 100).toFixed(2),
        price: exchangeData.price || exchangeData.rate.markPrice,
        nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
        timeUntilFunding: exchangeData.rate.getTimeUntilNextFunding(),
      };
    }

    // 計算價差（使用 bestPair 的兩個交易所）
    let priceDiffAbsolute: number | null = null;
    if (longExchange && shortExchange) {
      const longData = rate.exchanges.get(longExchange);
      const shortData = rate.exchanges.get(shortExchange);
      const longPrice = longData?.price || longData?.rate.markPrice;
      const shortPrice = shortData?.price || shortData?.rate.markPrice;

      if (longPrice && shortPrice) {
        priceDiffAbsolute = Math.abs(longPrice - shortPrice);
      }
    }

    // 4. 返回詳細資訊
    const response = NextResponse.json(
      {
        success: true,
        data: {
          symbol: rate.symbol,
          exchanges: exchangesDetail,
          spread: {
            absolute: spreadPercent / 100,
            percent: spreadPercent.toFixed(4),
            annualized: rate.bestPair?.spreadAnnualized.toFixed(2) || '0.00',
            netAnnualized: netAnnualized.toFixed(2),
          },
          priceDiff: {
            absolute: priceDiffAbsolute,
            percent: rate.bestPair?.priceDiffPercent?.toFixed(4) || null,
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
