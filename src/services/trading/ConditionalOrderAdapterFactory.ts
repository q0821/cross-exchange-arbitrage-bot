/**
 * Conditional Order Adapter Factory
 *
 * 條件單適配器工廠：根據交易所創建對應的適配器
 * Feature: 038-specify-scripts-bash
 */

import { PrismaClient } from '@prisma/client';
import * as ccxt from 'ccxt';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import type { SupportedExchange } from '../../types/trading';
import type { ConditionalOrderAdapter } from './adapters/ConditionalOrderAdapter';
import { BinanceConditionalOrderAdapter } from './adapters/BinanceConditionalOrderAdapter';
import { OkxConditionalOrderAdapter } from './adapters/OkxConditionalOrderAdapter';
import { GateioConditionalOrderAdapter } from './adapters/GateioConditionalOrderAdapter';
import { MexcConditionalOrderAdapter } from './adapters/MexcConditionalOrderAdapter';
import { BingxConditionalOrderAdapter } from './adapters/BingxConditionalOrderAdapter';
import { detectOkxPositionMode } from './okx-position-mode';

/**
 * 條件單適配器工廠
 */
export class ConditionalOrderAdapterFactory {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * 獲取指定交易所的條件單適配器
   */
  async getAdapter(
    exchange: SupportedExchange,
    userId: string,
  ): Promise<ConditionalOrderAdapter> {
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

    const exchangeOptions = {
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
    };

    // 根據交易所創建對應的適配器
    switch (exchange) {
      case 'binance':
        return this.createBinanceAdapter(exchangeOptions, userId);
      case 'okx':
        return this.createOkxAdapter(exchangeOptions);
      case 'gateio':
        return new GateioConditionalOrderAdapter(
          this.createCcxtExchange('gateio', exchangeOptions),
        );
      case 'mexc':
        return this.createMexcAdapter(exchangeOptions, userId);
      case 'bingx':
        return this.createBingxAdapter(exchangeOptions);
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  /**
   * 創建 CCXT 交易所實例
   */
  private createCcxtExchange(
    exchange: SupportedExchange,
    options: {
      apiKey: string;
      secret: string;
      password?: string;
      sandbox: boolean;
    },
    portfolioMargin: boolean = false,
  ): ccxt.Exchange {
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
      apiKey: options.apiKey,
      secret: options.secret,
      password: options.password,
      sandbox: options.sandbox,
      enableRateLimit: true,
      options: {
        // Binance 使用 'future'，其他交易所使用 'swap'
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    };

    // Binance Portfolio Margin 需要額外選項
    if (exchange === 'binance' && portfolioMargin) {
      config.options.portfolioMargin = true;
    }

    return new ExchangeClass(config);
  }

  /**
   * 創建 Binance 適配器（需要檢測帳戶模式）
   */
  private async createBinanceAdapter(
    options: {
      apiKey: string;
      secret: string;
      password?: string;
      sandbox: boolean;
    },
    userId: string,
  ): Promise<BinanceConditionalOrderAdapter> {
    // 先創建初始 CCXT 實例用於偵測帳戶類型
    let ccxtExchange = this.createCcxtExchange('binance', options);

    // 檢測帳戶類型
    const accountType = await this.detectBinanceAccountType(ccxtExchange);

    logger.info(
      {
        userId,
        isHedgeMode: accountType.isHedgeMode,
        isPortfolioMargin: accountType.isPortfolioMargin,
      },
      'Detected Binance account type for conditional orders',
    );

    // 如果是 Portfolio Margin，需要重新創建 exchange 實例並啟用 portfolioMargin 選項
    if (accountType.isPortfolioMargin) {
      logger.info('Recreating Binance exchange with Portfolio Margin enabled for conditional orders');
      ccxtExchange = this.createCcxtExchange('binance', options, true);
    }

    return new BinanceConditionalOrderAdapter(ccxtExchange, accountType);
  }

  /**
   * 檢測 Binance 帳戶類型
   */
  private async detectBinanceAccountType(ccxtExchange: any): Promise<{
    isHedgeMode: boolean;
    isPortfolioMargin: boolean;
  }> {
    try {
      // 先嘗試標準 Futures API
      const result = await ccxtExchange.fapiPrivateGetPositionSideDual();
      const isHedgeMode = result?.dualSidePosition === true || result?.dualSidePosition === 'true';
      return { isPortfolioMargin: false, isHedgeMode };
    } catch (fapiError) {
      // 嘗試 Portfolio Margin API
      try {
        const pmResult = await ccxtExchange.papiGetUmPositionSideDual();
        const isHedgeMode =
          pmResult?.dualSidePosition === true || pmResult?.dualSidePosition === 'true';
        return { isPortfolioMargin: true, isHedgeMode };
      } catch (pmError) {
        // 默認為 Hedge Mode
        logger.warn(
          { fapiError, pmError },
          'Failed to detect Binance account type, defaulting to Hedge Mode',
        );
        return { isPortfolioMargin: false, isHedgeMode: true };
      }
    }
  }

  /**
   * 創建 OKX 適配器（需要偵測帳戶模式）
   */
  private async createOkxAdapter(options: {
    apiKey: string;
    secret: string;
    password?: string;
    sandbox: boolean;
  }): Promise<OkxConditionalOrderAdapter> {
    const ccxtExchange = this.createCcxtExchange('okx', options);

    // 動態偵測 OKX 帳戶模式
    const positionMode = await detectOkxPositionMode(ccxtExchange);

    logger.info(
      { exchange: 'okx', positionMode, sandbox: options.sandbox },
      'Creating OKX conditional order adapter',
    );

    return new OkxConditionalOrderAdapter(ccxtExchange, {
      positionMode,
    });
  }

  /**
   * 創建 MEXC 適配器（需要檢測帳戶模式）
   */
  private async createMexcAdapter(
    options: {
      apiKey: string;
      secret: string;
      password?: string;
      sandbox: boolean;
    },
    _userId: string,
  ): Promise<MexcConditionalOrderAdapter> {
    const ccxtExchange = this.createCcxtExchange('mexc', options);
    // MEXC 默認使用 Hedge Mode
    // TODO: 如果需要，可以使用 _userId 添加帳戶模式檢測
    return new MexcConditionalOrderAdapter(ccxtExchange, { isHedgeMode: true });
  }

  /**
   * 創建 BingX 適配器
   * Feature: 043-bingx-integration
   */
  private createBingxAdapter(options: {
    apiKey: string;
    secret: string;
    password?: string;
    sandbox: boolean;
  }): BingxConditionalOrderAdapter {
    const ccxtExchange = this.createCcxtExchange('bingx', options);
    // BingX 默認使用 Hedge Mode
    return new BingxConditionalOrderAdapter(ccxtExchange, { isHedgeMode: true });
  }
}

// Export singleton instance
export const conditionalOrderAdapterFactory = new ConditionalOrderAdapterFactory();

// Re-export types for convenience
export { detectOkxPositionMode, type OkxPositionMode } from './okx-position-mode';
