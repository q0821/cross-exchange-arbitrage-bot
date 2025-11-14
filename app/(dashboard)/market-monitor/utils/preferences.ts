/**
 * User Preferences Utilities
 *
 * Manages user preferences for market monitor with localStorage persistence.
 *
 * Feature: 012-specify-scripts-bash (User Story 1)
 */

export type TimeBasis = 1 | 8 | 24;

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
    if ([1, 8, 24].includes(parsed)) {
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
    if (![1, 8, 24].includes(timeBasis)) {
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
