/**
 * User Preferences Utilities
 *
 * Manages user preferences for market monitor with localStorage persistence.
 *
 * Feature: 012-specify-scripts-bash (User Story 1)
 */

export type TimeBasis = 1 | 4 | 8 | 24;

const TIME_BASIS_KEY = 'market-monitor-time-basis';
const DEFAULT_TIME_BASIS: TimeBasis = 8;

/**
 * Get time basis preference from localStorage
 */
export function getTimeBasisPreference(): TimeBasis {
  if (typeof window === 'undefined') {
    return DEFAULT_TIME_BASIS;
  }

  try {
    const stored = localStorage.getItem(TIME_BASIS_KEY);
    if (!stored) {
      return DEFAULT_TIME_BASIS;
    }

    const parsed = parseInt(stored, 10);
    if ([1, 4, 8, 24].includes(parsed)) {
      return parsed as TimeBasis;
    }

    // Invalid value, reset to default
    setTimeBasisPreference(DEFAULT_TIME_BASIS);
    return DEFAULT_TIME_BASIS;
  } catch (error) {
    console.error('Failed to load time basis preference:', error);
    return DEFAULT_TIME_BASIS;
  }
}

/**
 * Save time basis preference to localStorage
 */
export function setTimeBasisPreference(timeBasis: TimeBasis): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Validate input
    if (![1, 4, 8, 24].includes(timeBasis)) {
      console.error('Invalid time basis:', timeBasis);
      return;
    }

    localStorage.setItem(TIME_BASIS_KEY, timeBasis.toString());
  } catch (error) {
    console.error('Failed to save time basis preference:', error);
  }
}

/**
 * Clear time basis preference (reset to default)
 */
export function clearTimeBasisPreference(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(TIME_BASIS_KEY);
  } catch (error) {
    console.error('Failed to clear time basis preference:', error);
  }
}

// ============================================================================
// Opportunity Threshold Preferences (Feature 036)
// ============================================================================

export const OPPORTUNITY_THRESHOLD_KEY = 'market-monitor-opportunity-threshold';
export const DEFAULT_OPPORTUNITY_THRESHOLD = 800;
export const MIN_THRESHOLD = 1;
export const MAX_THRESHOLD = 10000;

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate threshold value is within allowed range
 */
export function isValidThreshold(value: number): boolean {
  return !isNaN(value) && value >= MIN_THRESHOLD && value <= MAX_THRESHOLD;
}

/**
 * Get opportunity threshold preference from localStorage
 * Returns default value (800) if not set or invalid
 */
export function getOpportunityThresholdPreference(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_OPPORTUNITY_THRESHOLD;
  }

  try {
    const stored = localStorage.getItem(OPPORTUNITY_THRESHOLD_KEY);
    if (!stored) {
      return DEFAULT_OPPORTUNITY_THRESHOLD;
    }

    const parsed = parseInt(stored, 10);
    if (isValidThreshold(parsed)) {
      return parsed;
    }

    // Invalid value, reset to default
    setOpportunityThresholdPreference(DEFAULT_OPPORTUNITY_THRESHOLD);
    return DEFAULT_OPPORTUNITY_THRESHOLD;
  } catch (error) {
    console.error('Failed to load opportunity threshold preference:', error);
    return DEFAULT_OPPORTUNITY_THRESHOLD;
  }
}

/**
 * Save opportunity threshold preference to localStorage
 */
export function setOpportunityThresholdPreference(threshold: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!isValidThreshold(threshold)) {
      console.error('Invalid threshold value:', threshold);
      return;
    }

    localStorage.setItem(OPPORTUNITY_THRESHOLD_KEY, threshold.toString());
  } catch (error) {
    console.error('Failed to save opportunity threshold preference:', error);
  }
}

/**
 * Clear opportunity threshold preference (reset to default)
 */
export function clearOpportunityThresholdPreference(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(OPPORTUNITY_THRESHOLD_KEY);
  } catch (error) {
    console.error('Failed to clear opportunity threshold preference:', error);
  }
}
