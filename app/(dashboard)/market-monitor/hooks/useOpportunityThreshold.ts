/**
 * useOpportunityThreshold - 年化收益門檻偏好 Hook
 *
 * 管理用戶設定的年化收益門檻，支援：
 * - localStorage 持久化
 * - 跨標籤頁同步
 * - SSR 相容性
 *
 * Feature 036: 可配置年化收益門檻
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOpportunityThresholdPreference,
  setOpportunityThresholdPreference,
  isLocalStorageAvailable,
  isValidThreshold,
  OPPORTUNITY_THRESHOLD_KEY,
  DEFAULT_OPPORTUNITY_THRESHOLD,
  MIN_THRESHOLD,
  MAX_THRESHOLD,
} from '../utils/preferences';
import { APPROACHING_THRESHOLD_RATIO } from '../utils/rateCalculations';

export interface UseOpportunityThresholdReturn {
  /** 當前門檻值（百分比） */
  threshold: number;
  /** 接近門檻值（主門檻的 75%） */
  approachingThreshold: number;
  /** 設定新的門檻值 */
  setThreshold: (value: number) => void;
  /** 重設為預設值 (800%) */
  resetToDefault: () => void;
  /** Hook 是否已就緒（已從 localStorage 載入） */
  isReady: boolean;
  /** localStorage 是否可用 */
  isStorageAvailable: boolean;
  /** 驗證門檻值是否有效 */
  validateThreshold: (value: number) => { valid: boolean; error?: string };
}

/**
 * 年化收益門檻偏好 Hook
 *
 * @returns 門檻狀態和操作函數
 *
 * @example
 * ```tsx
 * const { threshold, setThreshold, resetToDefault } = useOpportunityThreshold();
 *
 * // 設定新門檻
 * setThreshold(500);
 *
 * // 重設為預設值
 * resetToDefault();
 * ```
 */
export function useOpportunityThreshold(): UseOpportunityThresholdReturn {
  // 初始狀態使用預設值，避免 SSR hydration mismatch
  const [threshold, setThresholdState] = useState<number>(DEFAULT_OPPORTUNITY_THRESHOLD);
  const [isReady, setIsReady] = useState(false);
  const [isStorageAvailable, setIsStorageAvailable] = useState(true);

  // 計算接近門檻
  const approachingThreshold = threshold * APPROACHING_THRESHOLD_RATIO;

  // 初始化時從 localStorage 讀取
  useEffect(() => {
    const storageAvailable = isLocalStorageAvailable();
    setIsStorageAvailable(storageAvailable);

    if (storageAvailable) {
      const storedThreshold = getOpportunityThresholdPreference();
      setThresholdState(storedThreshold);
    }

    setIsReady(true);
  }, []);

  // 跨標籤頁同步 (Feature 036: User Story 3)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === OPPORTUNITY_THRESHOLD_KEY && event.newValue) {
        const newValue = parseInt(event.newValue, 10);
        if (isValidThreshold(newValue)) {
          setThresholdState(newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 設定門檻值
  const setThreshold = useCallback((value: number) => {
    if (!isValidThreshold(value)) {
      console.error('Invalid threshold value:', value);
      return;
    }

    setThresholdState(value);
    setOpportunityThresholdPreference(value);
  }, []);

  // 重設為預設值
  const resetToDefault = useCallback(() => {
    setThreshold(DEFAULT_OPPORTUNITY_THRESHOLD);
  }, [setThreshold]);

  // 驗證門檻值
  const validateThreshold = useCallback((value: number): { valid: boolean; error?: string } => {
    if (isNaN(value)) {
      return { valid: false, error: '請輸入有效的數字' };
    }
    if (value < MIN_THRESHOLD) {
      return { valid: false, error: `門檻值不能小於 ${MIN_THRESHOLD}%` };
    }
    if (value > MAX_THRESHOLD) {
      return { valid: false, error: `門檻值不能大於 ${MAX_THRESHOLD}%` };
    }
    return { valid: true };
  }, []);

  return {
    threshold,
    approachingThreshold,
    setThreshold,
    resetToDefault,
    isReady,
    isStorageAvailable,
    validateThreshold,
  };
}

// 導出常數供其他模組使用
export { DEFAULT_OPPORTUNITY_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD };
