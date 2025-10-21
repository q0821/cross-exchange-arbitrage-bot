/**
 * OkxConnectorAdapter
 *
 * Adapter 將現有的 OKXConnector 適配到 FundingRateValidator 需要的介面
 * Feature: 004-fix-okx-add-price-display
 */

import { OKXConnector } from '../connectors/okx.js';
import { logger } from '../lib/logger.js';

/**
 * Adapter 介面，符合 FundingRateValidator 的需求
 */
export class OkxConnectorAdapter {
  constructor(private connector: OKXConnector) {}

  /**
   * 獲取資金費率
   * @param symbol OKX 格式的交易對符號（例如: BTC-USDT-SWAP）
   */
  async getFundingRate(symbol: string): Promise<{
    fundingRate: number;
    nextFundingRate?: number;
    fundingTime?: Date;
  }> {
    try {
      // 轉換符號格式: BTC-USDT-SWAP -> BTCUSDT
      const binanceSymbol = this.toBinanceSymbol(symbol);

      logger.debug({ symbol, binanceSymbol }, 'Fetching funding rate via OKX connector');

      // 調用現有 connector
      const result = await this.connector.getFundingRate(binanceSymbol);

      return {
        fundingRate: result.fundingRate,
        nextFundingRate: undefined, // OKX connector 目前未返回 nextFundingRate
        fundingTime: result.nextFundingTime,
      };
    } catch (error) {
      logger.error(
        {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch funding rate via OKX connector'
      );
      throw error;
    }
  }

  /**
   * 轉換符號格式
   * BTC-USDT-SWAP -> BTCUSDT
   */
  private toBinanceSymbol(symbol: string): string {
    // 移除 -SWAP 後綴和 - 分隔符
    return symbol.replace('-SWAP', '').replace(/-/g, '');
  }
}
