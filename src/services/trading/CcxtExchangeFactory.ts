/**
 * CcxtExchangeFactory
 *
 * 負責創建和配置 CCXT 交易所實例，
 * 包含不同交易所的特殊設定處理
 *
 * Feature: 062-refactor-trading-srp
 *
 * 重要：使用 @/lib/ccxt-factory 統一創建 CCXT 實例
 * 確保 proxy 配置自動套用，避免 IP 白名單問題
 */

import type * as ccxt from 'ccxt';
import { PrismaClient } from '@/generated/prisma/client';
import { logger } from '@/lib/logger';
import { TradingError } from '@/lib/errors';
import { createCcxtExchange, createPublicExchange, type SupportedExchange as CcxtSupportedExchange } from '@/lib/ccxt-factory';
import { loadMarketsWithCache } from '@/lib/ccxt-markets-cache';
import {
  getCachedAccountType,
  setCachedAccountType,
} from '@/lib/account-type-cache';
import { decrypt } from '@/lib/encryption';
import { detectPositionMode } from './PositionModeDetector';
import { detectOkxPositionMode } from './okx-position-mode';
import type {
  CcxtExchange,
  ExchangeConfig,
  ExchangeInstance,
  IBinanceAccountDetector,
  ICcxtExchangeFactory,
  SupportedExchange,
} from '@/types/trading';

/**
 * CCXT 交易所工廠
 *
 * 從 PositionOrchestrator.createCcxtTraderAsync 提取
 * 原始位置：src/services/trading/PositionOrchestrator.ts:776-840
 */
export class CcxtExchangeFactory implements ICcxtExchangeFactory {
  private readonly binanceAccountDetector: IBinanceAccountDetector;

  constructor(binanceAccountDetector: IBinanceAccountDetector) {
    this.binanceAccountDetector = binanceAccountDetector;
  }

  /**
   * 創建交易所實例
   *
   * 流程：
   * 1. 建立基礎 CCXT 配置
   * 2. 處理交易所特殊設定（Binance future type, OKX passphrase）
   * 3. Binance: 偵測帳戶類型，若為 Portfolio Margin 則重新創建實例
   * 4. 載入市場資料
   *
   * @param exchange - 交易所類型
   * @param config - 交易所配置
   * @returns 完整的交易所實例（含偵測結果和市場資料）
   */
  async create(
    exchange: SupportedExchange,
    config: ExchangeConfig,
  ): Promise<ExchangeInstance> {
    // 驗證 exchange 類型
    const supportedExchanges: SupportedExchange[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'];
    if (!supportedExchanges.includes(exchange)) {
      throw new TradingError(
        `Unsupported exchange: ${exchange}`,
        { exchange },
      );
    }


    // 參考：src/lib/ccxt-factory.ts
    // 類型轉換：ccxt.Exchange -> CcxtExchange（運行時具有完整方法）
    let ccxtExchange = createCcxtExchange(exchange as CcxtSupportedExchange, {
      apiKey: config.apiKey,
      secret: config.apiSecret,
      password: config.passphrase, // OKX passphrase
      sandbox: config.isTestnet,
      enableRateLimit: true,
      options: {
        // Binance 使用 future 類型，其他交易所使用 swap
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    }) as unknown as CcxtExchange;

    // 動態偵測 Binance 帳戶類型和持倉模式
    let isPortfolioMargin = false;
    let isHedgeMode = false;

    if (exchange === 'binance') {
      // 先檢查快取
      const cachedAccountType = getCachedAccountType(exchange, config.apiKey);

      if (cachedAccountType) {
        // 使用快取的帳戶類型
        isPortfolioMargin = cachedAccountType.isPortfolioMargin;
        isHedgeMode = cachedAccountType.isHedgeMode;
        logger.info(
          { exchange, isPortfolioMargin, isHedgeMode },
          'Using cached Binance account type',
        );
      } else {
        // 快取不存在或已過期，執行偵測
        const accountType = await this.binanceAccountDetector.detect(ccxtExchange);
        isPortfolioMargin = accountType.isPortfolioMargin;
        isHedgeMode = accountType.isHedgeMode;

        // 如果偵測失敗，記錄警告提示用戶可能需要手動配置
        if (accountType.detectionFailed) {
          logger.warn(
            { exchange, isPortfolioMargin, isHedgeMode },
            'Binance account type detection failed, using defaults. Consider setting hedge mode manually if needed.',
          );
        } else {
          // 偵測成功，寫入快取
          setCachedAccountType(exchange, config.apiKey, { isPortfolioMargin, isHedgeMode });
        }
      }

      // 如果是 Portfolio Margin，需要重新創建 exchange 實例並啟用 portfolioMargin 選項
      if (isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled');
        ccxtExchange = createCcxtExchange(exchange as CcxtSupportedExchange, {
          apiKey: config.apiKey,
          secret: config.apiSecret,
          sandbox: config.isTestnet,
          enableRateLimit: true,
          options: {
            defaultType: 'future',
            portfolioMargin: true,
          },
        }) as unknown as CcxtExchange;
        // 移除這裡的 loadMarkets()，將在最後統一處理並使用 cache
      }
    }

    // OKX：使用專門的 OKX API 偵測持倉模式
    // 原因：CCXT 的 fetchPositionMode 對 OKX 支援有問題
    // detectOkxPositionMode 使用 privateGetAccountConfig API，不需要 markets
    if (exchange === 'okx') {
      // 先檢查快取
      const cachedAccountType = getCachedAccountType(exchange, config.apiKey);

      if (cachedAccountType) {
        // 使用快取的帳戶類型
        isHedgeMode = cachedAccountType.isHedgeMode;
        logger.info(
          { exchange, isHedgeMode },
          'Using cached OKX account type',
        );
      } else {
        try {
          // 使用 OKX 專用的 API 偵測（privateGetAccountConfig）
          const okxMode = await detectOkxPositionMode(ccxtExchange);
          isHedgeMode = okxMode === 'long_short_mode';

          // 偵測成功，寫入快取（OKX 不使用 Portfolio Margin）
          setCachedAccountType(exchange, config.apiKey, { isPortfolioMargin: false, isHedgeMode });

          logger.info(
            { exchange, isHedgeMode, okxMode },
            'Detected OKX position mode via privateGetAccountConfig',
          );
        } catch (error) {
          // 偵測失敗，預設使用雙向模式（較安全），不寫入快取
          isHedgeMode = true;
          logger.warn(
            { exchange, error },
            'Failed to detect OKX position mode, defaulting to hedge mode',
          );
        }
      }
    }

    // BingX：使用 CCXT 的 fetchPositionMode 方法
    // fetchPositionMode 需要 markets，所以需要先載入
    if (exchange === 'bingx') {
      // 先檢查快取
      const cachedAccountType = getCachedAccountType(exchange, config.apiKey);

      if (cachedAccountType) {
        // 使用快取的帳戶類型
        isHedgeMode = cachedAccountType.isHedgeMode;
        logger.info(
          { exchange, isHedgeMode },
          'Using cached BingX account type',
        );

        // 仍需載入 markets（後續操作需要），使用 Singleflight 避免重複載入
        await loadMarketsWithCache(ccxtExchange, exchange);
        logger.debug({ exchange }, 'Markets loaded (BingX, cached account type)');
      } else {
        try {
          // 使用 Singleflight 載入市場資料，避免重複載入
          await loadMarketsWithCache(ccxtExchange, exchange);
          logger.debug({ exchange }, 'Markets loaded (BingX position mode detection)');

          // 使用任意一個交易對來查詢持倉模式（模式是帳戶級別的）
          const sampleSymbol = 'BTC/USDT:USDT';
          const positionMode = await detectPositionMode(
            ccxtExchange,
            exchange,
            sampleSymbol,
          );
          isHedgeMode = positionMode.hedged;

          // 偵測成功，寫入快取（BingX 不使用 Portfolio Margin）
          setCachedAccountType(exchange, config.apiKey, { isPortfolioMargin: false, isHedgeMode });

          logger.info(
            { exchange, isHedgeMode, positionMode },
            'Detected BingX position mode via fetchPositionMode',
          );
        } catch (error) {
          // 偵測失敗，預設使用雙向模式（較安全），不寫入快取
          isHedgeMode = true;
          logger.warn(
            { exchange, error },
            'Failed to detect BingX position mode, defaulting to hedge mode',
          );
        }
      }
    }

    logger.info(
      { exchange, isPortfolioMargin, isHedgeMode },
      'Position mode configuration',
    );

    // 載入市場資料以獲取合約大小（contractSize）
    // 使用 Singleflight 避免 Cache Stampede（快取踩踏）
    // BingX 已在上方處理過，這裡跳過
    if (exchange !== 'bingx') {
      try {
        await loadMarketsWithCache(ccxtExchange, exchange);
        logger.debug({ exchange }, 'Markets loaded');
      } catch (error) {
        logger.error({ exchange, error }, 'Failed to load markets');
        throw new TradingError(
          `Failed to load ${exchange} markets`,
          {
            exchange,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    return {
      ccxt: ccxtExchange,
      isPortfolioMargin,
      isHedgeMode,
      // 此時 loadMarkets() 或 cache 注入已成功執行，markets 必定存在
      markets: ccxtExchange.markets!,
    };
  }

  /**
   * 創建公開 CCXT 實例（用於 fetchTicker 等不需認證的操作）
   * 使用全局 markets 快取
   *
   * @param exchange - 交易所名稱
   * @returns CCXT Exchange 實例（已載入市場資訊）
   */
  static async createPublicExchangeWithCache(
    exchange: SupportedExchange,
  ): Promise<ccxt.Exchange> {
    const instance = createPublicExchange(exchange as CcxtSupportedExchange);

    // 使用 Singleflight 避免 Cache Stampede
    await loadMarketsWithCache(instance, exchange);
    logger.debug({ exchange }, 'Public instance: markets loaded');

    return instance;
  }

  /**
   * 創建認證 CCXT 實例（用於 fetchFundingHistory 等需認證的查詢操作）
   * 使用全局 markets 快取和帳戶類型快取
   *
   * 注意：此方法不偵測 hedge mode，僅用於查詢操作，不用於交易
   * 交易操作請使用 create() 方法
   *
   * @param exchange - 交易所名稱
   * @param userId - 用戶 ID
   * @param prisma - Prisma Client 實例
   * @returns CCXT Exchange 實例（已載入市場資訊）
   */
  static async createAuthenticatedExchangeForQuery(
    exchange: SupportedExchange,
    userId: string,
    prisma: PrismaClient,
  ): Promise<ccxt.Exchange> {
    // 查詢並解密 API Key
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId, exchange, isActive: true },
    });

    if (!apiKey) {
      throw new TradingError(`No active API key found for ${exchange}`, { exchange, userId });
    }

    const decryptedKey = decrypt(apiKey.encryptedKey);
    const decryptedSecret = decrypt(apiKey.encryptedSecret);
    const decryptedPassphrase = apiKey.encryptedPassphrase
      ? decrypt(apiKey.encryptedPassphrase)
      : undefined;

    let instance = createCcxtExchange(exchange as CcxtSupportedExchange, {
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
      enableRateLimit: true,
      options: {
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    });

    // Binance Portfolio Margin 偵測（使用帳戶類型快取）
    if (exchange === 'binance') {
      const cachedAccountType = getCachedAccountType(exchange, decryptedKey);

      let isPortfolioMargin = false;
      if (cachedAccountType) {
        isPortfolioMargin = cachedAccountType.isPortfolioMargin;
        logger.debug({ exchange }, 'Using cached Binance account type (query)');
      } else {
        // 執行簡化版偵測
        isPortfolioMargin = await CcxtExchangeFactory.detectBinancePortfolioMargin(instance);
        setCachedAccountType(exchange, decryptedKey, { isPortfolioMargin, isHedgeMode: false });
        logger.info({ exchange, isPortfolioMargin }, 'Binance account type detected and cached (query)');
      }

      if (isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled (query)');
        instance = createCcxtExchange(exchange as CcxtSupportedExchange, {
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

    // 使用 Singleflight 避免 Cache Stampede
    await loadMarketsWithCache(instance, exchange);
    logger.debug({ exchange }, 'Authenticated instance (query): markets loaded');

    return instance;
  }

  /**
   * 偵測 Binance 帳戶類型（標準合約 vs Portfolio Margin）
   * 簡化版，僅偵測 Portfolio Margin，不偵測 hedge mode
   */
  private static async detectBinancePortfolioMargin(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ccxtExchange: any,
  ): Promise<boolean> {
    // 先嘗試標準 Futures API
    try {
      await ccxtExchange.fapiPrivateGetPositionSideDual();
      logger.info('Binance standard Futures account detected (query)');
      return false;
    } catch {
      logger.debug('Standard Futures API failed, trying Portfolio Margin (query)');
    }

    // 標準 API 失敗，嘗試 Portfolio Margin API
    try {
      await ccxtExchange.papiGetUmPositionSideDual();
      logger.info('Binance Portfolio Margin account detected (query)');
      return true;
    } catch {
      logger.debug('Portfolio Margin API also failed (query)');
    }

    // 無法偵測，預設標準帳戶
    logger.info('Binance account type detection failed, defaulting to standard (query)');
    return false;
  }
}

/**
 * 建立 CcxtExchangeFactory 實例
 *
 * @param binanceAccountDetector - Binance 帳戶偵測器
 * @returns CcxtExchangeFactory 實例
 */
export function createCcxtExchangeFactory(
  binanceAccountDetector: IBinanceAccountDetector,
): ICcxtExchangeFactory {
  return new CcxtExchangeFactory(binanceAccountDetector);
}
