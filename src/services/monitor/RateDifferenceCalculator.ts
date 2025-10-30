import { FundingRateRecord, FundingRatePair, createFundingRatePair } from '../../models/FundingRate.js';
import { logger } from '../../lib/logger.js';

/**
 * 資金費率差異計算器
 * 負責計算兩個交易所之間的資金費率差異，並判斷是否有套利機會
 */
export class RateDifferenceCalculator {
  private readonly minSpreadThreshold: number;

  constructor(minSpreadThreshold = 0.0037) {
    // 預設閾值: 0.37% (0.0037) - 包含所有交易成本
    this.minSpreadThreshold = minSpreadThreshold;
  }

  /**
   * 計算資金費率差異
   */
  calculateDifference(
    binanceRate: FundingRateRecord,
    okxRate: FundingRateRecord
  ): FundingRatePair {
    try {
      const pair = createFundingRatePair(binanceRate, okxRate);

      logger.debug({
        symbol: pair.symbol,
        binanceRate: binanceRate.fundingRate,
        okxRate: okxRate.fundingRate,
        spread: pair.spreadPercent,
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
   * 判斷是否達到套利閾值
   */
  isArbitrageOpportunity(pair: FundingRatePair): boolean {
    const spreadDecimal = pair.spreadPercent / 100;
    return spreadDecimal >= this.minSpreadThreshold;
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
