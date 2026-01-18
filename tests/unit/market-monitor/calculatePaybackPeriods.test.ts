/**
 * Unit tests for calculatePaybackPeriods function
 *
 * Feature 025: 價差回本週期指標
 *
 * 測試所有回本次數計算的邊界情況和正常情境
 */

import { describe, it, expect } from 'vitest';
import { calculatePaybackPeriods } from '../../../app/(dashboard)/market-monitor/utils/rateCalculations';

describe('calculatePaybackPeriods', () => {
  // ============================================================================
  // User Story 1: 價差不利時顯示回本次數
  // ============================================================================

  describe('US1: payback_needed status', () => {
    it('should return payback_needed status when price diff is negative and spread is positive', () => {
      const result = calculatePaybackPeriods(-0.15, 0.05, 8);

      expect(result.status).toBe('payback_needed');
      expect(result.periods).toBe(3.0);
      expect(result.estimatedHours).toBe(24.0); // 3.0 * 8
      expect(result.displayText).toBe('⚠️ 需 3.0 次資費回本');
      expect(result.color).toBe('orange');
      expect(result.details).toBeDefined();
      expect(result.details?.priceDiff).toBe(-0.15);
      expect(result.details?.rateSpread).toBe(0.05);
      expect(result.details?.formula).toContain('回本次數');
    });

    it('should calculate periods correctly with different values', () => {
      const result = calculatePaybackPeriods(-0.30, 0.10, 8);

      expect(result.status).toBe('payback_needed');
      expect(result.periods).toBe(3.0); // 0.30 / 0.10 = 3.0
      expect(result.estimatedHours).toBe(24.0);
    });
  });

  describe('US1: periods calculation precision (toFixed(1))', () => {
    it('should round periods to 1 decimal place', () => {
      const result = calculatePaybackPeriods(-0.123, 0.045, 8);

      // 0.123 / 0.045 = 2.733... => should round to 2.7
      expect(result.periods).toBe(2.7);
      expect(result.displayText).toBe('⚠️ 需 2.7 次資費回本');
    });

    it('should handle very small price differences', () => {
      const result = calculatePaybackPeriods(-0.001, 0.05, 8);

      // 0.001 / 0.05 = 0.02 => rounds to 0.0
      expect(result.periods).toBe(0.0);
      expect(result.status).toBe('payback_needed');
    });
  });

  describe('US1: too_many status (回本次數 > 100)', () => {
    it('should return too_many status when periods exceed 100', () => {
      const result = calculatePaybackPeriods(-0.50, 0.01, 8);

      // 0.50 / 0.01 = 50 => within 100, should be payback_needed
      expect(result.status).toBe('payback_needed');
      expect(result.periods).toBe(50.0);
    });

    it('should return too_many status for extreme cases', () => {
      const result = calculatePaybackPeriods(-1.5, 0.01, 8);

      // 1.5 / 0.01 = 150 => exceeds 100
      expect(result.status).toBe('too_many');
      expect(result.periods).toBe(150.0);
      expect(result.displayText).toContain('回本次數過多');
      expect(result.displayText).toContain('150+ 次');
      expect(result.color).toBe('red');
      expect(result.details?.warning).toContain('費率可能在持倉期間波動');
    });

    it('should display floor value for too_many periods', () => {
      const result = calculatePaybackPeriods(-2.55, 0.01, 8);

      // 2.55 / 0.01 = 255.0
      expect(result.status).toBe('too_many');
      expect(result.displayText).toContain('255+ 次');
    });
  });

  // ============================================================================
  // User Story 2: 價差有利時顯示正面指標
  // ============================================================================

  describe('US2: favorable status (priceDiffPercent >= 0)', () => {
    it('should return favorable status when price diff is positive', () => {
      const result = calculatePaybackPeriods(0.15, 0.03, 8);

      expect(result.status).toBe('favorable');
      expect(result.periods).toBeUndefined();
      expect(result.estimatedHours).toBeUndefined();
      expect(result.displayText).toBe('✓ 價差有利');
      expect(result.color).toBe('green');
      expect(result.details).toBeDefined();
      expect(result.details?.formula).toContain('價差有利');
    });

    it('should return favorable status when price diff is exactly zero', () => {
      const result = calculatePaybackPeriods(0, 0.05, 8);

      expect(result.status).toBe('favorable');
      expect(result.displayText).toBe('✓ 價差有利');
      expect(result.color).toBe('green');
    });

    it('should return favorable status for very small positive price diff', () => {
      const result = calculatePaybackPeriods(0.001, 0.05, 8);

      expect(result.status).toBe('favorable');
    });
  });

  // ============================================================================
  // User Story 3: Tooltip 詳細資訊
  // ============================================================================

  describe('US3: estimatedHours calculation (periods × timeBasis)', () => {
    it('should calculate estimated hours correctly for 1h basis', () => {
      const result = calculatePaybackPeriods(-0.15, 0.05, 1);

      expect(result.estimatedHours).toBe(3.0); // 3.0 * 1 = 3.0
    });

    it('should calculate estimated hours correctly for 4h basis', () => {
      const result = calculatePaybackPeriods(-0.15, 0.05, 4);

      expect(result.estimatedHours).toBe(12.0); // 3.0 * 4 = 12.0
    });

    it('should calculate estimated hours correctly for 24h basis', () => {
      const result = calculatePaybackPeriods(-0.15, 0.05, 24);

      expect(result.estimatedHours).toBe(72.0); // 3.0 * 24 = 72.0
    });
  });

  describe('US3: details object generation', () => {
    it('should generate complete details for payback_needed', () => {
      const result = calculatePaybackPeriods(-0.15, 0.05, 8);

      expect(result.details).toBeDefined();
      expect(result.details?.priceDiff).toBe(-0.15);
      expect(result.details?.rateSpread).toBe(0.05);
      expect(result.details?.formula).toContain('回本次數 = |價差| ÷ 費率差');
      expect(result.details?.formula).toContain('0.15% ÷ 0.05% = 3.0 次');
      expect(result.details?.warning).toBeUndefined();
    });

    it('should generate details with warning for too_many', () => {
      const result = calculatePaybackPeriods(-1.5, 0.01, 8);

      expect(result.details?.warning).toBeDefined();
      expect(result.details?.warning).toContain('⚠️ 注意');
    });

    it('should generate details for favorable without periods', () => {
      const result = calculatePaybackPeriods(0.15, 0.03, 8);

      expect(result.details).toBeDefined();
      expect(result.details?.priceDiff).toBe(0.15);
      expect(result.details?.formula).toContain('價差有利');
    });
  });

  // ============================================================================
  // User Story 5: 處理無價格數據的情況
  // ============================================================================

  describe('US5: no_data status (priceDiffPercent = null)', () => {
    it('should return no_data status when priceDiffPercent is null', () => {
      const result = calculatePaybackPeriods(null, 0.05, 8);

      expect(result.status).toBe('no_data');
      expect(result.periods).toBeUndefined();
      expect(result.estimatedHours).toBeUndefined();
      expect(result.displayText).toBe('N/A（無價格數據）');
      expect(result.color).toBe('gray');
      expect(result.details).toBeUndefined();
    });

    it('should return no_data status when priceDiffPercent is undefined', () => {
      const result = calculatePaybackPeriods(undefined as any, 0.05, 8);

      expect(result.status).toBe('no_data');
    });
  });

  describe('US5: impossible status (spreadPercent = 0)', () => {
    it('should return impossible status when spread is zero', () => {
      const result = calculatePaybackPeriods(-0.15, 0, 8);

      expect(result.status).toBe('impossible');
      expect(result.periods).toBeUndefined();
      expect(result.displayText).toBe('無法回本（費率差為零）');
      expect(result.color).toBe('red');
      expect(result.details).toBeDefined();
      expect(result.details?.formula).toContain('費率差為零');
    });

    it('should return impossible status when spread is negative', () => {
      const result = calculatePaybackPeriods(-0.15, -0.05, 8);

      expect(result.status).toBe('impossible');
      expect(result.displayText).toBe('無法回本（費率差為零）');
    });
  });

  describe('US5: NaN input handling', () => {
    it('should return no_data status for NaN priceDiffPercent', () => {
      const result = calculatePaybackPeriods(NaN, 0.05, 8);

      expect(result.status).toBe('no_data');
      expect(result.displayText).toBe('N/A（無價格數據）');
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle extremely small spread values', () => {
      const result = calculatePaybackPeriods(-0.15, 0.001, 8);

      // 0.15 / 0.001 = 150 => too_many
      expect(result.status).toBe('too_many');
      expect(result.periods).toBe(150.0);
    });

    it('should handle exactly 100 periods (boundary case)', () => {
      const result = calculatePaybackPeriods(-1.0, 0.01, 8);

      // 1.0 / 0.01 = 100 => should be payback_needed (not too_many)
      expect(result.status).toBe('payback_needed');
      expect(result.periods).toBe(100.0);
    });

    it('should handle exactly 100.1 periods (just over boundary)', () => {
      const result = calculatePaybackPeriods(-1.001, 0.01, 8);

      // 1.001 / 0.01 = 100.1 => should be too_many
      expect(result.status).toBe('too_many');
      expect(result.periods).toBe(100.1);
    });

    it('should handle negative price diff with very large absolute value', () => {
      const result = calculatePaybackPeriods(-5.0, 0.05, 8);

      // 5.0 / 0.05 = 100 => payback_needed
      expect(result.status).toBe('payback_needed');
      expect(result.periods).toBe(100.0);
    });
  });
});
