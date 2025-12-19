/**
 * useOpenPosition - 開倉邏輯 Hook
 *
 * Feature 033: Manual Open Position (T027-T030)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MarketRate } from '../types';

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
   * 打開開倉對話框
   */
  const openDialog = useCallback((rate: MarketRate) => {
    setSelectedRate(rate);
    setIsDialogOpen(true);
    setError(null);
    setIsLockConflict(false);
    setRequiresManualIntervention(false);
    setRollbackFailedDetails(null);

    // 從 bestPair 中提取交易所並獲取餘額
    if (rate.bestPair) {
      const exchanges = [rate.bestPair.longExchange, rate.bestPair.shortExchange];
      fetchBalances(exchanges);
    } else {
      console.warn('[useOpenPosition] No bestPair available for rate:', rate.symbol);
    }
  }, [fetchBalances]);

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
        // TODO: 顯示成功通知或導航到持倉頁面
        window.location.href = '/positions';
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
    refreshMarketData,
    isLockConflict,
    requiresManualIntervention,
    rollbackFailedDetails,
    clearRollbackFailed,
  };
}
