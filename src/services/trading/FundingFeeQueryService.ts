/**
 * FundingFeeQueryService
 *
 * 資金費率歷史查詢服務（Orchestrator）：
 * - 負責 API Key 解密、CCXT 實例建立、Binance PM 偵測
 * - 委託各交易所的 FundingFeeAdapter 執行實際查詢
 *
 * Feature: 041-funding-rate-pnl-display
 */

import { PrismaClient } from '@/generated/prisma/client';
import { createPrismaClient } from '@/lib/prisma-factory';
import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import { createCcxtExchange, type SupportedExchange as CcxtSupportedExchange } from '../../lib/ccxt-factory';
import type {
  SupportedExchange,
  FundingFeeQueryResult,
  BilateralFundingFeeResult,
} from '../../types/trading';
import { getFundingFeeAdapter } from './FundingFeeAdapterFactory';

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
   *
   * 使用統一 CCXT 工廠確保 proxy 配置自動套用
   */
  private async createUserCcxtExchange(
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


    let ccxtExchange = createCcxtExchange(exchange as CcxtSupportedExchange, {
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

    // Binance Portfolio Margin 偵測
    if (exchange === 'binance') {
      const accountType = await this.detectBinanceAccountType(ccxtExchange);
      if (accountType.isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled (FundingFeeQueryService)');
        ccxtExchange = createCcxtExchange(exchange as CcxtSupportedExchange, {
          apiKey: decryptedKey,
          secret: decryptedSecret,
          password: decryptedPassphrase,
          sandbox: apiKey.environment === 'TESTNET',
          enableRateLimit: true,
          options: {
            defaultType: 'future',
            portfolioMargin: true,
          },
        });
      }
    }

    return ccxtExchange;
  }

  /**
   * 查詢單一交易所的資金費率歷史
   *
   * @param exchange - 交易所名稱
   * @param symbol - 交易對符號
   * @param startTime - 起始時間
   * @param endTime - 結束時間
   * @param userId - 用戶 ID
   * @param ccxtExchange - 可選的外部 CCXT 實例（已調用 loadMarkets）
   */
  async queryFundingFees(
    exchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string,
    ccxtExchange?: ccxt.Exchange,
  ): Promise<FundingFeeQueryResult> {
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
      // 如果沒有傳入實例，自動創建（向後相容）
      const instance = ccxtExchange || await this.createUserCcxtExchange(exchange, userId);

      // 只有自動創建時才需要 loadMarkets（外部實例已載入）
      if (!ccxtExchange) {
        await instance.loadMarkets();
      }

      logger.info(
        {
          exchange,
          symbol,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          usingExternalInstance: !!ccxtExchange,
        },
        'Querying funding fee history',
      );

      // 取得對應交易所的 adapter 並執行查詢
      const adapter = getFundingFeeAdapter(exchange, instance);
      const entries = await adapter.fetchFundingFees({ symbol, startTime, endTime });

      // 累加總金額
      let totalAmount = new Decimal(0);
      for (const entry of entries) {
        totalAmount = totalAmount.plus(entry.amount);
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
   * 查詢雙邊的資金費率歷史並加總（使用外部 CCXT 實例）
   *
   * @param longExchange - 做多交易所
   * @param shortExchange - 做空交易所
   * @param symbol - 交易對符號
   * @param startTime - 起始時間
   * @param endTime - 結束時間
   * @param longInstance - 做多交易所的 CCXT 實例（已調用 loadMarkets）
   * @param shortInstance - 做空交易所的 CCXT 實例（已調用 loadMarkets）
   */
  async queryBilateralFundingFeesWithInstances(
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    longInstance: ccxt.Exchange,
    shortInstance: ccxt.Exchange,
  ): Promise<BilateralFundingFeeResult> {
    logger.info(
      {
        longExchange,
        shortExchange,
        symbol,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        usingExternalInstances: true,
      },
      'Querying bilateral funding fees with external instances',
    );

    // 並行查詢 Long 和 Short 邊（傳入外部實例）
    const [longResult, shortResult] = await Promise.all([
      this.queryFundingFees(longExchange, symbol, startTime, endTime, '', longInstance),
      this.queryFundingFees(shortExchange, symbol, startTime, endTime, '', shortInstance),
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
      'Bilateral funding fee query with instances completed',
    );

    return {
      longResult,
      shortResult,
      totalFundingFee,
    };
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
