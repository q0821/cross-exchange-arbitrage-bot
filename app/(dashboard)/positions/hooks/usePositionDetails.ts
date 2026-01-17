/**
 * usePositionDetails Hook
 *
 * 查詢持倉詳情的自定義 Hook
 * Feature: 045-position-details-view
 */

'use client';

import { useState, useCallback } from 'react';
import type { PositionDetailsInfo, PositionDetailsResponse } from '@/src/types/trading';

interface UsePositionDetailsReturn {
  details: PositionDetailsInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchDetails: (positionId: string) => Promise<void>;
  reset: () => void;
}

/**
 * 持倉詳情查詢 Hook
 */
export function usePositionDetails(): UsePositionDetailsReturn {
  const [details, setDetails] = useState<PositionDetailsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async (positionId: string) => {
    // 避免重複查詢（如果已經有相同 positionId 的資料）
    if (details?.positionId === positionId && !error) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/positions/${positionId}/details`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: PositionDetailsResponse = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      if (data.data) {
        setDetails(data.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查詢失敗';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [details, error]);

  const reset = useCallback(() => {
    setDetails(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    details,
    isLoading,
    error,
    fetchDetails,
    reset,
  };
}
