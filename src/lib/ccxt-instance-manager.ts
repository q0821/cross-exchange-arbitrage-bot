/**
 * CcxtInstanceManager
 *
 * 請求級別的 CCXT 實例管理器，確保同一請求內對同一交易所只調用一次 loadMarkets()
 *
 * 使用場景：
 * - PositionDetailsService.getPositionDetails() 內創建 manager
 * - 共享實例給多個子服務（價格查詢、資金費率查詢）
 * - 請求結束時調用 clear() 清理資源
 */

import type * as ccxt from 'ccxt';
import { PrismaClient } from '@/generated/prisma/client';
import { createCcxtExchange, createPublicExchange, type SupportedExchange } from './ccxt-factory';
import { decrypt } from './encryption';
import { logger } from './logger';

export class CcxtInstanceManager {
  private prisma: PrismaClient;
  private publicInstances = new Map<string, ccxt.Exchange>();
  private authenticatedInstances = new Map<string, ccxt.Exchange>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 獲取公開 API 實例（用於 fetchTicker 等不需認證的操作）
   * 已自動調用 loadMarkets()
   *
   * @param exchange - 交易所名稱
   * @returns CCXT Exchange 實例（已載入市場資訊）
   */
  async getPublicExchange(exchange: SupportedExchange): Promise<ccxt.Exchange> {
    if (this.publicInstances.has(exchange)) {
      logger.debug({ exchange }, 'Reusing cached public CCXT instance');
      return this.publicInstances.get(exchange)!;
    }

    const instance = createPublicExchange(exchange);
    await instance.loadMarkets();
    this.publicInstances.set(exchange, instance);

    logger.debug({ exchange }, 'Created and cached public CCXT instance');
    return instance;
  }

  /**
   * 獲取認證 API 實例（用於 fetchFundingHistory 等需認證的操作）
   * 已自動調用 loadMarkets()
   *
   * 特殊處理：
   * - Binance Portfolio Margin 偵測與重建（如需要）
   *
   * @param exchange - 交易所名稱
   * @param userId - 用戶 ID（用於查詢 API Key）
   * @param detectPortfolioMargin - 是否偵測 Binance Portfolio Margin（預設 true）
   * @returns CCXT Exchange 實例（已載入市場資訊）
   */
  async getAuthenticatedExchange(
    exchange: SupportedExchange,
    userId: string,
    detectPortfolioMargin = true,
  ): Promise<ccxt.Exchange> {
    const key = `${userId}:${exchange}`;

    if (this.authenticatedInstances.has(key)) {
      logger.debug({ exchange, userId }, 'Reusing cached authenticated CCXT instance');
      return this.authenticatedInstances.get(key)!;
    }

    // 查詢並解密 API Key
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { userId, exchange, isActive: true },
    });

    if (!apiKey) {
      throw new Error(`No active API key found for ${exchange}`);
    }

    const decryptedKey = decrypt(apiKey.encryptedKey);
    const decryptedSecret = decrypt(apiKey.encryptedSecret);
    const decryptedPassphrase = apiKey.encryptedPassphrase
      ? decrypt(apiKey.encryptedPassphrase)
      : undefined;

    let instance = createCcxtExchange(exchange, {
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
      enableRateLimit: true,
      options: {
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    });

    // Binance Portfolio Margin 偵測（僅在需要時執行）
    if (exchange === 'binance' && detectPortfolioMargin) {
      const isPortfolioMargin = await this.detectBinanceAccountType(instance);
      if (isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled (CcxtInstanceManager)');
        instance = createCcxtExchange(exchange, {
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

    await instance.loadMarkets();
    this.authenticatedInstances.set(key, instance);

    logger.debug({ exchange, userId }, 'Created and cached authenticated CCXT instance');
    return instance;
  }

  /**
   * 偵測 Binance 帳戶類型（標準合約 vs Portfolio Margin）
   *
   * @param ccxtExchange - Binance CCXT 實例
   * @returns true 為 Portfolio Margin，false 為標準合約
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async detectBinanceAccountType(ccxtExchange: any): Promise<boolean> {
    // 先嘗試標準 Futures API
    try {
      await ccxtExchange.fapiPrivateGetPositionSideDual();
      logger.info('Binance standard Futures account detected (CcxtInstanceManager)');
      return false;
    } catch (fapiError: unknown) {
      const fapiErrorMsg = fapiError instanceof Error ? fapiError.message : String(fapiError);
      logger.debug({ error: fapiErrorMsg }, 'Standard Futures API failed, trying Portfolio Margin');
    }

    // 標準 API 失敗，嘗試 Portfolio Margin API
    try {
      await ccxtExchange.papiGetUmPositionSideDual();
      logger.info('Binance Portfolio Margin account detected (CcxtInstanceManager)');
      return true;
    } catch (papiError: unknown) {
      const papiErrorMsg = papiError instanceof Error ? papiError.message : String(papiError);
      logger.debug({ error: papiErrorMsg }, 'Portfolio Margin API also failed');
    }

    // 無法偵測，預設標準帳戶
    logger.info('Binance account type detection failed, defaulting to standard (CcxtInstanceManager)');
    return false;
  }

  /**
   * 清理所有實例（請求結束時調用）
   *
   * 建議在 try-finally 區塊中調用：
   * ```typescript
   * const manager = new CcxtInstanceManager(prisma);
   * try {
   *   // 使用 manager
   * } finally {
   *   manager.clear();
   * }
   * ```
   */
  clear(): void {
    const publicCount = this.publicInstances.size;
    const authenticatedCount = this.authenticatedInstances.size;

    this.publicInstances.clear();
    this.authenticatedInstances.clear();

    if (publicCount > 0 || authenticatedCount > 0) {
      logger.debug(
        { publicCount, authenticatedCount },
        'Cleared CCXT instance cache',
      );
    }
  }
}
