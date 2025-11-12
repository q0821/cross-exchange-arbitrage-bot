/**
 * Arbitrage Assessment Integration Tests
 *
 * 套利評估整合測試（完整流程）
 * Feature: 004-fix-okx-add-price-display
 * Task: T038
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FundingRateRecord, createMultiExchangeFundingRatePair } from '../../src/models/FundingRate.js';
import { ArbitrageAssessor } from '../../src/services/assessment/ArbitrageAssessor.js';
import type { ExchangeName, ExchangeRateData } from '../../src/models/FundingRate.js';

describe('Arbitrage Assessment Integration', () => {
  let assessor: ArbitrageAssessor;

  beforeAll(() => {
    assessor = new ArbitrageAssessor({
      makerFeeRate: 0.0002, // 0.02%
      takerFeeRate: 0.0005, // 0.05%
      minProfitThreshold: 0.0001, // 0.01%
      extremePriceDiffThreshold: 0.05, // 5%
    });
  });

  describe('完整套利評估流程', () => {
    it('應該正確評估可行的套利機會（4 個交易所）', () => {
      // 模擬 4 個交易所的資金費率和價格
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      // Binance: 0.01% 費率，價格 50000
      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50000,
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate, price: 50000 });

      // OKX: 0.15% 費率，價格 50100
      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0015,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50100,
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate, price: 50100 });

      // MEXC: 0.05% 費率，價格 49950
      const mexcRate = new FundingRateRecord({
        exchange: 'mexc',
        symbol: 'BTCUSDT',
        fundingRate: 0.0005,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 49950,
        recordedAt: new Date(),
      });
      exchangesData.set('mexc', { rate: mexcRate, price: 49950 });

      // GateIO: 0.12% 費率，價格 50050
      const gateioRate = new FundingRateRecord({
        exchange: 'gateio',
        symbol: 'BTCUSDT',
        fundingRate: 0.0012,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50050,
        recordedAt: new Date(),
      });
      exchangesData.set('gateio', { rate: gateioRate, price: 50050 });

      // 建立 FundingRatePair（會自動計算最佳套利對）
      const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

      // 驗證最佳套利對
      expect(pair.bestPair).toBeDefined();
      expect(pair.bestPair!.spreadPercent).toBeGreaterThan(0);

      // 執行套利評估
      const assessment = assessor.assess(pair, 10000, 'maker');

      // 驗證評估結果
      expect(assessment.symbol).toBe('BTCUSDT');
      expect(assessment.longExchange).toBeDefined();
      expect(assessment.shortExchange).toBeDefined();
      expect(assessment.spreadPercent).toBeGreaterThan(0);
      expect(assessment.fees.totalFee).toBeGreaterThan(0);
      expect(assessment.netProfit).toBeDefined();
      expect(assessment.assessedAt).toBeInstanceOf(Date);

      // 記錄結果用於除錯
      console.log('\n📊 套利評估結果:');
      console.log(`  交易對: ${assessment.symbol}`);
      console.log(`  做多: ${assessment.longExchange}`);
      console.log(`  做空: ${assessment.shortExchange}`);
      console.log(`  利差: ${assessment.spreadPercent.toFixed(3)}%`);
      console.log(`  手續費: ${assessment.fees.totalFee.toFixed(2)} USDT`);
      console.log(`  淨收益: ${assessment.netProfit.toFixed(2)} USDT (${(assessment.netProfitPercent * 100).toFixed(3)}%)`);
      console.log(`  可行性: ${assessment.isFeasible ? '✅ 可行' : '❌ 不可行'}`);
      if (!assessment.isFeasible) {
        console.log(`  原因: ${assessment.reason}`);
      }
      if (assessment.warnings.length > 0) {
        console.log(`  警告: ${assessment.warnings.join(', ')}`);
      }
    });

    it('應該正確評估不可行的套利機會（利差太小）', () => {
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      // Binance: 0.01% 費率
      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'ETHUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 3000,
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate, price: 3000 });

      // OKX: 0.03% 費率（利差只有 0.02%，小於雙邊 Taker 手續費 0.1%）
      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'ETHUSDT',
        fundingRate: 0.0003,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 3010,
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate, price: 3010 });

      const pair = createMultiExchangeFundingRatePair('ETHUSDT', exchangesData);
      const assessment = assessor.assess(pair, 10000, 'taker');

      expect(assessment.isFeasible).toBe(false);
      expect(assessment.netProfit).toBeLessThan(0); // 負收益
      expect(assessment.reason).toBeDefined();
      expect(assessment.reason).toContain('淨收益');
    });

    it('應該檢測極端價差並發出警告', () => {
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      // Binance: 價格 50000
      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50000,
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate, price: 50000 });

      // OKX: 價格 53000（價差 6%，超過 5% 閾值）
      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0015,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 53000,
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate, price: 53000 });

      const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);
      const assessment = assessor.assess(pair, 10000, 'maker');

      expect(assessment.warnings.length).toBeGreaterThan(0);
      expect(assessment.warnings.some(w => w.includes('極端價差'))).toBe(true);
    });

    it('應該支援不同的手續費類型', () => {
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50000,
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate, price: 50000 });

      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0011,
        nextFundingTime: new Date(Date.now() + 3600000),
        markPrice: 50100,
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate, price: 50100 });

      const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

      // 測試 Maker 費率
      const makerAssessment = assessor.assess(pair, 10000, 'maker');
      expect(makerAssessment.fees.totalFeePercent).toBeCloseTo(0.0004, 6); // 0.04%

      // 測試 Taker 費率
      const takerAssessment = assessor.assess(pair, 10000, 'taker');
      expect(takerAssessment.fees.totalFeePercent).toBeCloseTo(0.001, 6); // 0.1%

      // 測試 Mixed 費率
      const mixedAssessment = assessor.assess(pair, 10000, 'mixed');
      expect(mixedAssessment.fees.totalFeePercent).toBeCloseTo(0.0007, 6); // 0.07%

      // Maker 應該比 Taker 更容易獲利
      expect(makerAssessment.netProfit).toBeGreaterThan(takerAssessment.netProfit);
    });
  });

  describe('邊界條件測試', () => {
    it('應該處理零資金量', () => {
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate });

      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0011,
        nextFundingTime: new Date(Date.now() + 3600000),
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate });

      const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);
      const assessment = assessor.assess(pair, 0, 'maker');

      expect(assessment.spreadAmount).toBe(0);
      expect(assessment.fees.totalFee).toBe(0);
      expect(assessment.netProfit).toBe(0);
    });

    it('應該處理無價格資料的情況', () => {
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      const binanceRate = new FundingRateRecord({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 3600000),
        recordedAt: new Date(),
      });
      exchangesData.set('binance', { rate: binanceRate }); // 無價格

      const okxRate = new FundingRateRecord({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        fundingRate: 0.0011,
        nextFundingTime: new Date(Date.now() + 3600000),
        recordedAt: new Date(),
      });
      exchangesData.set('okx', { rate: okxRate }); // 無價格

      const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);
      const assessment = assessor.assess(pair, 10000, 'maker');

      // 無價格資料時，priceDiffPercent 應該是 undefined
      expect(pair.bestPair?.priceDiffPercent).toBeUndefined();
      // 不應該有極端價差警告
      expect(assessment.warnings.length).toBe(0);
    });
  });
});
