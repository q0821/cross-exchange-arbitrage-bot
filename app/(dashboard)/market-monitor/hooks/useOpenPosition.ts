/**
 * useOpenPosition - 開倉邏輯 Hook
 *
 * Feature 033: Manual Open Position (T027-T030)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { MarketRate } from '../types';
import { splitQuantity } from '@/lib/split-quantity';

export interface OpenPositionData {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  quantity: number;
  leverage: 1 | 2;
  // 停損停利參數 (Feature 038)
  stopLossEnabled: boolean;
  stopLossPercent?: number;
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
}

/** 費率穩定性警告資訊 */
export interface StabilityWarning {
  hasWarning: boolean;
  combinedWarning?: string;
  longExchange: {
    exchange: string;
    isStable: boolean;
    flipCount: number;
    warning?: string;
    supported: boolean;
  } | null;
  shortExchange: {
    exchange: string;
    isStable: boolean;
    flipCount: number;
    warning?: string;
    supported: boolean;
  } | null;
}

interface UseOpenPositionReturn {
  /** 當前選中的交易對 */
  selectedRate: MarketRate | null;
  /** 對話框是否開啟 */
  isDialogOpen: boolean;
  /** 是否正在執行開倉 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error: string | null;
  /** 用戶各交易所餘額 */
  balances: Record<string, number>;
  /** 是否正在載入餘額 */
  isLoadingBalances: boolean;
  /** 打開開倉對話框 */
  openDialog: (rate: MarketRate) => void;
  /** 關閉開倉對話框 */
  closeDialog: () => void;
  /** 執行開倉 */
  executeOpen: (data: OpenPositionData) => Promise<void>;
  /** 執行分單開倉 (Feature 060) */
  executeSplitOpen: (data: OpenPositionData, positionCount: number) => Promise<void>;
  /** 刷新市場數據 */
  refreshMarketData: () => Promise<void>;
  /** 是否發生鎖衝突 */
  isLockConflict: boolean;
  /** 是否需要手動處理 */
  requiresManualIntervention: boolean;
  /** 回滾失敗的詳情 */
  rollbackFailedDetails: {
    exchange: string;
    orderId: string;
    side: string;
    quantity: string;
  } | null;
  /** 清除回滾失敗狀態 */
  clearRollbackFailed: () => void;
  /** 分單開倉進度 - 當前組數 (Feature 060) */
  currentGroup: number;
  /** 分單開倉進度 - 總組數 (Feature 060) */
  totalGroups: number;
  /** 費率穩定性警告 (資金費率穩定性檢測功能) */
  stabilityWarning: StabilityWarning | null;
  /** 是否正在載入穩定性資訊 */
  isLoadingStability: boolean;
}

/**
 * 錯誤代碼對應的訊息
 */
const ERROR_MESSAGES: Record<string, string> = {
  LOCK_CONFLICT: '該交易對正在開倉中，請稍後再試',
  INSUFFICIENT_BALANCE: '餘額不足',
  ROLLBACK_FAILED: '開倉失敗，且自動回滾失敗，請手動處理',
  BILATERAL_OPEN_FAILED: '雙邊開倉都失敗',
  OPEN_FAILED_ROLLED_BACK: '開倉失敗，已自動回滾',
  API_KEY_NOT_FOUND: 'API Key 未設定',
  EXCHANGE_API_ERROR: '交易所 API 錯誤',
};

/**
 * useOpenPosition Hook
 * 管理開倉流程的狀態和邏輯
 */
export function useOpenPosition(): UseOpenPositionReturn {
  const [selectedRate, setSelectedRate] = useState<MarketRate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isLockConflict, setIsLockConflict] = useState(false);
  const [requiresManualIntervention, setRequiresManualIntervention] = useState(false);
  const [rollbackFailedDetails, setRollbackFailedDetails] = useState<{
    exchange: string;
    orderId: string;
    side: string;
    quantity: string;
  } | null>(null);

  // Feature 060: 分單開倉進度狀態
  const [currentGroup, setCurrentGroup] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);

  // 資金費率穩定性警告狀態
  const [stabilityWarning, setStabilityWarning] = useState<StabilityWarning | null>(null);
  const [isLoadingStability, setIsLoadingStability] = useState(false);

  // 用於取消請求的 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 獲取用戶餘額
   * @param exchanges 要查詢的交易所列表
   */
  const fetchBalances = useCallback(async (exchanges: string[]) => {
    if (exchanges.length === 0) {
      console.warn('[useOpenPosition] No exchanges provided for balance fetch');
      return;
    }

    setIsLoadingBalances(true);
    setError(null);

    try {
      const exchangeParam = exchanges.join(',');
      const response = await fetch(`/api/balances?exchanges=${exchangeParam}`);
      const data = await response.json();

      if (data.success && data.data?.balances) {
        // 將陣列格式轉換為物件格式 { exchange: balance }
        const balanceMap: Record<string, number> = {};
        for (const item of data.data.balances) {
          balanceMap[item.exchange] = item.available ?? 0;
        }
        setBalances(balanceMap);
      } else {
        console.error('[useOpenPosition] Failed to fetch balances:', data.error);
        setError('無法獲取餘額資訊');
      }
    } catch (err) {
      console.error('[useOpenPosition] Error fetching balances:', err);
      setError('獲取餘額時發生錯誤');
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  /**
   * 獲取資金費率穩定性
   * @param symbol 交易對
   * @param longExchange 做多交易所
   * @param shortExchange 做空交易所
   */
  const fetchStability = useCallback(
    async (symbol: string, longExchange: string, shortExchange: string) => {
      setIsLoadingStability(true);
      setStabilityWarning(null);

      try {
        const params = new URLSearchParams({
          symbol,
          longExchange,
          shortExchange,
        });

        const response = await fetch(`/api/funding-rate-stability?${params}`);
        const data = await response.json();

        if (data.success && data.data) {
          const result = data.data;
          setStabilityWarning({
            hasWarning: result.hasUnstableExchange,
            combinedWarning: result.combinedWarning,
            longExchange: result.longExchange
              ? {
                  exchange: result.longExchange.exchange,
                  isStable: result.longExchange.isStable,
                  flipCount: result.longExchange.flipCount,
                  warning: result.longExchange.warning,
                  supported: result.longExchange.supported,
                }
              : null,
            shortExchange: result.shortExchange
              ? {
                  exchange: result.shortExchange.exchange,
                  isStable: result.shortExchange.isStable,
                  flipCount: result.shortExchange.flipCount,
                  warning: result.shortExchange.warning,
                  supported: result.shortExchange.supported,
                }
              : null,
          });
        } else {
          console.warn('[useOpenPosition] Failed to fetch stability:', data.error);
          // 查詢失敗不阻止開倉，只是不顯示警告
          setStabilityWarning(null);
        }
      } catch (err) {
        console.error('[useOpenPosition] Error fetching stability:', err);
        // 錯誤不阻止開倉
        setStabilityWarning(null);
      } finally {
        setIsLoadingStability(false);
      }
    },
    []
  );

  /**
   * 打開開倉對話框
   */
  const openDialog = useCallback((rate: MarketRate) => {
    setSelectedRate(rate);
    setIsDialogOpen(true);
    setError(null);
    setIsLockConflict(false);
    setRequiresManualIntervention(false);
    setRollbackFailedDetails(null);
    setStabilityWarning(null);

    // 從 bestPair 中提取交易所並獲取餘額和穩定性
    if (rate.bestPair) {
      const exchanges = [rate.bestPair.longExchange, rate.bestPair.shortExchange];
      fetchBalances(exchanges);
      // 同時查詢費率穩定性
      fetchStability(rate.symbol, rate.bestPair.longExchange, rate.bestPair.shortExchange);
    } else {
      console.warn('[useOpenPosition] No bestPair available for rate:', rate.symbol);
    }
  }, [fetchBalances, fetchStability]);

  /**
   * 關閉開倉對話框
   */
  const closeDialog = useCallback(() => {
    // 取消進行中的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsDialogOpen(false);
    setSelectedRate(null);
    setError(null);
    setIsLoading(false);
    setIsLockConflict(false);
  }, []);

  /**
   * 執行開倉
   */
  const executeOpen = useCallback(async (data: OpenPositionData) => {
    // 取消之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 創建新的 AbortController
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setIsLockConflict(false);
    setRequiresManualIntervention(false);
    setRollbackFailedDetails(null);

    try {
      const response = await fetch('/api/positions/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 開倉成功
        console.log('[useOpenPosition] Position opened successfully:', result.data);
        closeDialog();

        // 顯示成功通知
        toast.success('開倉成功', {
          description: `${data.symbol} 已成功建立持倉`,
        });

        // 延遲跳轉讓用戶看到通知
        setTimeout(() => {
          window.location.href = '/positions';
        }, 1500);
      } else {
        // 處理錯誤
        const errorCode = result.error?.code || 'UNKNOWN_ERROR';
        const errorMessage = ERROR_MESSAGES[errorCode] || result.error?.message || '開倉失敗';

        // T029: 處理 409 衝突
        if (response.status === 409) {
          setIsLockConflict(true);
          setError('該交易對正在開倉中，請稍後再試');
          return;
        }

        // 處理回滾失敗
        if (result.error?.requiresManualIntervention) {
          setRequiresManualIntervention(true);
          if (result.error?.details) {
            setRollbackFailedDetails({
              exchange: result.error.details.exchange || '',
              orderId: result.error.details.orderId || '',
              side: result.error.details.side || '',
              quantity: result.error.details.quantity || '',
            });
          }
        }

        setError(errorMessage);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 請求被取消，不處理
        return;
      }
      console.error('[useOpenPosition] Error:', err);
      setError('開倉請求失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }, [closeDialog]);

  /**
   * 執行分單開倉 (Feature 060)
   * 將開倉數量分配到多個獨立持倉，串行執行
   *
   * @param data - 開倉數據
   * @param positionCount - 分組數量 (1-10)
   */
  const executeSplitOpen = useCallback(
    async (data: OpenPositionData, positionCount: number) => {
      // 如果只有 1 組，直接調用原有的 executeOpen
      if (positionCount <= 1) {
        return executeOpen(data);
      }

      // 計算每組數量
      const quantities = splitQuantity(data.quantity, positionCount);
      setTotalGroups(positionCount);
      setIsLoading(true);
      setError(null);

      // Feature 069: 生成共用 groupId 讓所有分組持倉可以合併顯示
      // 使用瀏覽器原生 crypto API（不能使用 Node.js 的 crypto 模組）
      const groupId = crypto.randomUUID();

      let completedCount = 0;
      let lastError: string | null = null;

      try {
        for (let i = 0; i < positionCount; i++) {
          setCurrentGroup(i + 1);

          // 創建這一組的開倉數據
          const groupQuantity = quantities[i];
          if (groupQuantity === undefined) {
            throw new Error(`Invalid quantity at index ${i}`);
          }
          const groupData = {
            ...data,
            quantity: groupQuantity,
            groupId, // Feature 069: 傳遞 groupId
          };

          // 執行單組開倉
          const response = await fetch('/api/positions/open', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(groupData),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            completedCount++;
            console.log(
              `[useOpenPosition] Split position ${i + 1}/${positionCount} opened successfully:`,
              result.data
            );
          } else {
            // 錯誤處理：停止後續開倉
            const errorCode = result.error?.code || 'UNKNOWN_ERROR';
            const errorMessage =
              ERROR_MESSAGES[errorCode] || result.error?.message || '開倉失敗';

            // Feature 060: 格式化錯誤訊息包含進度資訊
            if (completedCount > 0) {
              lastError = `已完成 ${completedCount}/${positionCount} 組，第 ${i + 1} 組失敗：${errorMessage}`;
            } else {
              lastError = `第 ${i + 1} 組開倉失敗：${errorMessage}`;
            }

            setError(lastError);
            console.error(
              `[useOpenPosition] Split position ${i + 1}/${positionCount} failed:`,
              errorMessage
            );
            break;
          }
        }

        // 如果全部成功
        if (completedCount === positionCount) {
          closeDialog();
          toast.success('分單開倉完成', {
            description: `${data.symbol} 已成功建立 ${positionCount} 個獨立持倉`,
          });

          // 延遲跳轉讓用戶看到通知
          setTimeout(() => {
            window.location.href = '/positions';
          }, 1500);
        } else if (completedCount > 0) {
          // 部分成功
          toast.warning('分單開倉部分完成', {
            description: `已建立 ${completedCount}/${positionCount} 個持倉，其餘失敗`,
          });
        }
      } catch (err) {
        console.error('[useOpenPosition] Split open error:', err);
        if (completedCount > 0) {
          setError(
            `已完成 ${completedCount}/${positionCount} 組，後續開倉發生網路錯誤`
          );
        } else {
          setError('分單開倉請求失敗，請稍後再試');
        }
      } finally {
        setIsLoading(false);
        setCurrentGroup(0);
        setTotalGroups(0);
      }
    },
    [executeOpen, closeDialog]
  );

  /**
   * 刷新市場數據
   */
  const refreshMarketData = useCallback(async () => {
    if (!selectedRate || !selectedRate.bestPair) return;

    try {
      // 從 bestPair 中取得交易所列表
      const exchanges = [
        selectedRate.bestPair.longExchange,
        selectedRate.bestPair.shortExchange,
      ].join(',');

      const response = await fetch(
        `/api/market-data/refresh?symbol=${selectedRate.symbol}&exchanges=${exchanges}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        // 更新 selectedRate 的價格和費率
        setSelectedRate((prev) => {
          if (!prev) return null;

          const updatedExchanges = { ...prev.exchanges };

          // API 回傳的 exchanges 是陣列格式
          // [{ exchange: "binance", price: 43500, fundingRate: 0.0001, ... }, ...]
          const exchangeDataArray = data.data.exchanges as Array<{
            exchange: string;
            price: number;
            fundingRate: number;
            status: string;
          }>;

          // 更新每個交易所的數據
          exchangeDataArray?.forEach((exchangeData) => {
            const exchangeName = exchangeData.exchange as keyof typeof updatedExchanges;
            if (updatedExchanges[exchangeName] && exchangeData.status === 'success') {
              updatedExchanges[exchangeName] = {
                ...updatedExchanges[exchangeName]!,
                price: exchangeData.price ?? updatedExchanges[exchangeName]!.price,
                rate: exchangeData.fundingRate ?? updatedExchanges[exchangeName]!.rate,
              };
            }
          });

          return {
            ...prev,
            exchanges: updatedExchanges,
            timestamp: new Date().toISOString(),
          };
        });
      }
    } catch (err) {
      console.error('[useOpenPosition] Failed to refresh market data:', err);
    }
  }, [selectedRate]);

  /**
   * 清除回滾失敗狀態
   */
  const clearRollbackFailed = useCallback(() => {
    setRequiresManualIntervention(false);
    setRollbackFailedDetails(null);
  }, []);

  // 組件卸載時取消請求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    selectedRate,
    isDialogOpen,
    isLoading,
    error,
    balances,
    isLoadingBalances,
    openDialog,
    closeDialog,
    executeOpen,
    executeSplitOpen,
    refreshMarketData,
    isLockConflict,
    requiresManualIntervention,
    rollbackFailedDetails,
    clearRollbackFailed,
    currentGroup,
    totalGroups,
    // 資金費率穩定性檢測功能
    stabilityWarning,
    isLoadingStability,
  };
}
