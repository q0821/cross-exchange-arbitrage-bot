/**
 * ArbitrageAssessor Service
 *
 * 套利可行性評估服務（多交易所版本）
 * Feature: 004-fix-okx-add-price-display
 * Task: T039, T040
 */

import type { FundingRatePair, ExchangeName } from '../../models/FundingRate.js';
import { logger } from '../../lib/logger.js';

/**
 * 套利配置
 */
export interface ArbitrageConfig {
  /** Maker 手續費率（例如：0.0002 = 0.02%）*/
  makerFeeRate: number;
  /** Taker 手續費率（例如：0.0005 = 0.05%）*/
  takerFeeRate: number;
  /** 最小利潤閾值（例如：0.0001 = 0.01%）*/
  minProfitThreshold: number;
  /** 極端價差警告閾值（例如：0.05 = 5%）*/
  extremePriceDiffThreshold: number;
}

/**
 * 手續費類型
 */
export type FeeType = 'maker' | 'taker' | 'mixed';

/**
 * 手續費計算結果
 */
export interface FeeCalculation {
  /** 做多交易所手續費（USDT）*/
  longFee: number;
  /** 做空交易所手續費（USDT）*/
  shortFee: number;
  /** 總手續費（USDT）*/
  totalFee: number;
  /** 總手續費百分比 */
  totalFeePercent: number;
}

/**
 * 淨收益計算結果
 */
export interface NetProfitCalculation {
  /** 利差金額（USDT）*/
  spreadAmount: number;
  /** 手續費計算 */
  fees: FeeCalculation;
  /** 淨收益（USDT）= 利差金額 - 總手續費 */
  netProfit: number;
  /** 淨收益百分比 */
  netProfitPercent: number;
}

/**
 * 套利評估結果
 */
export interface ArbitrageAssessment {
  /** 交易對符號 */
  symbol: string;
  /** 做多交易所 */
  longExchange: ExchangeName;
  /** 做空交易所 */
  shortExchange: ExchangeName;

  /** 利差百分比（%）*/
  spreadPercent: number;
  /** 利差金額（USDT）*/
  spreadAmount: number;

  /** 手續費計算結果 */
  fees: FeeCalculation;

  /** 淨收益（USDT）= 利差金額 - 總手續費 */
  netProfit: number;
  /** 淨收益百分比 */
  netProfitPercent: number;

  /** 是否可行（淨收益 > 最小利潤閾值）*/
  isFeasible: boolean;
  /** 不可行原因（如果 isFeasible = false）*/
  reason?: string;

  /** 警告訊息（例如極端價差）*/
  warnings: string[];

  /** 評估時間 */
  assessedAt: Date;
}

/**
 * 套利可行性評估服務
 *
 * 負責：
 * 1. 計算手續費（Maker/Taker）
 * 2. 計算淨收益 = 利差 - 手續費
 * 3. 判斷可行性（淨收益 > 最小利潤閾值）
 * 4. 檢測極端價差並發出警告
 */
export class ArbitrageAssessor {
  private config: ArbitrageConfig;

  constructor(config?: Partial<ArbitrageConfig>) {
    // 預設配置
    this.config = {
      makerFeeRate: config?.makerFeeRate ?? 0.0002, // 0.02%
      takerFeeRate: config?.takerFeeRate ?? 0.0005, // 0.05%
      minProfitThreshold: config?.minProfitThreshold ?? 0.0001, // 0.01%
      extremePriceDiffThreshold: config?.extremePriceDiffThreshold ?? 0.05, // 5%
    };

    logger.info({
      config: this.config,
    }, 'ArbitrageAssessor initialized');
  }

  /**
   * 計算手續費
   *
   * @param capitalUsdt 使用的資金量（USDT）
   * @param feeType 手續費類型
   * @returns 手續費計算結果
   */
  calculateFees(capitalUsdt: number, feeType: FeeType): FeeCalculation {
    let longFee: number;
    let shortFee: number;

    switch (feeType) {
      case 'maker':
        // 雙邊都使用 Maker 費率
        longFee = capitalUsdt * this.config.makerFeeRate;
        shortFee = capitalUsdt * this.config.makerFeeRate;
        break;
      case 'taker':
        // 雙邊都使用 Taker 費率
        longFee = capitalUsdt * this.config.takerFeeRate;
        shortFee = capitalUsdt * this.config.takerFeeRate;
        break;
      case 'mixed':
        // 做多使用 Maker，做空使用 Taker
        longFee = capitalUsdt * this.config.makerFeeRate;
        shortFee = capitalUsdt * this.config.takerFeeRate;
        break;
    }

    const totalFee = longFee + shortFee;
    const totalFeePercent = capitalUsdt > 0 ? totalFee / capitalUsdt : 0;

    return {
      longFee,
      shortFee,
      totalFee,
      totalFeePercent,
    };
  }

  /**
   * 計算淨收益
   *
   * @param spreadPercent 利差百分比（例如：0.1 代表 0.1%）
   * @param capitalUsdt 使用的資金量（USDT）
   * @param feeType 手續費類型
   * @returns 淨收益計算結果
   */
  calculateNetProfit(
    spreadPercent: number,
    capitalUsdt: number,
    feeType: FeeType
  ): NetProfitCalculation {
    // 1. 計算利差金額
    const spreadAmount = (spreadPercent / 100) * capitalUsdt;

    // 2. 計算手續費
    const fees = this.calculateFees(capitalUsdt, feeType);

    // 3. 計算淨收益
    const netProfit = spreadAmount - fees.totalFee;
    const netProfitPercent = capitalUsdt > 0 ? netProfit / capitalUsdt : 0;

    return {
      spreadAmount,
      fees,
      netProfit,
      netProfitPercent,
    };
  }

  /**
   * 評估套利機會
   *
   * @param pair 資金費率配對
   * @param capitalUsdt 使用的資金量（USDT）
   * @param feeType 手續費類型（預設 'maker'）
   * @returns 套利評估結果
   */
  assess(
    pair: FundingRatePair,
    capitalUsdt: number,
    feeType: FeeType = 'maker'
  ): ArbitrageAssessment {
    const warnings: string[] = [];

    // 1. 檢查是否有 bestPair 資訊
    if (!pair.bestPair) {
      return {
        symbol: pair.symbol,
        longExchange: 'binance', // 預設值
        shortExchange: 'okx', // 預設值
        spreadPercent: 0,
        spreadAmount: 0,
        fees: this.calculateFees(capitalUsdt, feeType),
        netProfit: 0,
        netProfitPercent: 0,
        isFeasible: false,
        reason: '無套利對資訊',
        warnings,
        assessedAt: new Date(),
      };
    }

    const { bestPair } = pair;

    // 2. 計算淨收益
    const profitCalc = this.calculateNetProfit(
      bestPair.spreadPercent,
      capitalUsdt,
      feeType
    );

    // 3. 判斷可行性
    const isFeasible = profitCalc.netProfitPercent > this.config.minProfitThreshold;

    // 4. 檢測極端價差
    if (bestPair.priceDiffPercent !== undefined) {
      const priceDiffAbs = Math.abs(bestPair.priceDiffPercent);
      if (priceDiffAbs > this.config.extremePriceDiffThreshold * 100) {
        warnings.push(
          `極端價差警告：價差 ${priceDiffAbs.toFixed(2)}% 超過閾值 ${(this.config.extremePriceDiffThreshold * 100).toFixed(0)}%`
        );
      }
    }

    // 5. 確定不可行原因
    let reason: string | undefined;
    if (!isFeasible) {
      if (profitCalc.netProfitPercent <= 0) {
        reason = '淨收益為負（利差小於手續費）';
      } else {
        reason = `淨收益低於最小利潤閾值（${(profitCalc.netProfitPercent * 100).toFixed(3)}% < ${(this.config.minProfitThreshold * 100).toFixed(3)}%）`;
      }
    }

    return {
      symbol: pair.symbol,
      longExchange: bestPair.longExchange,
      shortExchange: bestPair.shortExchange,
      spreadPercent: bestPair.spreadPercent,
      spreadAmount: profitCalc.spreadAmount,
      fees: profitCalc.fees,
      netProfit: profitCalc.netProfit,
      netProfitPercent: profitCalc.netProfitPercent,
      isFeasible,
      reason,
      warnings,
      assessedAt: new Date(),
    };
  }

  /**
   * 更新配置
   *
   * @param config 部分配置更新
   */
  updateConfig(config: Partial<ArbitrageConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info({
      config: this.config,
    }, 'ArbitrageAssessor config updated');
  }

  /**
   * 取得當前配置
   *
   * @returns 當前配置
   */
  getConfig(): ArbitrageConfig {
    return { ...this.config };
  }
}
