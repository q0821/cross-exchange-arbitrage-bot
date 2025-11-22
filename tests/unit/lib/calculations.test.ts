/**
 * Unit tests for calculations helper functions
 *
 * Feature 022: 年化收益門檻套利機會偵測
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedReturnFromPercent,
  isOpportunityByAnnualized,
  isApproachingOpportunity,
  determineOpportunityStatus,
} from '../../../src/lib/calculations';

describe('calculateAnnualizedReturn', () => {
  it('should calculate correct annualized return for 8h basis', () => {
    // 8h 基準，利差 0.5% (0.005)
    // 年化 = 0.005 × 365 × (24 / 8) × 100 = 547.5%
    const result = calculateAnnualizedReturn(0.005, 8);
    expect(result).toBeCloseTo(547.5, 1);
  });

  it('should calculate correct annualized return for 1h basis', () => {
    // 1h 基準，利差 0.0625% (0.000625)
    // 年化 = 0.000625 × 365 × (24 / 1) × 100 = 547.5%
    const result = calculateAnnualizedReturn(0.000625, 1);
    expect(result).toBeCloseTo(547.5, 1);
  });

  it('should calculate correct annualized return for 4h basis', () => {
    // 4h 基準，利差 0.25% (0.0025)
    // 年化 = 0.0025 × 365 × (24 / 4) × 100 = 547.5%
    const result = calculateAnnualizedReturn(0.0025, 4);
    expect(result).toBeCloseTo(547.5, 1);
  });

  it('should calculate correct annualized return for 24h basis', () => {
    // 24h 基準，利差 1.5% (0.015)
    // 年化 = 0.015 × 365 × (24 / 24) × 100 = 547.5%
    const result = calculateAnnualizedReturn(0.015, 24);
    expect(result).toBeCloseTo(547.5, 1);
  });

  it('should produce consistent annualized returns across all time bases', () => {
    // 關鍵測試：同一個年化收益率，在不同時間基準下的計算結果應該一致
    // 假設某交易對的年化收益是 800%

    // 反向計算各時間基準下對應的利差
    // 年化 = spread × 365 × (24 / timeBasis) × 100
    // spread = 年化 / (365 × (24 / timeBasis) × 100)

    const targetAnnualized = 800;

    // 計算各時間基準下達到 800% 年化的利差
    const spread1h = targetAnnualized / (365 * 24 * 100); // ~0.0913%
    const spread4h = targetAnnualized / (365 * 6 * 100); // ~0.365%
    const spread8h = targetAnnualized / (365 * 3 * 100); // ~0.73%
    const spread24h = targetAnnualized / (365 * 1 * 100); // ~2.19%

    // 驗證所有時間基準計算出的年化收益相同
    expect(calculateAnnualizedReturn(spread1h, 1)).toBeCloseTo(
      targetAnnualized,
      1
    );
    expect(calculateAnnualizedReturn(spread4h, 4)).toBeCloseTo(
      targetAnnualized,
      1
    );
    expect(calculateAnnualizedReturn(spread8h, 8)).toBeCloseTo(
      targetAnnualized,
      1
    );
    expect(calculateAnnualizedReturn(spread24h, 24)).toBeCloseTo(
      targetAnnualized,
      1
    );
  });

  it('should handle zero spread', () => {
    const result = calculateAnnualizedReturn(0, 8);
    expect(result).toBe(0);
  });

  it('should handle negative spread', () => {
    const result = calculateAnnualizedReturn(-0.005, 8);
    expect(result).toBeCloseTo(-547.5, 1);
  });
});

describe('calculateAnnualizedReturnFromPercent', () => {
  it('should convert percent to decimal and calculate', () => {
    // 0.5% 利差，8h 基準
    const result = calculateAnnualizedReturnFromPercent(0.5, 8);
    expect(result).toBeCloseTo(547.5, 1);
  });

  it('should handle various percentage inputs', () => {
    // 1% 利差，8h 基準
    // 年化 = 0.01 × 365 × 3 × 100 = 1095%
    const result = calculateAnnualizedReturnFromPercent(1, 8);
    expect(result).toBeCloseTo(1095, 1);
  });
});

describe('isOpportunityByAnnualized', () => {
  it('should return true when annualized return >= threshold', () => {
    expect(isOpportunityByAnnualized(850, 800)).toBe(true);
    expect(isOpportunityByAnnualized(1000, 800)).toBe(true);
  });

  it('should return true when annualized return equals threshold (boundary)', () => {
    // 邊界條件：剛好等於門檻
    expect(isOpportunityByAnnualized(800, 800)).toBe(true);
  });

  it('should return false when annualized return < threshold', () => {
    expect(isOpportunityByAnnualized(700, 800)).toBe(false);
    expect(isOpportunityByAnnualized(799.9, 800)).toBe(false);
  });

  it('should handle custom threshold', () => {
    expect(isOpportunityByAnnualized(500, 500)).toBe(true);
    expect(isOpportunityByAnnualized(499, 500)).toBe(false);
  });

  it('should handle zero threshold', () => {
    // 門檻為 0 時，任何正值都是機會
    expect(isOpportunityByAnnualized(0.1, 0)).toBe(true);
    expect(isOpportunityByAnnualized(0, 0)).toBe(true);
  });
});

describe('isApproachingOpportunity', () => {
  it('should return true when in approaching range', () => {
    // 600-799% 是接近機會範圍（主門檻 800%，接近門檻 600%）
    expect(isApproachingOpportunity(700, 800, 600)).toBe(true);
    expect(isApproachingOpportunity(600, 800, 600)).toBe(true);
    expect(isApproachingOpportunity(799, 800, 600)).toBe(true);
  });

  it('should return false when below approaching threshold', () => {
    expect(isApproachingOpportunity(500, 800, 600)).toBe(false);
    expect(isApproachingOpportunity(599, 800, 600)).toBe(false);
  });

  it('should return false when at or above opportunity threshold', () => {
    // 已經是機會，不算「接近」
    expect(isApproachingOpportunity(800, 800, 600)).toBe(false);
    expect(isApproachingOpportunity(850, 800, 600)).toBe(false);
  });
});

describe('determineOpportunityStatus', () => {
  const OPPORTUNITY = 800;
  const APPROACHING = 600;

  it('should return "opportunity" when >= opportunity threshold', () => {
    expect(determineOpportunityStatus(850, OPPORTUNITY, APPROACHING)).toBe(
      'opportunity'
    );
    expect(determineOpportunityStatus(800, OPPORTUNITY, APPROACHING)).toBe(
      'opportunity'
    );
  });

  it('should return "approaching" when in approaching range', () => {
    expect(determineOpportunityStatus(700, OPPORTUNITY, APPROACHING)).toBe(
      'approaching'
    );
    expect(determineOpportunityStatus(600, OPPORTUNITY, APPROACHING)).toBe(
      'approaching'
    );
    expect(determineOpportunityStatus(799.9, OPPORTUNITY, APPROACHING)).toBe(
      'approaching'
    );
  });

  it('should return "normal" when below approaching threshold', () => {
    expect(determineOpportunityStatus(500, OPPORTUNITY, APPROACHING)).toBe(
      'normal'
    );
    expect(determineOpportunityStatus(599.9, OPPORTUNITY, APPROACHING)).toBe(
      'normal'
    );
    expect(determineOpportunityStatus(0, OPPORTUNITY, APPROACHING)).toBe(
      'normal'
    );
  });

  it('should handle custom thresholds', () => {
    expect(determineOpportunityStatus(550, 500, 400)).toBe('opportunity');
    expect(determineOpportunityStatus(450, 500, 400)).toBe('approaching');
    expect(determineOpportunityStatus(350, 500, 400)).toBe('normal');
  });
});
