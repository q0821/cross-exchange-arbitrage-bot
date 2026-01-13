/**
 * CcxtExchangeFactory
 *
 * 負責創建和配置 CCXT 交易所實例，
 * 包含不同交易所的特殊設定處理
 *
 * Feature: 062-refactor-trading-srp
 */

import ccxt from 'ccxt';
import { logger } from '@/lib/logger';
import type {
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

    // 建立基礎 CCXT 配置
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ccxtConfig: any = {
      apiKey: config.apiKey,
      secret: config.apiSecret,
      sandbox: config.isTestnet,
      enableRateLimit: true,
      timeout: 30000, // 30 秒超時
      options: {
        defaultType: 'swap',
      },
    };

    // Binance 使用 future 類型
    if (exchange === 'binance') {
      ccxtConfig.options.defaultType = 'future';
    }

    // OKX 需要 passphrase
    if (config.passphrase && exchange === 'okx') {
      ccxtConfig.password = config.passphrase;
    }

    let ccxtExchange = new ExchangeClass(ccxtConfig);

    // 動態偵測 Binance 帳戶類型和持倉模式
    let isPortfolioMargin = false;
    let isHedgeMode = false;

    if (exchange === 'binance') {
      const accountType = await this.binanceAccountDetector.detect(ccxtExchange);
      isPortfolioMargin = accountType.isPortfolioMargin;
      isHedgeMode = accountType.isHedgeMode;

      // 如果是 Portfolio Margin，需要重新創建 exchange 實例並啟用 portfolioMargin 選項
      if (isPortfolioMargin) {
        logger.info('Recreating Binance exchange with Portfolio Margin enabled');
        ccxtConfig.options.portfolioMargin = true;
        ccxtExchange = new ExchangeClass(ccxtConfig);
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
    await ccxtExchange.loadMarkets();

    return {
      ccxt: ccxtExchange,
      isPortfolioMargin,
      isHedgeMode,
      markets: ccxtExchange.markets,
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
