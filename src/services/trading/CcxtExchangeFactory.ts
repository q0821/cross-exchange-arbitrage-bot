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

import { logger } from '@/lib/logger';
import { TradingError } from '@/lib/errors';
import { createCcxtExchange, type SupportedExchange as CcxtSupportedExchange } from '@/lib/ccxt-factory';
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

    // 使用統一工廠創建 CCXT 實例（自動套用 proxy 配置）
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
      const accountType = await this.binanceAccountDetector.detect(ccxtExchange);
      isPortfolioMargin = accountType.isPortfolioMargin;
      isHedgeMode = accountType.isHedgeMode;

      // 如果偵測失敗，記錄警告提示用戶可能需要手動配置
      if (accountType.detectionFailed) {
        logger.warn(
          { exchange, isPortfolioMargin, isHedgeMode },
          'Binance account type detection failed, using defaults. Consider setting hedge mode manually if needed.',
        );
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
        // 重新載入市場資料
        try {
          await ccxtExchange.loadMarkets();
        } catch (error) {
          logger.error({ exchange, error }, 'Failed to load markets for Portfolio Margin');
          throw new TradingError(
            `Failed to load ${exchange} markets (Portfolio Margin)`,
            {
              exchange,
              isPortfolioMargin: true,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }

    // OKX 預設使用 Hedge Mode
    if (exchange === 'okx') {
      isHedgeMode = true;
    }

    // BingX 預設使用 Hedge Mode（雙向持倉）
    if (exchange === 'bingx') {
      isHedgeMode = true;
    }

    logger.info(
      { exchange, isPortfolioMargin, isHedgeMode },
      'Position mode configuration',
    );

    // 載入市場資料以獲取合約大小（contractSize）
    try {
      await ccxtExchange.loadMarkets();
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

    return {
      ccxt: ccxtExchange,
      isPortfolioMargin,
      isHedgeMode,
      // 此時 loadMarkets() 已成功執行，markets 必定存在
      markets: ccxtExchange.markets!,
    };
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
