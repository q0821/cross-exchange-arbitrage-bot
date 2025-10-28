import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { decrypt } from '@/src/lib/encryption';
import { logger } from '@/src/lib/logger';
import ccxt from 'ccxt';

const prisma = new PrismaClient();

/**
 * GET /api/funding-rates
 * 查詢即時資金費率和合約價格
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC/USDT:USDT';

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol,
      },
      'Get funding rates request received',
    );

    // 3. 查詢用戶的 API Keys
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        user_id: user.userId,
        is_active: true,
      },
    });

    if (apiKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_API_KEYS',
            message: '請先設定交易所 API Key',
          },
        },
        { status: 400 },
      );
    }

    // 4. 建立交易所連接並查詢資金費率
    const results = await Promise.all(
      apiKeys.map(async (apiKey) => {
        try {
          let exchange;
          const decryptedKey = decrypt(apiKey.api_key);
          const decryptedSecret = decrypt(apiKey.api_secret);

          if (apiKey.exchange === 'binance') {
            exchange = new ccxt.binance({
              apiKey: decryptedKey,
              secret: decryptedSecret,
            });
          } else if (apiKey.exchange === 'okx') {
            const decryptedPassphrase = apiKey.passphrase
              ? decrypt(apiKey.passphrase)
              : undefined;
            exchange = new ccxt.okx({
              apiKey: decryptedKey,
              secret: decryptedSecret,
              password: decryptedPassphrase,
            });
          } else {
            return null;
          }

          // 查詢資金費率和價格
          const [fundingRate, ticker] = await Promise.all([
            exchange.fetchFundingRate(symbol).catch(() => null),
            exchange.fetchTicker(symbol).catch(() => null),
          ]);

          return {
            exchange: apiKey.exchange,
            label: apiKey.label,
            symbol,
            fundingRate: fundingRate?.fundingRate || null,
            nextFundingTime: fundingRate?.fundingTimestamp || null,
            markPrice: ticker?.last || null,
            indexPrice: ticker?.info?.indexPrice || null,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          logger.error(
            {
              correlationId,
              exchange: apiKey.exchange,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Failed to fetch funding rate',
          );
          return null;
        }
      }),
    );

    // 過濾掉失敗的查詢
    const successfulResults = results.filter((r) => r !== null);

    // 5. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          rates: successfulResults,
          total: successfulResults.length,
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        count: successfulResults.length,
      },
      'Funding rates retrieved successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
