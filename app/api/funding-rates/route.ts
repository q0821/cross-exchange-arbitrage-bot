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
        userId: user.userId,
        isActive: true,
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
          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
              symbol,
            },
            'Starting to fetch funding rate',
          );

          let exchange: ccxt.Exchange;
          const decryptedKey = decrypt(apiKey.encryptedKey);
          const decryptedSecret = decrypt(apiKey.encryptedSecret);

          // 判斷是否為測試環境（使用資料庫的 environment 欄位）
          const isTestnet = apiKey.environment === 'TESTNET';

          if (apiKey.exchange === 'binance') {
            const config: any = {
              apiKey: decryptedKey,
              secret: decryptedSecret,
              enableRateLimit: true,
              options: {
                defaultType: 'future', // 永續合約
              },
            };

            // Binance 測試網設定
            if (isTestnet) {
              config.options.testnet = true;
              config.hostname = 'testnet.binancefuture.com';
            }

            exchange = new (ccxt as any).binance(config);
          } else if (apiKey.exchange === 'okx') {
            const decryptedPassphrase = apiKey.encryptedPassphrase
              ? decrypt(apiKey.encryptedPassphrase)
              : undefined;

            const config: any = {
              apiKey: decryptedKey,
              secret: decryptedSecret,
              password: decryptedPassphrase,
              enableRateLimit: true,
              options: {
                defaultType: 'swap', // 永續合約
              },
            };

            // OKX 模擬盤設定
            if (isTestnet) {
              config.options.sandboxMode = true;
            }

            exchange = new (ccxt as any).okx(config);
          } else {
            return null;
          }

          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
              environment: apiKey.environment,
              isTestnet,
              label: apiKey.label,
            },
            `Using ${isTestnet ? 'TESTNET' : 'MAINNET'} environment`,
          );

          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
            },
            'Exchange initialized, loading markets...',
          );

          // 加載市場數據
          await exchange.loadMarkets();

          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
            },
            'Markets loaded successfully',
          );

          // 查詢資金費率和價格
          const [fundingRate, ticker] = await Promise.all([
            exchange.fetchFundingRate(symbol).catch((err) => {
              logger.error(
                {
                  correlationId,
                  exchange: apiKey.exchange,
                  symbol,
                  error: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined,
                },
                'Failed to fetch funding rate',
              );
              return null;
            }),
            exchange.fetchTicker(symbol).catch((err) => {
              logger.error(
                {
                  correlationId,
                  exchange: apiKey.exchange,
                  symbol,
                  error: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined,
                },
                'Failed to fetch ticker',
              );
              return null;
            }),
          ]);

          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
              fundingRateData: fundingRate ? {
                fundingRate: fundingRate.fundingRate,
                fundingTimestamp: fundingRate.fundingTimestamp,
                symbol: fundingRate.symbol,
              } : null,
              tickerData: ticker ? {
                last: ticker.last,
                symbol: ticker.symbol,
                hasInfo: !!(ticker as any).info,
              } : null,
            },
            'Fetched data from exchange',
          );

          const result = {
            exchange: apiKey.exchange,
            label: apiKey.label,
            symbol,
            fundingRate: fundingRate?.fundingRate || null,
            nextFundingTime: fundingRate?.fundingTimestamp || null,
            markPrice: ticker?.last || null,
            indexPrice: (ticker as any)?.info?.indexPrice || null,
            timestamp: new Date().toISOString(),
          };

          logger.info(
            {
              correlationId,
              exchange: apiKey.exchange,
              result,
            },
            'Prepared result object',
          );

          return result;
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
