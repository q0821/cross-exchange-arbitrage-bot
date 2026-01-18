/**
 * Cost Calculator Unit Tests
 *
 * Tests for cost calculation functions used in arbitrage opportunity evaluation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalCost,
  calculateNetProfit,
  calculateNetProfitRate,
  calculateNetAnnualizedReturn,
  isValidOpportunity,
  getBreakEvenRate,
  formatPercentage,
} from '@/lib/cost-calculator';
import {
  TRADING_FEES_RATE,
  SLIPPAGE_RATE,
  PRICE_DIFF_RATE,
  SAFETY_MARGIN_RATE,
  TOTAL_COST_RATE,
  FUNDING_SETTLEMENTS_PER_YEAR,
} from '@/lib/cost-constants';

describe('Cost Calculator', () => {
  describe('calculateTotalCost', () => {
    it('should return correct cost breakdown for default position size', () => {
      const costs = calculateTotalCost();

      expect(costs.tradingFees).toBe(100000 * TRADING_FEES_RATE);
      expect(costs.slippage).toBe(100000 * SLIPPAGE_RATE);
      expect(costs.priceDiff).toBe(100000 * PRICE_DIFF_RATE);
      expect(costs.safetyMargin).toBe(100000 * SAFETY_MARGIN_RATE);
      expect(costs.totalCost).toBe(100000 * TOTAL_COST_RATE);
    });

    it('should calculate costs proportionally to position size', () => {
      const positionSize = 50000;
      const costs = calculateTotalCost(positionSize);

      expect(costs.tradingFees).toBe(positionSize * TRADING_FEES_RATE);
      expect(costs.slippage).toBe(positionSize * SLIPPAGE_RATE);
      expect(costs.priceDiff).toBe(positionSize * PRICE_DIFF_RATE);
      expect(costs.safetyMargin).toBe(positionSize * SAFETY_MARGIN_RATE);
      expect(costs.totalCost).toBe(positionSize * TOTAL_COST_RATE);
    });

    it('should return zero costs for zero position size', () => {
      const costs = calculateTotalCost(0);

      expect(costs.tradingFees).toBe(0);
      expect(costs.slippage).toBe(0);
      expect(costs.priceDiff).toBe(0);
      expect(costs.safetyMargin).toBe(0);
      expect(costs.totalCost).toBe(0);
    });

    it('should have total cost equal to sum of components', () => {
      const costs = calculateTotalCost(100000);

      const expectedTotal =
        costs.tradingFees + costs.slippage + costs.priceDiff + costs.safetyMargin;
      expect(costs.totalCost).toBeCloseTo(expectedTotal, 10);
    });

    it('should handle large position sizes', () => {
      const positionSize = 1000000; // 1M USDT
      const costs = calculateTotalCost(positionSize);

      expect(costs.totalCost).toBeCloseTo(positionSize * TOTAL_COST_RATE, 10);
      expect(costs.totalCost).toBeCloseTo(5000, 10); // 0.5% of 1M
    });
  });

  describe('calculateNetProfit', () => {
    it('should return positive profit when funding rate exceeds costs', () => {
      const fundingRateDiff = 0.006; // 0.6%
      const positionSize = 100000;

      const netProfit = calculateNetProfit(fundingRateDiff, positionSize);

      // Gross: 0.6% * 100000 = 600
      // Cost: 0.5% * 100000 = 500
      // Net: 100
      expect(netProfit).toBeCloseTo(100, 10);
    });

    it('should return negative profit when funding rate is below costs', () => {
      const fundingRateDiff = 0.004; // 0.4%
      const positionSize = 100000;

      const netProfit = calculateNetProfit(fundingRateDiff, positionSize);

      // Gross: 0.4% * 100000 = 400
      // Cost: 0.5% * 100000 = 500
      // Net: -100
      expect(netProfit).toBeCloseTo(-100, 10);
    });

    it('should return zero profit at break-even rate', () => {
      const fundingRateDiff = TOTAL_COST_RATE; // 0.5%
      const positionSize = 100000;

      const netProfit = calculateNetProfit(fundingRateDiff, positionSize);

      expect(netProfit).toBeCloseTo(0, 10);
    });

    it('should use default position size when not provided', () => {
      const fundingRateDiff = 0.006;

      const netProfit = calculateNetProfit(fundingRateDiff);

      // Using default 100000, same as explicit call
      expect(netProfit).toBe(calculateNetProfit(fundingRateDiff, 100000));
    });

    it('should scale linearly with position size', () => {
      const fundingRateDiff = 0.007;
      const smallPosition = 50000;
      const largePosition = 100000;

      const smallProfit = calculateNetProfit(fundingRateDiff, smallPosition);
      const largeProfit = calculateNetProfit(fundingRateDiff, largePosition);

      expect(largeProfit).toBe(smallProfit * 2);
    });
  });

  describe('calculateNetProfitRate', () => {
    it('should return positive rate when funding exceeds costs', () => {
      const fundingRateDiff = 0.007; // 0.7%

      const netProfitRate = calculateNetProfitRate(fundingRateDiff);

      // 0.7% - 0.5% = 0.2%
      expect(netProfitRate).toBeCloseTo(0.002, 10);
    });

    it('should return negative rate when funding is below costs', () => {
      const fundingRateDiff = 0.003; // 0.3%

      const netProfitRate = calculateNetProfitRate(fundingRateDiff);

      // 0.3% - 0.5% = -0.2%
      expect(netProfitRate).toBeCloseTo(-0.002, 10);
    });

    it('should return zero at break-even rate', () => {
      const fundingRateDiff = TOTAL_COST_RATE;

      const netProfitRate = calculateNetProfitRate(fundingRateDiff);

      expect(netProfitRate).toBeCloseTo(0, 10);
    });

    it('should handle zero funding rate', () => {
      const netProfitRate = calculateNetProfitRate(0);

      expect(netProfitRate).toBe(-TOTAL_COST_RATE);
    });
  });

  describe('calculateNetAnnualizedReturn', () => {
    it('should calculate correct annualized return', () => {
      const fundingRateDiff = 0.006; // 0.6%

      const annualReturn = calculateNetAnnualizedReturn(fundingRateDiff);

      // Net profit rate: 0.1%
      // Annualized: 0.1% * 1095 = 109.5%
      const expectedReturn = (0.006 - TOTAL_COST_RATE) * FUNDING_SETTLEMENTS_PER_YEAR;
      expect(annualReturn).toBeCloseTo(expectedReturn, 10);
    });

    it('should return positive annualized return for profitable opportunity', () => {
      const fundingRateDiff = 0.007;

      const annualReturn = calculateNetAnnualizedReturn(fundingRateDiff);

      expect(annualReturn).toBeGreaterThan(0);
    });

    it('should return negative annualized return for unprofitable opportunity', () => {
      const fundingRateDiff = 0.003;

      const annualReturn = calculateNetAnnualizedReturn(fundingRateDiff);

      expect(annualReturn).toBeLessThan(0);
    });

    it('should return zero at break-even rate', () => {
      const fundingRateDiff = TOTAL_COST_RATE;

      const annualReturn = calculateNetAnnualizedReturn(fundingRateDiff);

      expect(annualReturn).toBeCloseTo(0, 10);
    });

    it('should scale with funding rate difference', () => {
      const rate1 = 0.006;
      const rate2 = 0.007;

      const return1 = calculateNetAnnualizedReturn(rate1);
      const return2 = calculateNetAnnualizedReturn(rate2);

      // 0.1% difference in rate = 109.5% difference in annual return
      const expectedDiff = 0.001 * FUNDING_SETTLEMENTS_PER_YEAR;
      expect(return2 - return1).toBeCloseTo(expectedDiff, 10);
    });
  });

  describe('isValidOpportunity', () => {
    it('should return true when funding rate exceeds break-even', () => {
      expect(isValidOpportunity(0.006)).toBe(true);
      expect(isValidOpportunity(0.007)).toBe(true);
      expect(isValidOpportunity(0.01)).toBe(true);
    });

    it('should return false when funding rate is below break-even', () => {
      expect(isValidOpportunity(0.004)).toBe(false);
      expect(isValidOpportunity(0.003)).toBe(false);
      expect(isValidOpportunity(0.001)).toBe(false);
    });

    it('should return false at exact break-even rate', () => {
      expect(isValidOpportunity(TOTAL_COST_RATE)).toBe(false);
    });

    it('should return false for zero funding rate', () => {
      expect(isValidOpportunity(0)).toBe(false);
    });

    it('should return false for negative funding rate', () => {
      expect(isValidOpportunity(-0.001)).toBe(false);
    });

    it('should return true just above break-even', () => {
      expect(isValidOpportunity(TOTAL_COST_RATE + 0.0001)).toBe(true);
    });
  });

  describe('getBreakEvenRate', () => {
    it('should return the total cost rate', () => {
      expect(getBreakEvenRate()).toBe(TOTAL_COST_RATE);
    });

    it('should match the threshold for isValidOpportunity', () => {
      const breakEven = getBreakEvenRate();

      expect(isValidOpportunity(breakEven)).toBe(false);
      expect(isValidOpportunity(breakEven + 0.0001)).toBe(true);
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal as percentage with default 2 decimals', () => {
      expect(formatPercentage(0.004)).toBe('0.40%');
      expect(formatPercentage(0.0055)).toBe('0.55%');
      expect(formatPercentage(0.01)).toBe('1.00%');
    });

    it('should format with custom decimal places', () => {
      expect(formatPercentage(0.00455, 3)).toBe('0.455%');
      expect(formatPercentage(0.00455, 1)).toBe('0.5%');
      expect(formatPercentage(0.00455, 0)).toBe('0%');
    });

    it('should handle zero value', () => {
      expect(formatPercentage(0)).toBe('0.00%');
    });

    it('should handle negative values', () => {
      expect(formatPercentage(-0.005)).toBe('-0.50%');
    });

    it('should handle large percentages', () => {
      expect(formatPercentage(1.5)).toBe('150.00%');
    });
  });

  describe('Cost Constants Validation', () => {
    it('should have TOTAL_COST_RATE equal to sum of components', () => {
      const expectedTotal =
        TRADING_FEES_RATE + SLIPPAGE_RATE + PRICE_DIFF_RATE + SAFETY_MARGIN_RATE;

      expect(TOTAL_COST_RATE).toBeCloseTo(expectedTotal, 10);
    });

    it('should have correct funding settlements per year', () => {
      // 3 settlements per day * 365 days
      expect(FUNDING_SETTLEMENTS_PER_YEAR).toBe(1095);
    });

    it('should have TOTAL_COST_RATE at 0.5%', () => {
      expect(TOTAL_COST_RATE).toBeCloseTo(0.005, 10);
    });
  });
});
