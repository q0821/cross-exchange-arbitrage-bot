/**
 * Unit tests for config threshold reading
 *
 * Feature 022: 年化收益門檻套利機會偵測
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOpportunityThresholdAnnualized,
  getApproachingThreshold,
  getOpportunityThresholds,
} from '../../../src/lib/config';

// 直接測試 config 模組的函式，使用已載入的 env 配置
describe('config - getOpportunityThresholdAnnualized', () => {
  it('should return a valid number', () => {
    const result = getOpportunityThresholdAnnualized();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should return consistent value on multiple calls', () => {
    const result1 = getOpportunityThresholdAnnualized();
    const result2 = getOpportunityThresholdAnnualized();
    expect(result1).toBe(result2);
  });
});

describe('config - getApproachingThreshold', () => {
  it('should calculate approaching threshold as 75% of main threshold', () => {
    expect(getApproachingThreshold(800)).toBe(600);
    expect(getApproachingThreshold(1000)).toBe(750);
    expect(getApproachingThreshold(500)).toBe(375);
  });

  it('should handle zero threshold', () => {
    expect(getApproachingThreshold(0)).toBe(0);
  });

  it('should handle very high threshold', () => {
    expect(getApproachingThreshold(10000)).toBe(7500);
  });
});

describe('config - getOpportunityThresholds', () => {
  it('should return both thresholds as valid numbers', () => {
    const thresholds = getOpportunityThresholds();

    expect(typeof thresholds.opportunity).toBe('number');
    expect(typeof thresholds.approaching).toBe('number');
    expect(thresholds.opportunity).toBeGreaterThanOrEqual(0);
    expect(thresholds.approaching).toBeGreaterThanOrEqual(0);
  });

  it('should return approaching as 75% of opportunity', () => {
    const thresholds = getOpportunityThresholds();

    // approaching 應該是 opportunity 的 75%
    expect(thresholds.approaching).toBeCloseTo(thresholds.opportunity * 0.75);
  });
});
