/**
 * useBatchMarkClosed Hook
 *
 * 管理批量標記已平倉操作的狀態和邏輯
 * 簡化版的 useBatchClose，不需要 WebSocket（純資料庫操作）
 */

'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export type BatchMarkClosedState =
  | 'idle'
  | 'confirming'
  | 'processing'
  | 'success'
  | 'error';

interface BatchMarkClosedResult {
  groupId: string;
  totalUpdated: number;
  updatedPositions: string[];
}

export function useBatchMarkClosed() {
  const [state, setState] = useState<BatchMarkClosedState>('idle');
  const [markingGroupId, setMarkingGroupId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchMarkClosedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const startMarkClosed = useCallback((groupId: string) => {
    setState('confirming');
    setMarkingGroupId(groupId);
    setError(null);
    setResult(null);
  }, []);

  const confirmMarkClosed = useCallback(async () => {
    if (!markingGroupId) return false;

    setState('processing');
    setError(null);

    try {
      const response = await fetch(`/api/positions/group/${markingGroupId}/mark-closed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || data.message || '標記已平倉失敗';
        setError(errorMessage);
        setState('error');
        return false;
      }

      setResult(data.data);
      setState('success');

      await queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trading.groupedPositions() });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '標記已平倉操作失敗';
      setError(errorMessage);
      setState('error');
      return false;
    }
  }, [markingGroupId, queryClient]);

  const cancelMarkClosed = useCallback(() => {
    setState('idle');
    setMarkingGroupId(null);
    setError(null);
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setMarkingGroupId(null);
    setError(null);
    setResult(null);
  }, []);

  return {
    state,
    markingGroupId,
    result,
    error,

    isIdle: state === 'idle',
    isConfirming: state === 'confirming',
    isProcessing: state === 'processing',
    isSuccess: state === 'success',
    isError: state === 'error',

    startMarkClosed,
    confirmMarkClosed,
    cancelMarkClosed,
    reset,
  };
}

export default useBatchMarkClosed;
