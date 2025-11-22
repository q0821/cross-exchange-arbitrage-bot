/**
 * Unit tests for config threshold reading
 *
 * Feature 022: 年化收益門檻套利機會偵測
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the constants module before importing config
vi.mock('../../../src/lib/constants', () => ({
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED: 800,
  APPROACHING_THRESHOLD_RATIO: 0.75,
  ENV_OPPORTUNITY_THRESHOLD_ANNUALIZED: 'OPPORTUNITY_THRESHOLD_ANNUALIZED',
}));

describe('config - getOpportunityThresholdAnnualized', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear the specific env var
    delete process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED;
    // Reset module cache to reload config with new env
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.resetModules();
  });

  it('should return default value when env var is not set', async () => {
    delete process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED;

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(800);
  });

  it('should return custom value when env var is set', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = '500';

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(500);
  });

  it('should return default when env var is not a number', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = 'invalid';

    // Capture console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(800);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not a number')
    );

    warnSpy.mockRestore();
  });

  it('should return default when env var is negative', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = '-100';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(800);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('negative'));

    warnSpy.mockRestore();
  });

  it('should handle zero as valid threshold', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = '0';

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(0);
  });

  it('should handle very high threshold', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = '10000';

    const { getOpportunityThresholdAnnualized } = await import(
      '../../../src/lib/config'
    );
    const result = getOpportunityThresholdAnnualized();

    expect(result).toBe(10000);
  });
});

describe('config - getApproachingThreshold', () => {
  it('should calculate approaching threshold as 75% of main threshold', async () => {
    const { getApproachingThreshold } = await import('../../../src/lib/config');

    expect(getApproachingThreshold(800)).toBe(600);
    expect(getApproachingThreshold(1000)).toBe(750);
    expect(getApproachingThreshold(500)).toBe(375);
  });
});

describe('config - getOpportunityThresholds', () => {
  beforeEach(() => {
    delete process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return both thresholds with default values', async () => {
    const { getOpportunityThresholds } = await import('../../../src/lib/config');
    const thresholds = getOpportunityThresholds();

    expect(thresholds.opportunity).toBe(800);
    expect(thresholds.approaching).toBe(600);
  });

  it('should return both thresholds with custom opportunity value', async () => {
    process.env.OPPORTUNITY_THRESHOLD_ANNUALIZED = '1000';

    const { getOpportunityThresholds } = await import('../../../src/lib/config');
    const thresholds = getOpportunityThresholds();

    expect(thresholds.opportunity).toBe(1000);
    expect(thresholds.approaching).toBe(750);
  });
});
