/**
 * useTableSort - 表格排序 Hook
 * 管理表格排序狀態和篩選邏輯
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import { useState, useCallback } from 'react';
import type { OpportunityStatus } from '../components/StatusBadge';

export type SortField = 'symbol' | 'spread' | 'annualizedReturn' | 'priceDiff' | 'netReturn';
export type SortDirection = 'asc' | 'desc';

interface UseTableSortReturn {
  /** 當前排序欄位 */
  sortBy: SortField;
  /** 當前排序方向 */
  sortDirection: SortDirection;
  /** 當前篩選狀態 */
  filterStatus: OpportunityStatus | 'all';
  /** 切換排序（點擊同一欄位時反轉方向）*/
  toggleSort: (field: SortField) => void;
  /** 設定篩選狀態 */
  setFilterStatus: (status: OpportunityStatus | 'all') => void;
  /** 重置為預設狀態 */
  reset: () => void;
}

// LocalStorage keys
const STORAGE_KEY_SORT_BY = 'market-monitor:sort-by';
const STORAGE_KEY_SORT_DIR = 'market-monitor:sort-direction';
const STORAGE_KEY_FILTER = 'market-monitor:filter-status';

// 預設值 (Feature 009: 改為字母順序)
const DEFAULT_SORT_BY: SortField = 'symbol';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';
const DEFAULT_FILTER_STATUS: OpportunityStatus | 'all' = 'all';

/**
 * useTableSort Hook
 * 管理表格排序和篩選狀態，並儲存到 localStorage
 */
export function useTableSort(): UseTableSortReturn {
  // 從 localStorage 讀取初始值
  const getInitialSortBy = (): SortField => {
    if (typeof window === 'undefined') return DEFAULT_SORT_BY;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT_BY);
      if (saved && ['symbol', 'spread', 'annualizedReturn', 'priceDiff', 'netReturn'].includes(saved)) {
        return saved as SortField;
      }
    } catch (err) {
      console.warn('[useTableSort] Failed to load sortBy from localStorage:', err);
    }
    return DEFAULT_SORT_BY;
  };

  const getInitialSortDirection = (): SortDirection => {
    if (typeof window === 'undefined') return DEFAULT_SORT_DIRECTION;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SORT_DIR);
      if (saved && ['asc', 'desc'].includes(saved)) {
        return saved as SortDirection;
      }
    } catch (err) {
      console.warn('[useTableSort] Failed to load sortDirection from localStorage:', err);
    }
    return DEFAULT_SORT_DIRECTION;
  };

  const getInitialFilterStatus = (): OpportunityStatus | 'all' => {
    if (typeof window === 'undefined') return DEFAULT_FILTER_STATUS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILTER);
      if (saved && ['all', 'opportunity', 'approaching', 'normal'].includes(saved)) {
        return saved as OpportunityStatus | 'all';
      }
    } catch (err) {
      console.warn('[useTableSort] Failed to load filterStatus from localStorage:', err);
    }
    return DEFAULT_FILTER_STATUS;
  };

  const [sortBy, setSortBy] = useState<SortField>(getInitialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(getInitialSortDirection);
  const [filterStatus, setFilterStatusState] = useState<OpportunityStatus | 'all'>(
    getInitialFilterStatus,
  );

  // 切換排序
  const toggleSort = useCallback(
    (field: SortField) => {
      if (field === sortBy) {
        // 點擊同一欄位，反轉排序方向
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(newDirection);
        try {
          localStorage.setItem(STORAGE_KEY_SORT_DIR, newDirection);
        } catch (err) {
          console.warn('[useTableSort] Failed to save sortDirection:', err);
        }
      } else {
        // 點擊不同欄位，設定新欄位並使用預設方向
        setSortBy(field);
        setSortDirection('desc');
        try {
          localStorage.setItem(STORAGE_KEY_SORT_BY, field);
          localStorage.setItem(STORAGE_KEY_SORT_DIR, 'desc');
        } catch (err) {
          console.warn('[useTableSort] Failed to save sort settings:', err);
        }
      }
    },
    [sortBy, sortDirection],
  );

  // 設定篩選狀態
  const setFilterStatus = useCallback((status: OpportunityStatus | 'all') => {
    setFilterStatusState(status);
    try {
      localStorage.setItem(STORAGE_KEY_FILTER, status);
    } catch (err) {
      console.warn('[useTableSort] Failed to save filterStatus:', err);
    }
  }, []);

  // 重置為預設狀態
  const reset = useCallback(() => {
    setSortBy(DEFAULT_SORT_BY);
    setSortDirection(DEFAULT_SORT_DIRECTION);
    setFilterStatusState(DEFAULT_FILTER_STATUS);
    try {
      localStorage.removeItem(STORAGE_KEY_SORT_BY);
      localStorage.removeItem(STORAGE_KEY_SORT_DIR);
      localStorage.removeItem(STORAGE_KEY_FILTER);
    } catch (err) {
      console.warn('[useTableSort] Failed to clear localStorage:', err);
    }
  }, []);

  return {
    sortBy,
    sortDirection,
    filterStatus,
    toggleSort,
    setFilterStatus,
    reset,
  };
}
