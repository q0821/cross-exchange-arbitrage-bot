/**
 * OkxCCXT
 *
 * CCXT 包裝器用於獲取 OKX 資金費率（備援驗證）
 * Feature: 004-fix-okx-add-price-display
 * Task: T018
 *
 * 使用統一 CCXT 工廠確保 proxy 配置自動套用
 */

import type ccxt from 'ccxt';
import { logger } from '../logger.js';
import { apiKeys } from '../config.js';
import { createCcxtExchange } from '../ccxt-factory';

export class OkxCCXT {
  private client: ccxt.okx;

  constructor(isTestnet: boolean = false) {
    const { apiKey, apiSecret, passphrase, testnet } = apiKeys.okx;


    this.client = createCcxtExchange('okx', {
      apiKey,
      secret: apiSecret,
      password: passphrase,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        ...(testnet && { sandboxMode: true }),
      },
    }) as ccxt.okx;

    logger.debug({ testnet: isTestnet }, 'OkxCCXT initialized');
  }

  /**
   * 獲取資金費率
   * @param symbol OKX 格式的交易對符號（例如: BTC-USDT-SWAP）
   */
  async fetchFundingRate(symbol: string): Promise<{
    fundingRate: number | null;
    fundingTimestamp: number | null;
  } | null> {
    try {
      // 轉換符號格式: BTC-USDT-SWAP -> BTC/USDT:USDT
      const ccxtSymbol = this.toCCXTSymbol(symbol);

      logger.debug({ symbol, ccxtSymbol }, 'Fetching funding rate via CCXT');

      const fundingRate = await this.client.fetchFundingRate(ccxtSymbol);

      if (!fundingRate) {
        logger.warn({ symbol }, 'CCXT returned null funding rate');
        return null;
      }

      return {
        fundingRate: fundingRate.fundingRate ?? null,
        fundingTimestamp: fundingRate.fundingTimestamp ?? null,
      };
    } catch (error) {
      logger.error(
        {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch funding rate via CCXT'
      );

      // 不拋出錯誤，返回 null 以優雅降級
      return null;
    }
  }

  /**
   * 批量獲取資金費率
   */
  async fetchFundingRates(symbols: string[]): Promise<Array<{
    symbol: string;
    fundingRate: number | null;
    fundingTimestamp: number | null;
  }>> {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const result = await this.fetchFundingRate(symbol);
        return {
          symbol,
          fundingRate: result?.fundingRate ?? null,
          fundingTimestamp: result?.fundingTimestamp ?? null,
        };
      })
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);
  }

  /**
   * 轉換符號格式
   * BTC-USDT-SWAP -> BTC/USDT:USDT
   */
  private toCCXTSymbol(symbol: string): string {
    // 移除 -SWAP 後綴
    const withoutSwap = symbol.replace('-SWAP', '');
    // 分割 base 和 quote
    const parts = withoutSwap.split('-');

    if (parts.length !== 2) {
      throw new Error(`Invalid symbol format: ${symbol}`);
    }

    const [base, quote] = parts;
    return `${base}/${quote}:${quote}`;
  }
}
