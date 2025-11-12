/**
 * localStorage utilities with graceful degradation
 *
 * These functions handle localStorage operations safely, degrading gracefully
 * when localStorage is unavailable (e.g., private browsing mode, quota exceeded).
 */

/**
 * Check if localStorage is available
 *
 * @returns true if localStorage is available, false otherwise
 */
export function isLocalStorageAvailable(): boolean {
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
 * Save a value to localStorage with error handling
 *
 * @param key Storage key
 * @param value Value to store (will be converted to string)
 * @returns true if successful, false if failed
 */
export function saveToLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to save '${key}' to localStorage:`, error);
    // Feature continues to work, just doesn't persist
    return false;
  }
}

/**
 * Load a value from localStorage with error handling
 *
 * @param key Storage key
 * @param defaultValue Default value if key doesn't exist or load fails
 * @returns Stored value or default value
 */
export function loadFromLocalStorage(
  key: string,
  defaultValue: string
): string {
  try {
    const saved = localStorage.getItem(key);
    return saved ?? defaultValue;
  } catch (error) {
    console.warn(`Failed to load '${key}' from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Remove a value from localStorage with error handling
 *
 * @param key Storage key
 * @returns true if successful, false if failed
 */
export function removeFromLocalStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove '${key}' from localStorage:`, error);
    return false;
  }
}

/**
 * Clear all localStorage with error handling
 *
 * @returns true if successful, false if failed
 */
export function clearLocalStorage(): boolean {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Storage keys for market monitor preferences
 */
export const STORAGE_KEYS = {
  SORT_BY: 'market-monitor:sort-by',
  SORT_DIRECTION: 'market-monitor:sort-direction',
} as const;
