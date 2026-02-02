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
import {
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED,
  APPROACHING_THRESHOLD_RATIO,
} from '@/src/lib/constants';

/**
 * GET /api/market-rates
 * 返回所有交易對的當前資金費率和統計資訊
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數（Feature 022: 改用年化收益門檻）
    const { searchParams } = new URL(request.url);
    const thresholdParam = searchParams.get('threshold');
    // 向後兼容：如果傳入小數（如 0.5），視為舊的 spreadPercent 門檻，轉換為年化收益
    // 新參數應該直接傳入年化收益門檻（如 800）
    const threshold = thresholdParam
      ? parseFloat(thresholdParam) < 10
        ? parseFloat(thresholdParam) * 365 * 3 * 100 // 舊格式轉換
        : parseFloat(thresholdParam)
      : DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED;
    const approachingThreshold = threshold * APPROACHING_THRESHOLD_RATIO;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        threshold,
        approachingThreshold,
      },
      'Get market rates request received',
    );

    // 3. 從全局快取獲取數據
    const rates = ratesCache.getAll();
    const stats = ratesCache.getStats(rates, threshold);  // 傳入 rates 避免重複呼叫 getAll()

    // 4. 轉換數據格式為 API 響應格式
    const formattedRates = rates.map((rate) => {
      // Feature 022: 使用年化收益判斷狀態
      const annualizedReturn = rate.bestPair?.spreadAnnualized ?? 0;

      // 判斷狀態（基於年化收益門檻）
      let status: 'opportunity' | 'approaching' | 'normal';
      if (annualizedReturn >= threshold) {
        status = 'opportunity';
      } else if (annualizedReturn >= approachingThreshold) {
        status = 'approaching';
      } else {
        status = 'normal';
      }

      // netReturn calculation removed - Feature 014: 移除淨收益欄位

      // 構建所有交易所的數據
      const exchanges: Record<string, any> = {};
      for (const [exchangeName, exchangeData] of rate.exchanges) {
        exchanges[exchangeName] = {
          rate: exchangeData.rate.fundingRate,
          ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
          price: exchangeData.price || exchangeData.rate.markPrice,
          nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
          // Feature 019: 新增標準化費率資料
          normalized: exchangeData.normalized || {},
          originalInterval: exchangeData.originalFundingInterval,
        };
      }

      // 構建 bestPair 信息
      const bestPair = rate.bestPair
        ? {
            longExchange: rate.bestPair.longExchange,
            shortExchange: rate.bestPair.shortExchange,
            spreadPercent: rate.bestPair.spreadPercent.toFixed(4),
            annualizedReturn: rate.bestPair.spreadAnnualized.toFixed(2),
            // netReturn field removed - Feature 014: 移除淨收益欄位
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
