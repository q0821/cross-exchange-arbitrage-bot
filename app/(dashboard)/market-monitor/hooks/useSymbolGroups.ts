/**
 * useSymbolGroups - 交易對群組管理 Hook
 * 從 API 載入群組配置並管理用戶選擇
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SymbolGroup } from '../components/SymbolSelector';

interface UseSymbolGroupsReturn {
  /** 所有可用群組 */
  groups: SymbolGroup[];
  /** 當前選中的群組 ID */
  selectedGroup: string;
  /** 載入狀態 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error: Error | null;
  /** 設定選中的群組 */
  setSelectedGroup: (groupId: string) => void;
  /** 獲取當前選中群組的交易對列表 */
  getSelectedSymbols: () => string[];
}

// LocalStorage key
const STORAGE_KEY = 'market-monitor:selected-group';

/**
 * useSymbolGroups Hook
 * 管理交易對群組的載入、選擇和儲存
 */
export function useSymbolGroups(): UseSymbolGroupsReturn {
  const [groups, setGroups] = useState<SymbolGroup[]>([]);
  const [selectedGroup, setSelectedGroupState] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 從 localStorage 讀取用戶偏好
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedGroupState(saved);
      }
    } catch (err) {
      console.warn('[useSymbolGroups] Failed to load from localStorage:', err);
    }
  }, []);

  // 從 API 載入群組配置
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/symbol-groups');
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          // 新增 "全部" 選項
          // 計算所有唯一交易對的數量
          const allSymbols = new Set(
            data.data.groups.flatMap((g: SymbolGroup) => g.symbols)
          );
          const allGroup: SymbolGroup = {
            id: 'all',
            name: '全部交易對',
            symbolCount: allSymbols.size,
            symbols: [],
          };

          setGroups([allGroup, ...data.data.groups]);

          // 如果當前選中的群組不存在，切換到 "全部"
          const groupIds = ['all', ...data.data.groups.map((g: SymbolGroup) => g.id)];
          if (selectedGroup && !groupIds.includes(selectedGroup)) {
            setSelectedGroupState('all');
          }
        } else {
          throw new Error(data.error?.message || 'Failed to fetch groups');
        }
      } catch (err) {
        console.error('[useSymbolGroups] Failed to load groups:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    loadGroups();
  }, []); // 僅在掛載時執行一次

  // 設定選中的群組（並儲存到 localStorage）
  const setSelectedGroup = useCallback((groupId: string) => {
    setSelectedGroupState(groupId);
    try {
      localStorage.setItem(STORAGE_KEY, groupId);
    } catch (err) {
      console.warn('[useSymbolGroups] Failed to save to localStorage:', err);
    }
  }, []);

  // 獲取當前選中群組的交易對列表
  const getSelectedSymbols = useCallback((): string[] => {
    const group = groups.find((g) => g.id === selectedGroup);
    return group?.symbols || [];
  }, [groups, selectedGroup]);

  return {
    groups,
    selectedGroup,
    isLoading,
    error,
    setSelectedGroup,
    getSelectedSymbols,
  };
}
