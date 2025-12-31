/**
 * FundingFeeQueryService
 *
 * 資金費率歷史查詢服務：從各交易所查詢持倉期間的資金費率收支
 * Feature: 041-funding-rate-pnl-display
 */

import { PrismaClient } from '@/generated/prisma/client';
import { createPrismaClient } from '@/lib/prisma-factory';
import * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import type {
  SupportedExchange,
  FundingFeeEntry,
  FundingFeeQueryResult,
  BilateralFundingFeeResult,
} from '../../types/trading';

/**
 * 資金費率歷史查詢服務
 */
export class FundingFeeQueryService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || createPrismaClient();
  }

  /**
   * 偵測 Binance 帳戶類型（標準合約 vs Portfolio Margin）
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async detectBinanceAccountType(ccxtExchange: any): Promise<{
    isPortfolioMargin: boolean;
  }> {
    // 先嘗試標準 Futures API
    try {
      await ccxtExchange.fapiPrivateGetPositionSideDual();
      logger.info('Binance standard Futures account detected (FundingFeeQueryService)');
      return { isPortfolioMargin: false };
    } catch (fapiError: unknown) {
      const fapiErrorMsg = fapiError instanceof Error ? fapiError.message : String(fapiError);
      logger.debug({ error: fapiErrorMsg }, 'Standard Futures API failed, trying Portfolio Margin');
    }

    // 標準 API 失敗，嘗試 Portfolio Margin API
    try {
      await ccxtExchange.papiGetUmPositionSideDual();
      logger.info('Binance Portfolio Margin account detected (FundingFeeQueryService)');
      return { isPortfolioMargin: true };
    } catch (papiError: unknown) {
      const papiErrorMsg = papiError instanceof Error ? papiError.message : String(papiError);
      logger.debug({ error: papiErrorMsg }, 'Portfolio Margin API also failed');
    }

    // 無法偵測，預設標準帳戶
    logger.info('Binance account type detection failed, defaulting to standard (FundingFeeQueryService)');
    return { isPortfolioMargin: false };
  }

  /**
   * 創建已認證的 CCXT 交易所實例
   */
  private async createCcxtExchange(
    exchange: SupportedExchange,
    userId: string,
  ): Promise<ccxt.Exchange> {
    // 獲取用戶的 API Key
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        userId,
        exchange,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new Error(`No active API key found for ${exchange}`);
    }

    // 解密 API Key
    const decryptedKey = decrypt(apiKey.encryptedKey);
    const decryptedSecret = decrypt(apiKey.encryptedSecret);
    const decryptedPassphrase = apiKey.encryptedPassphrase
      ? decrypt(apiKey.encryptedPassphrase)
      : undefined;

    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
      bingx: 'bingx',
    };

    const exchangeId = exchangeMap[exchange];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExchangeClass = (ccxt as any)[exchangeId];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
      enableRateLimit: true,
      options: {
        // Binance 使用 'future'，其他交易所使用 'swap'
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    };

    let ccxtExchange = new ExchangeClass(config);

    // Binance Portfolio Margin 偵測
    if (exchange === 'binance') {
      const accountType = await this.detectBinanceAccountType(ccxtExchange);
      if (accountType.isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled (FundingFeeQueryService)');
        config.options = {
          ...config.options,
          portfolioMargin: true,
        };
        ccxtExchange = new ExchangeClass(config);
      }
    }

    return ccxtExchange;
  }

  /**
   * 轉換內部 symbol 格式為 CCXT 格式
   * e.g., BTCUSDT -> BTC/USDT:USDT
   */
  private convertToCcxtSymbol(symbol: string): string {
    // 常見的 quote 貨幣
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];

    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}/${quote}:${quote}`;
      }
    }

    // 如果無法解析，返回原始 symbol（讓 CCXT 處理）
    logger.warn({ symbol }, 'Unable to parse symbol format, using as-is');
    return symbol;
  }

  /**
   * 查詢單一交易所的資金費率歷史
   */
  async queryFundingFees(
    exchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string,
  ): Promise<FundingFeeQueryResult> {
    const ccxtSymbol = this.convertToCcxtSymbol(symbol);
    const result: FundingFeeQueryResult = {
      exchange,
      symbol,
      startTime,
      endTime,
      entries: [],
      totalAmount: new Decimal(0),
      success: false,
    };

    try {
      const ccxtExchange = await this.createCcxtExchange(exchange, userId);

      // 必須先載入市場資訊
      await ccxtExchange.loadMarkets();

      logger.info(
        {
          exchange,
          symbol,
          ccxtSymbol,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        'Querying funding fee history',
      );

      // BingX 需要使用原生 API，因為 CCXT 不支援 fetchFundingHistory
      if (exchange === 'bingx') {
        return await this.queryBingxFundingFees(
          ccxtExchange,
          symbol,
          startTime,
          endTime,
          result,
        );
      }

      // OKX 需要特殊處理：instType 參數
      const params: Record<string, unknown> = { until: endTime.getTime() };
      if (exchange === 'okx') {
        params.instType = 'SWAP';
      }

      // 調用 CCXT fetchFundingHistory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history = await (ccxtExchange as any).fetchFundingHistory(
        ccxtSymbol,
        startTime.getTime(),
        undefined, // limit
        params,
      );

      // 解析並累加結算記錄
      // 注意：部分交易所（如 Gate.io）可能忽略 until 參數，需要手動過濾
      const startMs = startTime.getTime();
      const endMs = endTime.getTime();
      const entries: FundingFeeEntry[] = [];
      let totalAmount = new Decimal(0);

      for (const entry of history) {
        // 過濾：只保留在開倉和平倉時間範圍內的記錄
        const entryTimestamp = entry.timestamp;
        if (entryTimestamp < startMs || entryTimestamp > endMs) {
          logger.debug(
            { exchange, entryTimestamp, startMs, endMs },
            'Skipping funding entry outside time range',
          );
          continue;
        }

        const amount = new Decimal(entry.amount || 0);
        entries.push({
          timestamp: entry.timestamp,
          datetime: entry.datetime,
          amount,
          symbol: entry.symbol,
          id: entry.id || String(entry.timestamp),
        });
        totalAmount = totalAmount.plus(amount);
      }

      result.entries = entries;
      result.totalAmount = totalAmount;
      result.success = true;

      logger.info(
        {
          exchange,
          symbol,
          entriesCount: entries.length,
          totalAmount: totalAmount.toFixed(8),
        },
        'Funding fee query completed',
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { error: errorMessage, exchange, symbol },
        'Failed to fetch funding history, defaulting to 0',
      );
      result.error = errorMessage;
      return result;
    }
  }

  /**
   * BingX 資金費率歷史查詢
   *
   * 使用 BingX 原生 API /openApi/swap/v2/user/income
   * 因為 CCXT 不支援 BingX 的 fetchFundingHistory
   *
   * 注意：BingX API 帶 symbol 參數時可能返回 null，
   * 因此改為不帶 symbol 查詢所有記錄，再在結果中過濾
   */
  private async queryBingxFundingFees(
    ccxtExchange: ccxt.Exchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    result: FundingFeeQueryResult,
  ): Promise<FundingFeeQueryResult> {
    try {
      // 轉換 symbol 格式：BTCUSDT -> BTC-USDT（用於結果過濾）
      const bingxSymbol = symbol.replace(/([A-Z]+)(USDT|USDC|USD)$/, '$1-$2');

      logger.info(
        { symbol, bingxSymbol, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
        '[BingX] Querying funding fee history via native API',
      );

      // 嘗試多種 API 端點
      let data: unknown[] = [];

      try {
        // 方法 1: 使用 swapV2PrivateGetUserIncome
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (ccxtExchange as any).swapV2PrivateGetUserIncome({
          incomeType: 'FUNDING_FEE',
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          limit: 1000,
        });

        logger.debug(
          { response: JSON.stringify(response).slice(0, 500) },
          '[BingX] swapV2PrivateGetUserIncome response',
        );

        data = response?.data || [];
      } catch (apiError) {
        const apiErrorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        logger.debug({ error: apiErrorMsg }, '[BingX] swapV2PrivateGetUserIncome failed, trying alternative');

        // 方法 2: 使用 privateGetSwapV2UserIncome
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response2 = await (ccxtExchange as any).privateGetSwapV2UserIncome({
            incomeType: 'FUNDING_FEE',
            startTime: startTime.getTime(),
            endTime: endTime.getTime(),
            limit: 1000,
          });

          logger.debug(
            { response: JSON.stringify(response2).slice(0, 500) },
            '[BingX] privateGetSwapV2UserIncome response',
          );

          data = response2?.data || [];
        } catch (apiError2) {
          const apiError2Msg = apiError2 instanceof Error ? apiError2.message : String(apiError2);
          logger.debug({ error: apiError2Msg }, '[BingX] privateGetSwapV2UserIncome also failed');

          // 方法 3: 嘗試使用 fetchMyTrades 獲取資金費率
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const trades = await (ccxtExchange as any).fetchMyTrades(
              `${symbol.replace(/([A-Z]+)(USDT|USDC|USD)$/, '$1/$2:$2')}`,
              startTime.getTime(),
              undefined,
              { endTime: endTime.getTime() },
            );

            // 過濾出 funding fee 交易
            const fundingTrades = trades.filter((t: { type?: string; info?: { tradeType?: string } }) =>
              t.type === 'funding' || t.info?.tradeType === 'FUNDING_FEE'
            );

            data = fundingTrades.map((t: { timestamp: number; datetime: string; amount?: number; cost?: number; id?: string }) => ({
              time: t.timestamp,
              income: t.amount || t.cost || 0,
              symbol: bingxSymbol,
              tranId: t.id,
            }));

            logger.debug({ fundingTradesCount: data.length }, '[BingX] Extracted funding from trades');
          } catch (tradeError) {
            logger.debug(
              { error: tradeError instanceof Error ? tradeError.message : String(tradeError) },
              '[BingX] fetchMyTrades also failed',
            );
          }
        }
      }

      // 解析響應
      // BingX 返回格式: { code: 0, data: [{ income, symbol, time, ... }] }
      const entries: FundingFeeEntry[] = [];
      let totalAmount = new Decimal(0);

      for (const entry of data as Array<{
        symbol?: string;
        income?: string | number;
        amount?: string | number;
        time?: string | number;
        timestamp?: string | number;
        tranId?: string;
        id?: string;
      }>) {
        // 過濾：只保留匹配的 symbol
        const entrySymbol = entry.symbol || '';
        if (entrySymbol && entrySymbol !== bingxSymbol) {
          continue;
        }

        const amount = new Decimal(entry.income || entry.amount || 0);
        const timestamp = parseInt(String(entry.time || entry.timestamp), 10);

        if (isNaN(timestamp)) continue;

        entries.push({
          timestamp,
          datetime: new Date(timestamp).toISOString(),
          amount,
          symbol: entrySymbol || bingxSymbol,
          id: entry.tranId || entry.id || String(timestamp),
        });
        totalAmount = totalAmount.plus(amount);
      }

      result.entries = entries;
      result.totalAmount = totalAmount;
      result.success = entries.length > 0 || data.length === 0; // 空結果也算成功

      logger.info(
        {
          exchange: 'bingx',
          symbol,
          bingxSymbol,
          totalRecords: data.length,
          matchedRecords: entries.length,
          totalAmount: totalAmount.toFixed(8),
        },
        '[BingX] Funding fee query completed',
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { error: errorMessage, symbol },
        '[BingX] Failed to fetch funding history',
      );
      result.error = errorMessage;
      return result;
    }
  }

  /**
   * 查詢雙邊的資金費率歷史並加總
   */
  async queryBilateralFundingFees(
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string,
  ): Promise<BilateralFundingFeeResult> {
    logger.info(
      {
        longExchange,
        shortExchange,
        symbol,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      'Querying bilateral funding fees',
    );

    // 並行查詢 Long 和 Short 邊
    const [longResult, shortResult] = await Promise.all([
      this.queryFundingFees(longExchange, symbol, startTime, endTime, userId),
      this.queryFundingFees(shortExchange, symbol, startTime, endTime, userId),
    ]);

    // 計算總資金費率損益
    const totalFundingFee = longResult.totalAmount.plus(shortResult.totalAmount);

    logger.info(
      {
        longAmount: longResult.totalAmount.toFixed(8),
        shortAmount: shortResult.totalAmount.toFixed(8),
        totalFundingFee: totalFundingFee.toFixed(8),
        longSuccess: longResult.success,
        shortSuccess: shortResult.success,
      },
      'Bilateral funding fee query completed',
    );

    return {
      longResult,
      shortResult,
      totalFundingFee,
    };
  }
}

// Export singleton instance
export const fundingFeeQueryService = new FundingFeeQueryService();
