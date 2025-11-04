/**
 * GET /api/market-rates
 * 獲取所有交易對的即時資金費率（從全局快取）
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * 此 API 從 RatesCache 讀取由 CLI Monitor 服務填充的數據
 * 不需要用戶自己的 API Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { ratesCache } from '@/src/services/monitor/RatesCache';
import { logger } from '@/src/lib/logger';

/**
 * GET /api/market-rates
 * 返回所有交易對的當前資金費率和統計資訊
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const thresholdParam = searchParams.get('threshold');
    const threshold = thresholdParam ? parseFloat(thresholdParam) : 0.5;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        threshold,
      },
      'Get market rates request received',
    );

    // 3. 從全局快取獲取數據
    const rates = ratesCache.getAll();
    const stats = ratesCache.getStats(threshold);

    // 4. 轉換數據格式為 API 響應格式
    const formattedRates = rates.map((rate) => {
      // 使用 bestPair 的差價數據
      const spreadPercent = rate.bestPair?.spreadPercent ?? 0;

      // 判斷狀態
      let status: 'opportunity' | 'approaching' | 'normal';
      if (spreadPercent >= threshold) {
        status = 'opportunity';
      } else if (spreadPercent >= threshold - 0.1 && spreadPercent < threshold) {
        status = 'approaching';
      } else {
        status = 'normal';
      }

      // 計算淨收益（扣除成本）
      const TOTAL_COST_RATE = 0.005; // 0.5%
      const netSpread = (spreadPercent / 100) - TOTAL_COST_RATE;
      const netAnnualized = netSpread * 365 * 3 * 100; // 轉換為百分比

      // 構建所有交易所的數據
      const exchanges: Record<string, any> = {};
      for (const [exchangeName, exchangeData] of rate.exchanges) {
        exchanges[exchangeName] = {
          rate: exchangeData.rate.fundingRate,
          ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
          price: exchangeData.price || exchangeData.rate.markPrice,
          nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
        };
      }

      // 構建 bestPair 信息
      const bestPair = rate.bestPair
        ? {
            longExchange: rate.bestPair.longExchange,
            shortExchange: rate.bestPair.shortExchange,
            spreadPercent: rate.bestPair.spreadPercent.toFixed(4),
            annualizedReturn: rate.bestPair.spreadAnnualized.toFixed(2),
            netReturn: netAnnualized.toFixed(2),
            priceDiffPercent: rate.bestPair.priceDiffPercent?.toFixed(4) || null,
          }
        : null;

      return {
        symbol: rate.symbol,
        exchanges,
        bestPair,
        status,
        timestamp: rate.recordedAt.toISOString(),
      };
    });

    // 5. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          rates: formattedRates,
          stats: {
            totalSymbols: stats.totalSymbols,
            opportunityCount: stats.opportunityCount,
            approachingCount: stats.approachingCount,
            maxSpread: stats.maxSpread
              ? {
                  symbol: stats.maxSpread.symbol,
                  spread: stats.maxSpread.spread.toFixed(4),
                }
              : null,
            uptime: stats.uptime,
            lastUpdate: stats.lastUpdate?.toISOString() || null,
          },
          threshold: threshold.toFixed(2),
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        count: formattedRates.length,
        opportunityCount: stats.opportunityCount,
      },
      'Market rates retrieved successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
