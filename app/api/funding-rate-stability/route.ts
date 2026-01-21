/**
 * GET /api/funding-rate-stability
 *
 * 查詢交易對在指定交易所的資金費率穩定性
 * 用於開倉前預先檢查費率是否頻繁翻轉
 *
 * Feature: 資金費率穩定性檢測功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { FundingRateHistoryService } from '@/src/services/monitor/FundingRateHistoryService';
import type { ExchangeName } from '@/src/connectors/types';

/** 請求參數驗證 schema */
const QuerySchema = z.object({
  symbol: z.string().min(1, 'symbol 不能為空'),
  longExchange: z.enum(['binance', 'okx', 'mexc', 'gateio', 'bingx']),
  shortExchange: z.enum(['binance', 'okx', 'mexc', 'gateio', 'bingx']),
});

/** API 回應格式 */
interface StabilityResponse {
  success: true;
  data: {
    symbol: string;
    longExchange: {
      exchange: ExchangeName;
      isStable: boolean;
      flipCount: number;
      directionConsistency: number;
      warning?: string;
      supported: boolean;
      unsupportedReason?: string;
    };
    shortExchange: {
      exchange: ExchangeName;
      isStable: boolean;
      flipCount: number;
      directionConsistency: number;
      warning?: string;
      supported: boolean;
      unsupportedReason?: string;
    };
    /** 是否有任一邊不穩定 */
    hasUnstableExchange: boolean;
    /** 綜合警告訊息 */
    combinedWarning?: string;
  };
}

/**
 * GET /api/funding-rate-stability?symbol=BTCUSDT&longExchange=binance&shortExchange=okx
 *
 * 查詢開倉前的費率穩定性
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    await authenticate(request);

    // 2. 解析並驗證請求參數
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const longExchange = searchParams.get('longExchange');
    const shortExchange = searchParams.get('shortExchange');

    const validated = QuerySchema.parse({
      symbol,
      longExchange,
      shortExchange,
    });

    logger.info(
      {
        correlationId,
        symbol: validated.symbol,
        longExchange: validated.longExchange,
        shortExchange: validated.shortExchange,
      },
      'Funding rate stability check requested'
    );

    // 3. 查詢兩個交易所的穩定性
    const service = new FundingRateHistoryService({
      hoursToCheck: 24,
      flipThreshold: 2,
    });

    const [longResult, shortResult] = await Promise.all([
      service.checkStability(validated.longExchange as ExchangeName, validated.symbol),
      service.checkStability(validated.shortExchange as ExchangeName, validated.symbol),
    ]);

    // 清理資源
    service.destroy();

    // 4. 組合警告訊息
    const hasUnstableExchange = !longResult.isStable || !shortResult.isStable;
    let combinedWarning: string | undefined;

    if (hasUnstableExchange) {
      const warnings: string[] = [];

      if (!longResult.isStable && longResult.warning) {
        warnings.push(`${validated.longExchange}: ${longResult.warning}`);
      }

      if (!shortResult.isStable && shortResult.warning) {
        warnings.push(`${validated.shortExchange}: ${shortResult.warning}`);
      }

      if (warnings.length > 0) {
        combinedWarning = `費率不穩定警告：${warnings.join('；')}`;
      }
    }

    // 5. 構建回應
    const response: StabilityResponse = {
      success: true,
      data: {
        symbol: validated.symbol,
        longExchange: {
          exchange: longResult.exchange,
          isStable: longResult.isStable,
          flipCount: longResult.flipCount,
          directionConsistency: longResult.directionConsistency,
          warning: longResult.warning,
          supported: longResult.supported,
          unsupportedReason: longResult.unsupportedReason,
        },
        shortExchange: {
          exchange: shortResult.exchange,
          isStable: shortResult.isStable,
          flipCount: shortResult.flipCount,
          directionConsistency: shortResult.directionConsistency,
          warning: shortResult.warning,
          supported: shortResult.supported,
          unsupportedReason: shortResult.unsupportedReason,
        },
        hasUnstableExchange,
        combinedWarning,
      },
    };

    logger.info(
      {
        correlationId,
        symbol: validated.symbol,
        longStable: longResult.isStable,
        shortStable: shortResult.isStable,
        hasUnstableExchange,
      },
      'Funding rate stability check completed'
    );

    return NextResponse.json(response);
  } catch (error) {
    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: '請求參數無效',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    logger.error(
      {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Funding rate stability check failed'
    );

    return handleError(error, correlationId);
  }
}
