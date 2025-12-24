/**
 * FundingFeeQueryService
 *
 * 資金費率歷史查詢服務：從各交易所查詢持倉期間的資金費率收支
 * Feature: 041-funding-rate-pnl-display
 */

import { PrismaClient } from '@prisma/client';
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
    this.prisma = prisma || new PrismaClient();
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
    };

    const exchangeId = exchangeMap[exchange];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExchangeClass = (ccxt as any)[exchangeId];

    return new ExchangeClass({
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
      enableRateLimit: true,
      options: {
        // Binance 使用 'future'，其他交易所使用 'swap'
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    });
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

      // 調用 CCXT fetchFundingHistory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history = await (ccxtExchange as any).fetchFundingHistory(
        ccxtSymbol,
        startTime.getTime(),
        undefined, // limit
        { until: endTime.getTime() },
      );

      // 解析並累加結算記錄
      const entries: FundingFeeEntry[] = [];
      let totalAmount = new Decimal(0);

      for (const entry of history) {
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
