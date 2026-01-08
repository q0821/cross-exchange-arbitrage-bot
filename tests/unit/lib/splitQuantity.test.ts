/**
 * splitQuantity.test.ts - 數量分配工具函式測試
 *
 * Feature 060: Split Position Open (分單開倉)
 */

import { describe, it, expect } from 'vitest';
import { splitQuantity, validateSplitQuantity } from '@/lib/split-quantity';

describe('splitQuantity', () => {
  // T005: 測試偶數整除
  describe('even division', () => {
    it('should split 600 into 2 equal parts of 300 each', () => {
      const result = splitQuantity(600, 2);
      expect(result).toEqual([300, 300]);
      expect(validateSplitQuantity(600, result)).toBe(true);
    });

    it('should split 1000 into 4 equal parts of 250 each', () => {
      const result = splitQuantity(1000, 4);
      expect(result).toEqual([250, 250, 250, 250]);
      expect(validateSplitQuantity(1000, result)).toBe(true);
    });

    it('should split 0.01 into 2 equal parts of 0.005 each', () => {
      const result = splitQuantity(0.01, 2);
      expect(result).toEqual([0.005, 0.005]);
      expect(validateSplitQuantity(0.01, result)).toBe(true);
    });
  });

  // T006: 測試不可整除情況
  describe('uneven division', () => {
    it('should split 100 into 3 parts with remainder distributed', () => {
      const result = splitQuantity(100, 3);
      // 100 / 3 = 33.333...
      // 前 1 組: 34 (因為餘數 1)
      // 後 2 組: 33
      expect(result[0]).toBeCloseTo(33.3334, 4);
      expect(result[1]).toBeCloseTo(33.3333, 4);
      expect(result[2]).toBeCloseTo(33.3333, 4);
      expect(validateSplitQuantity(100, result)).toBe(true);
    });

    it('should split 10 into 3 parts correctly', () => {
      const result = splitQuantity(10, 3);
      // 10 / 3 = 3.333...
      expect(result[0]).toBeCloseTo(3.3334, 4);
      expect(result[1]).toBeCloseTo(3.3333, 4);
      expect(result[2]).toBeCloseTo(3.3333, 4);
      expect(validateSplitQuantity(10, result)).toBe(true);
    });

    it('should split 1 into 7 parts correctly', () => {
      const result = splitQuantity(1, 7);
      expect(result.length).toBe(7);
      expect(validateSplitQuantity(1, result)).toBe(true);
    });

    it('should split 0.0003 into 2 parts', () => {
      const result = splitQuantity(0.0003, 2);
      // Note: Due to precision (10000x), 0.0003 * 10000 = 3, split to [2, 1] -> [0.0002, 0.0001]
      // This is expected behavior for very small quantities
      expect(result[0]).toBeCloseTo(0.0002, 4);
      expect(result[1]).toBeCloseTo(0.0001, 4);
      expect(validateSplitQuantity(0.0003, result)).toBe(true);
    });
  });

  // T007: 測試邊界情況 count=1
  describe('edge cases', () => {
    it('should return original quantity when count is 1', () => {
      const result = splitQuantity(600, 1);
      expect(result).toEqual([600]);
    });

    it('should return original quantity when count is 0', () => {
      const result = splitQuantity(100, 0);
      expect(result).toEqual([100]);
    });

    it('should return original quantity when count is negative', () => {
      const result = splitQuantity(100, -1);
      expect(result).toEqual([100]);
    });

    it('should handle very small quantities', () => {
      const result = splitQuantity(0.0001, 1);
      expect(result).toEqual([0.0001]);
    });

    it('should handle large quantities', () => {
      const result = splitQuantity(1000000, 10);
      expect(result.length).toBe(10);
      expect(result.every(q => q === 100000)).toBe(true);
      expect(validateSplitQuantity(1000000, result)).toBe(true);
    });
  });

  // 進階測試：確保分配公平性
  describe('fairness', () => {
    it('should have maximum difference of 1 unit (scaled) between groups', () => {
      const result = splitQuantity(100, 7);
      const max = Math.max(...result);
      const min = Math.min(...result);
      // 差異應該小於 0.0002 (因為精度是 0.0001)
      expect(max - min).toBeLessThan(0.0002);
    });

    it('sum of all parts should equal original total', () => {
      const testCases = [
        { total: 100, count: 3 },
        { total: 1000, count: 7 },
        { total: 0.5, count: 3 },
        { total: 123.456, count: 5 },
      ];

      for (const { total, count } of testCases) {
        const result = splitQuantity(total, count);
        expect(validateSplitQuantity(total, result)).toBe(true);
      }
    });
  });
});

describe('validateSplitQuantity', () => {
  it('should return true for valid split', () => {
    expect(validateSplitQuantity(100, [50, 50])).toBe(true);
    expect(validateSplitQuantity(100, [34, 33, 33])).toBe(true);
  });

  it('should return false for invalid split', () => {
    expect(validateSplitQuantity(100, [50, 49])).toBe(false);
    expect(validateSplitQuantity(100, [40, 40, 40])).toBe(false);
  });
});
