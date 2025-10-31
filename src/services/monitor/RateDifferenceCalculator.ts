import { FundingRateRecord, FundingRatePair, createFundingRatePair } from '../../models/FundingRate.js';
import { logger } from '../../lib/logger.js';
import { MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF } from '../../lib/cost-constants.js';

/**
 * 資金費率差異計算器
 * 負責計算兩個交易所之間的資金費率差異，並判斷是否有套利機會
 */
export class RateDifferenceCalculator {
  private readonly minSpreadThreshold: number;

  constructor(minSpreadThreshold = 0.005) {
    // 預設閾值: 0.5% (0.005) - 包含所有交易成本
    this.minSpreadThreshold = minSpreadThreshold;
  }

  /**
   * 計算資金費率差異
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
    // 1. 檢查資金費率差是否達到閾值
    const spreadDecimal = pair.spreadPercent / 100;
    if (spreadDecimal < this.minSpreadThreshold) {
      return false;
    }

    // 2. 如果沒有價格數據，只根據資金費率判斷
    if (!pair.binancePrice || !pair.okxPrice) {
      logger.warn({
        symbol: pair.symbol,
        reason: 'No price data available, using funding rate only',
      }, 'Price data missing for arbitrage opportunity check');
      return true;
    }

    // 3. 檢查價差方向是否有利
    return this.isPriceDiffFavorable(pair);
  }

  /**
   * 檢查價差是否有利於套利
   *
   * 邏輯：
   * - 如果 Binance 資金費率較高（做空），則 Binance 價格應 >= OKX 價格
   * - 如果 OKX 資金費率較高（做空），則 OKX 價格應 >= Binance 價格
   * - 允許少量反向價差（MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF）
   */
  private isPriceDiffFavorable(pair: FundingRatePair): boolean {
    if (!pair.binancePrice || !pair.okxPrice) {
      return true; // 無價格數據時，不拒絕機會
    }

    const binanceRate = pair.binance.fundingRate;
    const okxRate = pair.okx.fundingRate;
    const binancePrice = pair.binancePrice;
    const okxPrice = pair.okxPrice;

    // 判斷套利方向
    const shouldShortBinance = binanceRate > okxRate;

    if (shouldShortBinance) {
      // 在 Binance 做空，OKX 做多
      // Binance 價格應該 >= OKX 價格（或略低於可接受範圍內）
      const priceDiffRate = (binancePrice - okxPrice) / binancePrice;

      if (priceDiffRate >= 0) {
        // 價差有利（Binance 價格較高）
        logger.debug({
          symbol: pair.symbol,
          direction: 'Short Binance, Long OKX',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          result: 'Favorable',
        }, 'Price difference check');
        return true;
      } else if (Math.abs(priceDiffRate) <= MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF) {
        // 價差略微不利，但在可接受範圍內
        logger.debug({
          symbol: pair.symbol,
          direction: 'Short Binance, Long OKX',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          result: 'Acceptable (within tolerance)',
        }, 'Price difference check');
        return true;
      } else {
        // 價差明顯不利
        logger.info({
          symbol: pair.symbol,
          direction: 'Short Binance, Long OKX',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          maxAcceptable: (MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF * 100).toFixed(2) + '%',
          result: 'Rejected (adverse price diff)',
        }, 'Price difference check failed');
        return false;
      }
    } else {
      // 在 OKX 做空，Binance 做多
      // OKX 價格應該 >= Binance 價格（或略低於可接受範圍內）
      const priceDiffRate = (okxPrice - binancePrice) / okxPrice;

      if (priceDiffRate >= 0) {
        // 價差有利（OKX 價格較高）
        logger.debug({
          symbol: pair.symbol,
          direction: 'Short OKX, Long Binance',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          result: 'Favorable',
        }, 'Price difference check');
        return true;
      } else if (Math.abs(priceDiffRate) <= MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF) {
        // 價差略微不利，但在可接受範圍內
        logger.debug({
          symbol: pair.symbol,
          direction: 'Short OKX, Long Binance',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          result: 'Acceptable (within tolerance)',
        }, 'Price difference check');
        return true;
      } else {
        // 價差明顯不利
        logger.info({
          symbol: pair.symbol,
          direction: 'Short OKX, Long Binance',
          binancePrice,
          okxPrice,
          priceDiffRate: (priceDiffRate * 100).toFixed(4) + '%',
          maxAcceptable: (MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF * 100).toFixed(2) + '%',
          result: 'Rejected (adverse price diff)',
        }, 'Price difference check failed');
        return false;
      }
    }
  }

  /**
   * 計算預期收益（年化）
   * @param pair 資金費率配對
   * @param positionSize 倉位大小（USDT）
   * @returns 預期年化收益（USDT）
   */
  calculateExpectedReturn(pair: FundingRatePair, positionSize: number): number {
    // 年化利差 * 倉位大小
    const annualReturn = (pair.spreadAnnualized / 100) * positionSize;
    return annualReturn;
  }

  /**
   * 計算單次資金費率結算收益
   * @param pair 資金費率配對
   * @param positionSize 倉位大小（USDT）
   * @returns 單次結算收益（USDT）
   */
  calculateSingleFundingReturn(pair: FundingRatePair, positionSize: number): number {
    const spreadDecimal = pair.spreadPercent / 100;
    return spreadDecimal * positionSize;
  }

  /**
   * 取得套利方向建議
   * @returns { long: 做多的交易所, short: 做空的交易所 }
   */
  getArbitrageDirection(pair: FundingRatePair): {
    long: 'binance' | 'okx';
    short: 'binance' | 'okx';
    reason: string;
  } {
    if (pair.binance.fundingRate > pair.okx.fundingRate) {
      // Binance 費率較高（正向），應在 OKX 做多、Binance 做空
      // 這樣 OKX 收取資金費率，Binance 支付資金費率
      return {
        long: 'okx',
        short: 'binance',
        reason: 'Binance 資金費率較高，在 OKX 做多可收取費率，在 Binance 做空需支付費率',
      };
    } else {
      // OKX 費率較高，應在 Binance 做多、OKX 做空
      return {
        long: 'binance',
        short: 'okx',
        reason: 'OKX 資金費率較高，在 Binance 做多可收取費率，在 OKX 做空需支付費率',
      };
    }
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
      `  Binance: ${pair.binance.getFundingRatePercent()}`,
      `  OKX: ${pair.okx.getFundingRatePercent()}`,
      `  利差: ${pair.spreadPercent.toFixed(4)}%`,
      ``,
      `年化利差: ${pair.spreadAnnualized.toFixed(2)}%`,
      ``,
      `倉位: ${positionSize} USDT`,
      `預期年化收益: ${expectedReturn.toFixed(2)} USDT`,
      `單次結算收益: ${singleFundingReturn.toFixed(2)} USDT`,
      ``,
      `套利建議:`,
      `  ${direction.long.toUpperCase()} 做多`,
      `  ${direction.short.toUpperCase()} 做空`,
      `  原因: ${direction.reason}`,
      ``,
      `是否達到閾值: ${isOpportunity ? '✅ 是' : '❌ 否'} (閾值: ${(this.minSpreadThreshold * 100).toFixed(2)}%)`,
      `==================`,
    ];

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
