/**
 * ArbitrageAssessor Unit Tests
 *
 * 套利可行性評估器單元測試
 * Feature: 004-fix-okx-add-price-display
 * Task: T037
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArbitrageAssessor, ArbitrageConfig } from '../../../src/services/assessment/ArbitrageAssessor.js';
import type { FundingRatePair, ExchangeName } from '../../../src/models/FundingRate.js';
import { FundingRateRecord } from '../../../src/models/FundingRate.js';

describe('ArbitrageAssessor', () => {
  let assessor: ArbitrageAssessor;
  let defaultConfig: ArbitrageConfig;

  beforeEach(() => {
    // 預設配置：
    // - Maker 手續費：0.02% (0.0002)
    // - Taker 手續費：0.05% (0.0005)
    // - 最小利潤閾值：0.01% (0.0001)
    // - 極端價差警告閾值：5% (0.05)
    defaultConfig = {
      makerFeeRate: 0.0002,
      takerFeeRate: 0.0005,
      minProfitThreshold: 0.0001,
      extremePriceDiffThreshold: 0.05,
    };
    assessor = new ArbitrageAssessor(defaultConfig);
  });

  describe('constructor', () => {
    it('應該正確初始化配置', () => {
      expect(assessor).toBeDefined();
      expect(assessor.getConfig()).toEqual(defaultConfig);
    });

    it('應該使用預設配置（如果未提供）', () => {
      const defaultAssessor = new ArbitrageAssessor();
      const config = defaultAssessor.getConfig();

      expect(config.makerFeeRate).toBe(0.0002); // 0.02%
      expect(config.takerFeeRate).toBe(0.0005); // 0.05%
      expect(config.minProfitThreshold).toBe(0.0001); // 0.01%
      expect(config.extremePriceDiffThreshold).toBe(0.05); // 5%
    });
  });

  describe('calculateFees', () => {
    it('應該正確計算 Maker 手續費（雙邊）', () => {
      // 假設資金量：10000 USDT
      // Maker 費率：0.02% * 2 = 0.04%
      const fees = assessor.calculateFees(10000, 'maker');

      expect(fees.longFee).toBe(2); // 10000 * 0.0002 = 2 USDT
      expect(fees.shortFee).toBe(2); // 10000 * 0.0002 = 2 USDT
      expect(fees.totalFee).toBe(4); // 2 + 2 = 4 USDT
      expect(fees.totalFeePercent).toBeCloseTo(0.0004, 6); // 4 / 10000 = 0.04%
    });

    it('應該正確計算 Taker 手續費（雙邊）', () => {
      // 假設資金量：10000 USDT
      // Taker 費率：0.05% * 2 = 0.1%
      const fees = assessor.calculateFees(10000, 'taker');

      expect(fees.longFee).toBe(5); // 10000 * 0.0005 = 5 USDT
      expect(fees.shortFee).toBe(5); // 10000 * 0.0005 = 5 USDT
      expect(fees.totalFee).toBe(10); // 5 + 5 = 10 USDT
      expect(fees.totalFeePercent).toBeCloseTo(0.001, 6); // 10 / 10000 = 0.1%
    });

    it('應該正確計算混合手續費（做多 Maker，做空 Taker）', () => {
      const fees = assessor.calculateFees(10000, 'mixed');

      expect(fees.longFee).toBe(2); // Maker: 10000 * 0.0002 = 2 USDT
      expect(fees.shortFee).toBe(5); // Taker: 10000 * 0.0005 = 5 USDT
      expect(fees.totalFee).toBe(7); // 2 + 5 = 7 USDT
      expect(fees.totalFeePercent).toBeCloseTo(0.0007, 6); // 7 / 10000 = 0.07%
    });

    it('應該處理零資金量', () => {
      const fees = assessor.calculateFees(0, 'maker');

      expect(fees.longFee).toBe(0);
      expect(fees.shortFee).toBe(0);
      expect(fees.totalFee).toBe(0);
      expect(fees.totalFeePercent).toBe(0);
    });
  });

  describe('calculateNetProfit', () => {
    it('應該計算正收益（利差大於手續費）', () => {
      // 利差：0.1% (0.001)
      // Maker 手續費：0.04% (0.0004)
      // 淨收益：0.1% - 0.04% = 0.06% (0.0006)
      const spreadPercent = 0.1; // 0.1%
      const result = assessor.calculateNetProfit(spreadPercent, 10000, 'maker');

      expect(result.spreadAmount).toBe(10); // 10000 * 0.001 = 10 USDT
      expect(result.fees.totalFee).toBe(4); // 雙邊 Maker: 4 USDT
      expect(result.netProfit).toBe(6); // 10 - 4 = 6 USDT
      expect(result.netProfitPercent).toBeCloseTo(0.0006, 6); // 0.06%
    });

    it('應該計算負收益（利差小於手續費）', () => {
      // 利差：0.05% (0.0005)
      // Taker 手續費：0.1% (0.001)
      // 淨收益：0.05% - 0.1% = -0.05% (-0.0005)
      const spreadPercent = 0.05; // 0.05%
      const result = assessor.calculateNetProfit(spreadPercent, 10000, 'taker');

      expect(result.spreadAmount).toBe(5); // 10000 * 0.0005 = 5 USDT
      expect(result.fees.totalFee).toBe(10); // 雙邊 Taker: 10 USDT
      expect(result.netProfit).toBe(-5); // 5 - 10 = -5 USDT
      expect(result.netProfitPercent).toBeCloseTo(-0.0005, 6); // -0.05%
    });

    it('應該處理零利差', () => {
      const result = assessor.calculateNetProfit(0, 10000, 'maker');

      expect(result.spreadAmount).toBe(0);
      expect(result.netProfit).toBe(-4); // 僅扣除手續費
      expect(result.netProfitPercent).toBeCloseTo(-0.0004, 6);
    });
  });

  describe('assess', () => {
    let mockPair: FundingRatePair;

    beforeEach(() => {
      // 建立模擬的 FundingRatePair
      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001, // 0.01%
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50000,
        recordedAt: new Date(),
      });

      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0011, // 0.11%
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50100,
        recordedAt: new Date(),
      });

      mockPair = {
        symbol: 'BTCUSDT',
        exchanges: new Map([
          ['binance', { rate: binanceRate, price: 50000 }],
          ['okx', { rate: okxRate, price: 50100 }],
        ]),
        bestPair: {
          longExchange: 'binance' as ExchangeName,
          shortExchange: 'okx' as ExchangeName,
          spreadPercent: 0.1, // 0.1%
          spreadAnnualized: 109.5, // 0.1% * 365 * 3
          priceDiffPercent: 0.2, // (50100 - 50000) / 50050 * 100 ≈ 0.2%
        },
        recordedAt: new Date(),
      };
    });

    it('應該判斷套利可行（淨收益 > 最小利潤）', () => {
      // 利差：0.1%
      // Maker 手續費：0.04%
      // 淨收益：0.06% > 最小利潤 0.01% ✓
      const assessment = assessor.assess(mockPair, 10000, 'maker');

      expect(assessment.isFeasible).toBe(true);
      expect(assessment.netProfit).toBe(6); // 0.06% * 10000
      expect(assessment.netProfitPercent).toBeCloseTo(0.0006, 6);
      expect(assessment.spreadPercent).toBe(0.1);
      expect(assessment.longExchange).toBe('binance');
      expect(assessment.shortExchange).toBe('okx');
    });

    it('應該判斷套利不可行（淨收益 < 最小利潤）', () => {
      // 修改利差為 0.05%
      mockPair.bestPair!.spreadPercent = 0.05;

      // 利差：0.05%
      // Taker 手續費：0.1%
      // 淨收益：-0.05% < 最小利潤 0.01% ✗
      const assessment = assessor.assess(mockPair, 10000, 'taker');

      expect(assessment.isFeasible).toBe(false);
      expect(assessment.netProfit).toBe(-5); // -0.05% * 10000
      expect(assessment.reason).toContain('淨收益為負'); // 負收益的情況
    });

    it('應該檢測極端價差並發出警告', () => {
      // 修改價差為 6%（超過 5% 閾值）
      mockPair.bestPair!.priceDiffPercent = 6;

      const assessment = assessor.assess(mockPair, 10000, 'maker');

      expect(assessment.warnings.length).toBeGreaterThan(0);
      expect(assessment.warnings.some(w => w.includes('極端價差警告'))).toBe(true);
      expect(assessment.warnings.some(w => w.includes('6.00%'))).toBe(true);
    });

    it('應該處理無 bestPair 的情況', () => {
      mockPair.bestPair = undefined;

      const assessment = assessor.assess(mockPair, 10000, 'maker');

      expect(assessment.isFeasible).toBe(false);
      expect(assessment.reason).toContain('無套利對資訊');
    });

    it('應該處理無價格資料的情況', () => {
      // 移除價格資料
      mockPair.bestPair!.priceDiffPercent = undefined;

      const assessment = assessor.assess(mockPair, 10000, 'maker');

      // 仍然可行，但無極端價差警告
      expect(assessment.isFeasible).toBe(true);
      expect(assessment.warnings.length).toBe(0);
    });

    it('應該包含完整的評估資訊', () => {
      const assessment = assessor.assess(mockPair, 10000, 'maker');

      expect(assessment).toHaveProperty('symbol');
      expect(assessment).toHaveProperty('longExchange');
      expect(assessment).toHaveProperty('shortExchange');
      expect(assessment).toHaveProperty('spreadPercent');
      expect(assessment).toHaveProperty('spreadAmount');
      expect(assessment).toHaveProperty('fees');
      expect(assessment).toHaveProperty('netProfit');
      expect(assessment).toHaveProperty('netProfitPercent');
      expect(assessment).toHaveProperty('isFeasible');
      expect(assessment).toHaveProperty('reason');
      expect(assessment).toHaveProperty('warnings');
      expect(assessment).toHaveProperty('assessedAt');
    });
  });

  describe('updateConfig', () => {
    it('應該更新部分配置', () => {
      assessor.updateConfig({ makerFeeRate: 0.0001 });

      const config = assessor.getConfig();
      expect(config.makerFeeRate).toBe(0.0001);
      expect(config.takerFeeRate).toBe(0.0005); // 保持不變
    });

    it('應該更新所有配置', () => {
      const newConfig: ArbitrageConfig = {
        makerFeeRate: 0.0003,
        takerFeeRate: 0.0006,
        minProfitThreshold: 0.0002,
        extremePriceDiffThreshold: 0.03,
      };

      assessor.updateConfig(newConfig);
      expect(assessor.getConfig()).toEqual(newConfig);
    });
  });
});
