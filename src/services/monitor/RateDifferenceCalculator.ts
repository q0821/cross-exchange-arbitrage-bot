import {
  FundingRateRecord,
  FundingRatePair,
  createFundingRatePair,
  createMultiExchangeFundingRatePair,
  ExchangeName,
  ExchangeRateData,
} from '../../models/FundingRate';
import { logger } from '../../lib/logger';
import { MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF } from '../../lib/cost-constants';

/**
 * 資金費率差異計算器
 * 負責計算多個交易所之間的資金費率差異，並判斷是否有套利機會
 */
export class RateDifferenceCalculator {
  private readonly minSpreadThreshold: number;

  constructor(minSpreadThreshold = 0.005) {
    // 預設閾值: 0.5% (0.005) - 包含所有交易成本
    this.minSpreadThreshold = minSpreadThreshold;
  }

  /**
   * 計算多交易所資金費率差異（新版本）
   * 自動找出所有交易所中利差最大的兩個交易所
   */
  calculateMultiExchangeDifference(
    symbol: string,
    exchangesData: Map<ExchangeName, ExchangeRateData>
  ): FundingRatePair {
    try {
      const pair = createMultiExchangeFundingRatePair(symbol, exchangesData);

      if (pair.bestPair) {
        logger.debug({
          symbol: pair.symbol,
          longExchange: pair.bestPair.longExchange,
          shortExchange: pair.bestPair.shortExchange,
          spread: pair.bestPair.spreadPercent,
          priceDiff: pair.bestPair.priceDiffPercent,
        }, 'Calculated multi-exchange funding rate difference');
      } else {
        logger.warn({ symbol }, 'No best pair found for symbol');
      }

      return pair;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol,
        exchangeCount: exchangesData.size,
      }, 'Failed to calculate multi-exchange rate difference');
      throw error;
    }
  }

  /**
   * 計算資金費率差異（向後兼容版本）
   * @deprecated 使用 calculateMultiExchangeDifference 替代
   */
  calculateDifference(
    binanceRate: FundingRateRecord,
    okxRate: FundingRateRecord,
    binancePrice?: number,
    okxPrice?: number
  ): FundingRatePair {
    try {
      const pair = createFundingRatePair(binanceRate, okxRate, binancePrice, okxPrice);

      logger.debug({
        symbol: pair.symbol,
        binanceRate: binanceRate.fundingRate,
        okxRate: okxRate.fundingRate,
        spread: pair.spreadPercent,
        binancePrice,
        okxPrice,
        priceDiff: pair.priceDiffPercent,
      }, 'Calculated funding rate difference');

      return pair;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        binance: binanceRate.toJSON(),
        okx: okxRate.toJSON(),
      }, 'Failed to calculate rate difference');
      throw error;
    }
  }

  /**
   * 判斷是否達到套利閾值（包含資金費率差和價差檢查）
   */
  isArbitrageOpportunity(pair: FundingRatePair): boolean {
    // 沒有最佳套利對，不是機會
    if (!pair.bestPair) {
      return false;
    }

    // 1. 檢查資金費率差是否達到閾值
    const spreadDecimal = pair.bestPair.spreadPercent / 100;
    if (spreadDecimal < this.minSpreadThreshold) {
      return false;
    }

    // 2. 如果沒有價格數據，只根據資金費率判斷
    const longData = pair.exchanges.get(pair.bestPair.longExchange);
    const shortData = pair.exchanges.get(pair.bestPair.shortExchange);

    if (!longData?.price || !shortData?.price) {
      logger.warn({
        symbol: pair.symbol,
        longExchange: pair.bestPair.longExchange,
        shortExchange: pair.bestPair.shortExchange,
        reason: 'No price data available, using funding rate only',
      }, 'Price data missing for arbitrage opportunity check');
      return true;
    }

    // 3. 檢查價差方向是否有利
    return this.isPriceDiffFavorableForBestPair(pair);
  }

  /**
   * 檢查價差是否有利於套利（新版本，支持任意交易所對）
   */
  private isPriceDiffFavorableForBestPair(pair: FundingRatePair): boolean {
    if (!pair.bestPair) {
      return false;
    }

    const longData = pair.exchanges.get(pair.bestPair.longExchange);
    const shortData = pair.exchanges.get(pair.bestPair.shortExchange);

    if (!longData?.price || !shortData?.price) {
      return true; // 無價格數據時，不拒絕機會
    }

    const longPrice = longData.price;
    const shortPrice = shortData.price;

    // 做空的交易所價格應該 >= 做多的交易所價格（或略低於可接受範圍內）
    // 這樣在平倉時才不會虧損
    const priceDiffRate = (shortPrice - longPrice) / shortPrice;

    if (priceDiffRate >= 0) {
      // 價差有利（做空交易所價格較高）
      logger.debug({
        symbol: pair.symbol,
        direction: `Short ${pair.bestPair.shortExchange.toUpperCase()}, Long ${pair.bestPair.longExchange.toUpperCase()}`,
        shortPrice,
        longPrice,
        priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
        result: 'Favorable',
      }, 'Price difference check');
      return true;
    } else if (Math.abs(priceDiffRate) <= MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF) {
      // 價差略微不利，但在可接受範圍內
      logger.debug({
        symbol: pair.symbol,
        direction: `Short ${pair.bestPair.shortExchange.toUpperCase()}, Long ${pair.bestPair.longExchange.toUpperCase()}`,
        shortPrice,
        longPrice,
        priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
        result: 'Acceptable (within tolerance)',
      }, 'Price difference check');
      return true;
    } else {
      // 價差明顯不利
      logger.info({
        symbol: pair.symbol,
        direction: `Short ${pair.bestPair.shortExchange.toUpperCase()}, Long ${pair.bestPair.longExchange.toUpperCase()}`,
        shortPrice,
        longPrice,
        priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
        maxAcceptable: (MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF * 100).toFixed(2) + '%',
        result: 'Rejected (adverse price diff)',
      }, 'Price difference check failed');
      return false;
    }
  }

  /**
   * 計算預期收益（年化）
   * @param pair 資金費率配對
   * @param positionSize 倉位大小（USDT）
   * @returns 預期年化收益（USDT）
   */
  calculateExpectedReturn(pair: FundingRatePair, positionSize: number): number {
    if (!pair.bestPair) {
      return 0;
    }
    // 年化利差 * 倉位大小
    const annualReturn = (pair.bestPair.spreadAnnualized / 100) * positionSize;
    return annualReturn;
  }

  /**
   * 計算單次資金費率結算收益
   * @param pair 資金費率配對
   * @param positionSize 倉位大小（USDT）
   * @returns 單次結算收益（USDT）
   */
  calculateSingleFundingReturn(pair: FundingRatePair, positionSize: number): number {
    if (!pair.bestPair) {
      return 0;
    }
    const spreadDecimal = pair.bestPair.spreadPercent / 100;
    return spreadDecimal * positionSize;
  }

  /**
   * 取得套利方向建議（新版本）
   * @returns { long: 做多的交易所, short: 做空的交易所 }
   */
  getArbitrageDirection(pair: FundingRatePair): {
    long: ExchangeName;
    short: ExchangeName;
    reason: string;
  } | null {
    if (!pair.bestPair) {
      return null;
    }

    const longExchange = pair.bestPair.longExchange;
    const shortExchange = pair.bestPair.shortExchange;

    return {
      long: longExchange,
      short: shortExchange,
      reason: `${shortExchange.toUpperCase()} 資金費率較高，在 ${longExchange.toUpperCase()} 做多可收取費率，在 ${shortExchange.toUpperCase()} 做空需支付費率`,
    };
  }

  /**
   * 生成套利機會報告
   */
  generateOpportunityReport(pair: FundingRatePair, positionSize = 10000): string {
    const isOpportunity = this.isArbitrageOpportunity(pair);
    const direction = this.getArbitrageDirection(pair);
    const expectedReturn = this.calculateExpectedReturn(pair, positionSize);
    const singleFundingReturn = this.calculateSingleFundingReturn(pair, positionSize);

    const lines = [
      `\n=== 套利機會分析 ===`,
      `交易對: ${pair.symbol}`,
      `時間: ${pair.recordedAt.toLocaleString()}`,
      ``,
      `資金費率:`,
    ];

    // 列出所有交易所的資金費率
    for (const [exchange, data] of pair.exchanges.entries()) {
      lines.push(`  ${exchange.toUpperCase()}: ${data.rate.getFundingRatePercent()}`);
    }

    if (pair.bestPair) {
      lines.push(``);
      lines.push(`最佳套利對: ${pair.bestPair.shortExchange.toUpperCase()} <-> ${pair.bestPair.longExchange.toUpperCase()}`);
      lines.push(`  利差: ${pair.bestPair.spreadPercent.toFixed(4)}%`);
      lines.push(`  年化利差: ${pair.bestPair.spreadAnnualized.toFixed(2)}%`);
    } else {
      lines.push(``);
      lines.push(`未找到套利對`);
    }

    lines.push(``);
    lines.push(`倉位: ${positionSize} USDT`);
    lines.push(`預期年化收益: ${expectedReturn.toFixed(2)} USDT`);
    lines.push(`單次結算收益: ${singleFundingReturn.toFixed(2)} USDT`);

    if (direction) {
      lines.push(``);
      lines.push(`套利建議:`);
      lines.push(`  ${direction.long.toUpperCase()} 做多`);
      lines.push(`  ${direction.short.toUpperCase()} 做空`);
      lines.push(`  原因: ${direction.reason}`);
    }

    lines.push(``);
    lines.push(`是否達到閾值: ${isOpportunity ? '✅ 是' : '❌ 否'} (閾值: ${(this.minSpreadThreshold * 100).toFixed(2)}%)`);
    lines.push(`==================`);

    return lines.join('\n');
  }

  /**
   * 更新閾值
   */
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    logger.info({
      oldThreshold: this.minSpreadThreshold,
      newThreshold: threshold,
    }, 'Updated arbitrage threshold');
  }

  /**
   * 取得當前閾值
   */
  getThreshold(): number {
    return this.minSpreadThreshold;
  }
}
