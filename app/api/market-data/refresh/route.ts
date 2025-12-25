/**
 * GET /api/market-data/refresh
 *
 * 即時獲取指定交易對在指定交易所的市場數據（價格、資金費率）
 * Feature: 033-manual-open-position (T012)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import {
  RefreshMarketDataRequestSchema,
  type MarketDataResponse,
  type ExchangeMarketData,
  type SupportedExchange,
} from '@/src/types/trading';

// Rate Limiting
const refreshRateLimits = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 5 * 1000; // 5 秒

/**
 * GET /api/market-data/refresh?symbol=BTCUSDT&exchanges=binance,okx
 *
 * Query Parameters:
 * - symbol: 交易對 (e.g., "BTCUSDT")
 * - exchanges: 逗號分隔的交易所列表 (e.g., "binance,okx")
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     symbol: "BTCUSDT",
 *     exchanges: [
 *       {
 *         exchange: "binance",
 *         price: 43500.50,
 *         fundingRate: 0.0001,
 *         nextFundingTime: "2024-01-15T08:00:00Z",
 *         status: "success"
 *       },
 *       ...
 *     ],
 *     updatedAt: "2024-01-15T07:30:00Z"
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. Rate Limiting 檢查
    const lastRefresh = refreshRateLimits.get(user.userId);
    const now = Date.now();

    if (lastRefresh && now - lastRefresh < REFRESH_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefresh)) / 1000);
      logger.warn(
        { userId: user.userId, remainingSeconds },
        'Rate limit exceeded for market data refresh',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `請等待 ${remainingSeconds} 秒後再刷新`,
          },
        },
        { status: 429 },
      );
    }

    // 記錄刷新時間
    refreshRateLimits.set(user.userId, now);

    // 3. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const exchangesParam = searchParams.get('exchanges');

    // 4. 驗證參數
    const exchanges = exchangesParam
      ?.split(',')
      .map((e) => e.trim().toLowerCase()) as SupportedExchange[];

    const validatedInput = RefreshMarketDataRequestSchema.parse({
      symbol,
      exchanges,
    });

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol: validatedInput.symbol,
        exchanges: validatedInput.exchanges,
      },
      'Market data refresh request received',
    );

    // 5. 獲取市場數據
    const exchangeDataPromises = validatedInput.exchanges.map((exchange) =>
      fetchExchangeMarketData(validatedInput.symbol, exchange),
    );

    const exchangeData = await Promise.all(exchangeDataPromises);

    // 6. 格式化回應
    const response: MarketDataResponse = {
      symbol: validatedInput.symbol,
      exchanges: exchangeData,
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol: validatedInput.symbol,
        exchangeCount: exchangeData.length,
      },
      'Market data refresh completed',
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

/**
 * 獲取單一交易所的市場數據
 */
async function fetchExchangeMarketData(
  symbol: string,
  exchange: SupportedExchange,
): Promise<ExchangeMarketData> {
  try {
    const ccxt = await import('ccxt');
    const exchangeInstance = createCcxtExchange(ccxt, exchange);

    // 格式化交易對
    const ccxtSymbol = formatSymbolForCcxt(symbol);

    // 並行獲取價格和資金費率
    const [ticker, fundingRateInfo] = await Promise.all([
      exchangeInstance.fetchTicker(ccxtSymbol),
      fetchFundingRate(exchangeInstance, ccxtSymbol),
    ]);

    return {
      exchange,
      price: ticker.last || 0,
      fundingRate: fundingRateInfo.rate,
      nextFundingTime: fundingRateInfo.nextFundingTime,
      status: 'success',
    };
  } catch (error) {
    logger.error(
      { error, exchange, symbol },
      'Failed to fetch market data from exchange',
    );

    return {
      exchange,
      price: 0,
      fundingRate: 0,
      nextFundingTime: new Date().toISOString(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 創建 CCXT 交易所實例
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createCcxtExchange(ccxt: any, exchange: SupportedExchange) {
  const exchangeMap: Record<SupportedExchange, string> = {
    binance: 'binance',
    okx: 'okx',
    mexc: 'mexc',
    gateio: 'gateio',
    bingx: 'bingx',
  };

  const exchangeId = exchangeMap[exchange];
  const ExchangeClass = ccxt[exchangeId];

  return new ExchangeClass({
    sandbox: false,
    options: { defaultType: 'swap' },
  });
}

/**
 * 格式化交易對為 CCXT 格式
 */
function formatSymbolForCcxt(symbol: string): string {
  if (symbol.endsWith('USDT')) {
    const base = symbol.slice(0, -4);
    return `${base}/USDT:USDT`;
  }
  return symbol;
}

/**
 * 獲取資金費率
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFundingRate(
  exchange: any,
  symbol: string,
): Promise<{ rate: number; nextFundingTime: string }> {
  try {
    const fundingRate = await exchange.fetchFundingRate(symbol);

    return {
      rate: fundingRate.fundingRate || 0,
      nextFundingTime: fundingRate.fundingTimestamp
        ? new Date(fundingRate.fundingTimestamp).toISOString()
        : new Date().toISOString(),
    };
  } catch (error) {
    logger.warn({ error, symbol }, 'Failed to fetch funding rate');

    return {
      rate: 0,
      nextFundingTime: new Date().toISOString(),
    };
  }
}
