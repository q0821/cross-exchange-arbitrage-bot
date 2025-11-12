/**
 * Unit tests for net-return-calculator
 *
 * Tests the net return calculation logic to ensure:
 * 1. Correct formula application: spreadPercent - |priceDiffPercent| - tradingCostRate
 * 2. Proper handling of positive and negative price spreads
 * 3. Edge case handling (null, undefined, NaN, Infinity)
 * 4. Default trading cost rate usage
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetReturn,
  calculateNetReturnPercent,
} from '../../../src/lib/net-return-calculator.js';
import { TOTAL_TRADING_COST_RATE } from '../../../src/lib/cost-constants.js';

describe('calculateNetReturn', () => {
  describe('正常情況：有利價差（正值）', () => {
    it('應正確計算淨收益（費率 0.5%, 價差 +0.15%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.5, 0.15, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(0.05, 2); // 0.5 - 0.15 - 0.3 = 0.05
    });

    it('應正確計算淨收益（費率 0.8%, 價差 +0.2%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.8, 0.2, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(0.3, 2); // 0.8 - 0.2 - 0.3 = 0.3
    });

    it('應正確計算淨收益（費率 1.0%, 價差 +0.1%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(1.0, 0.1, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(0.6, 2); // 1.0 - 0.1 - 0.3 = 0.6
    });
  });

  describe('正常情況：不利價差（負值）', () => {
    it('應使用絕對值計算淨收益（費率 0.5%, 價差 -0.15%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.5, -0.15, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(0.05, 2); // 0.5 - |-0.15| - 0.3 = 0.05
    });

    it('應使用絕對值計算淨收益（費率 0.3%, 價差 -0.05%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.3, -0.05, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(-0.05, 2); // 0.3 - 0.05 - 0.3 = -0.05
    });
  });

  describe('正常情況：虧損場景', () => {
    it('應返回負值淨收益（費率 0.3%, 價差 +0.1%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.3, 0.1, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(-0.1, 2); // 0.3 - 0.1 - 0.3 = -0.1
    });

    it('應返回負值淨收益（費率 0.2%, 價差 +0.3%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.2, 0.3, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(-0.4, 2); // 0.2 - 0.3 - 0.3 = -0.4
    });
  });

  describe('邊界情況：價差為零', () => {
    it('應正確計算淨收益（費率 0.5%, 價差 0%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0.5, 0, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(0.2, 2); // 0.5 - 0 - 0.3 = 0.2
    });
  });

  describe('邊界情況：費率為零', () => {
    it('應返回負值淨收益（費率 0%, 價差 +0.1%, 手續費 0.3%）', () => {
      const result = calculateNetReturn(0, 0.1, TOTAL_TRADING_COST_RATE);
      expect(result).toBeCloseTo(-0.4, 2); // 0 - 0.1 - 0.3 = -0.4
    });
  });

  describe('錯誤處理：價差資料缺失', () => {
    it('應返回 null 當 priceDiffPercent 為 null', () => {
      const result = calculateNetReturn(0.5, null, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });

    it('應返回 null 當 priceDiffPercent 為 undefined', () => {
      const result = calculateNetReturn(0.5, undefined, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });

    it('應返回 null 當 priceDiffPercent 為 NaN', () => {
      const result = calculateNetReturn(0.5, NaN, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });

    it('應返回 null 當 priceDiffPercent 為 Infinity', () => {
      const result = calculateNetReturn(0.5, Infinity, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });
  });

  describe('錯誤處理：費率資料無效', () => {
    it('應返回 null 當 spreadPercent 為 NaN', () => {
      const result = calculateNetReturn(NaN, 0.15, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });

    it('應返回 null 當 spreadPercent 為 Infinity', () => {
      const result = calculateNetReturn(Infinity, 0.15, TOTAL_TRADING_COST_RATE);
      expect(result).toBeNull();
    });
  });

  describe('錯誤處理：手續費無效', () => {
    it('應返回 null 當 tradingCostRate 為 NaN', () => {
      const result = calculateNetReturn(0.5, 0.15, NaN);
      expect(result).toBeNull();
    });

    it('應返回 null 當 tradingCostRate 為 Infinity', () => {
      const result = calculateNetReturn(0.5, 0.15, Infinity);
      expect(result).toBeNull();
    });
  });

  describe('預設參數：使用預設手續費率', () => {
    it('應使用 TOTAL_TRADING_COST_RATE 當未提供 tradingCostRate', () => {
      const result = calculateNetReturn(0.5, 0.15);
      expect(result).toBeCloseTo(0.05, 2); // 0.5 - 0.15 - 0.3 = 0.05
    });
  });

  describe('精確度驗證', () => {
    it('應處理小數精度問題（例如 0.1 + 0.2 ≠ 0.3）', () => {
      const result = calculateNetReturn(0.1, 0.05, 0.001);
      // 0.1 - 0.05 - 0.1 = -0.05
      expect(result).toBeCloseTo(-0.05, 10);
    });
  });
});

describe('calculateNetReturnPercent', () => {
  it('應正確計算淨收益並使用預設手續費率', () => {
    const result = calculateNetReturnPercent(0.5, 0.15);
    expect(result).toBeCloseTo(0.05, 2); // 0.5 - 0.15 - 0.3 = 0.05
  });

  it('應返回 null 當價差資料缺失', () => {
    const result = calculateNetReturnPercent(0.5, null);
    expect(result).toBeNull();
  });

  it('應正確處理負價差', () => {
    const result = calculateNetReturnPercent(0.5, -0.15);
    expect(result).toBeCloseTo(0.05, 2); // 0.5 - |-0.15| - 0.3 = 0.05
  });
});

describe('實際場景測試（基於 quickstart.md 範例）', () => {
  it('場景 1: 費率 0.5%, 價差 +0.15% → 淨收益 0.05%', () => {
    const result = calculateNetReturn(0.5, 0.15, TOTAL_TRADING_COST_RATE);
    expect(result).toBeCloseTo(0.05, 2);
  });

  it('場景 2: 費率 0.5%, 價差 -0.15% → 淨收益 0.05%', () => {
    const result = calculateNetReturn(0.5, -0.15, TOTAL_TRADING_COST_RATE);
    expect(result).toBeCloseTo(0.05, 2);
  });

  it('場景 3: 費率 0.3%, 價差 +0.1% → 淨收益 -0.1%', () => {
    const result = calculateNetReturn(0.3, 0.1, TOTAL_TRADING_COST_RATE);
    expect(result).toBeCloseTo(-0.1, 2);
  });

  it('場景 4: 費率 0.8%, 價差 +0.2% → 淨收益 0.3%', () => {
    const result = calculateNetReturn(0.8, 0.2, TOTAL_TRADING_COST_RATE);
    expect(result).toBeCloseTo(0.3, 2);
  });
});
