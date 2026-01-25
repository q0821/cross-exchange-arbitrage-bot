/**
 * useBatchClose Hook
 *
 * 管理批量平倉操作的狀態和邏輯
 * Feature: 069-position-group-close (T025)
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { queryKeys } from '@/lib/query-keys';

/**
 * 批量平倉 API 回應類型
 */
interface BatchCloseResponse {
  success: boolean;
  groupId: string;
  totalPositions: number;
  closedPositions: number;
  failedPositions: number;
  results: Array<{
    positionId: string;
    success: boolean;
    error?: string;
  }>;
  message: string;
}

/**
 * WebSocket 事件類型
 */
interface BatchCloseProgressEvent {
  groupId: string;
  current: number;
  total: number;
  positionId: string;
  progress: number;
  message: string;
}

interface BatchClosePositionCompleteEvent {
  groupId: string;
  positionId: string;
  success: boolean;
  error?: string;
  current?: number;
  total?: number;
}

interface BatchCloseCompleteEvent {
  groupId: string;
  success: boolean;
  totalPositions: number;
  closedPositions: number;
  failedPositions: number;
  results: Array<{ positionId: string; success: boolean; error?: string }>;
  message: string;
}

interface BatchCloseFailedEvent {
  groupId: string;
  error: string;
  errorCode: string;
  message: string;
}

/**
 * 批量平倉狀態
 */
export type BatchCloseState =
  | 'idle'
  | 'confirming'
  | 'closing'
  | 'success'
  | 'partial'
  | 'error';

/**
 * 批量平倉進度資訊
 */
export interface BatchCloseProgress {
  current: number;
  total: number;
  progress: number;
  currentPositionId: string;
  message: string;
}

/**
 * 批量平倉結果
 */
export interface BatchCloseResult {
  success: boolean;
  totalPositions: number;
  closedPositions: number;
  failedPositions: number;
  results: Array<{
    positionId: string;
    success: boolean;
    error?: string;
  }>;
  message: string;
}

/**
 * useBatchClose Hook
 */
export function useBatchClose() {
  // 狀態
  const [state, setState] = useState<BatchCloseState>('idle');
  const [closingGroupId, setClosingGroupId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchCloseProgress | null>(null);
  const [result, setResult] = useState<BatchCloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 用於追蹤當前監聽的 groupId
  const currentGroupIdRef = useRef<string | null>(null);

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // WebSocket 連接
  const { isConnected, on, off, emit } = useWebSocket({
    autoConnect: true,
  });

  /**
   * 處理 WebSocket 進度事件
   */
  const handleProgressEvent = useCallback((event: BatchCloseProgressEvent) => {
    if (event.groupId !== currentGroupIdRef.current) return;

    setProgress({
      current: event.current,
      total: event.total,
      progress: event.progress,
      currentPositionId: event.positionId,
      message: event.message,
    });
  }, []);

  /**
   * 處理 WebSocket 單個持倉完成事件
   */
  const handlePositionCompleteEvent = useCallback((event: BatchClosePositionCompleteEvent) => {
    if (event.groupId !== currentGroupIdRef.current) return;

    // 更新進度（如果有 current/total）
    if (event.current !== undefined && event.total !== undefined) {
      setProgress(() => ({
        current: event.current!,
        total: event.total!,
        progress: Math.round((event.current! / event.total!) * 100),
        currentPositionId: event.positionId,
        message: event.success
          ? `持倉 ${event.positionId.slice(0, 8)} 已平倉`
          : `持倉 ${event.positionId.slice(0, 8)} 平倉失敗`,
      }));
    }
  }, []);

  /**
   * 處理 WebSocket 完成事件
   */
  const handleCompleteEvent = useCallback((event: BatchCloseCompleteEvent) => {
    if (event.groupId !== currentGroupIdRef.current) return;

    setResult({
      success: event.success,
      totalPositions: event.totalPositions,
      closedPositions: event.closedPositions,
      failedPositions: event.failedPositions,
      results: event.results,
      message: event.message,
    });

    setProgress({
      current: event.totalPositions,
      total: event.totalPositions,
      progress: 100,
      currentPositionId: '',
      message: event.message,
    });

    setState(event.success ? 'success' : 'partial');

    // 刷新持倉列表緩存
    queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
    queryClient.invalidateQueries({ queryKey: queryKeys.trading.groupedPositions() });
  }, [queryClient]);

  /**
   * 處理 WebSocket 失敗事件
   */
  const handleFailedEvent = useCallback((event: BatchCloseFailedEvent) => {
    if (event.groupId !== currentGroupIdRef.current) return;

    setError(event.message);
    setState('error');
  }, []);

  /**
   * 設置 WebSocket 事件監聯
   */
  useEffect(() => {
    if (!isConnected) return;

    // 監聽批量平倉相關事件
    on('batch:close:progress', handleProgressEvent);
    on('batch:close:position:complete', handlePositionCompleteEvent);
    on('batch:close:complete', handleCompleteEvent);
    on('batch:close:failed', handleFailedEvent);

    return () => {
      off('batch:close:progress', handleProgressEvent);
      off('batch:close:position:complete', handlePositionCompleteEvent);
      off('batch:close:complete', handleCompleteEvent);
      off('batch:close:failed', handleFailedEvent);
    };
  }, [
    isConnected,
    on,
    off,
    handleProgressEvent,
    handlePositionCompleteEvent,
    handleCompleteEvent,
    handleFailedEvent,
  ]);

  /**
   * 加入批量平倉房間
   */
  const joinBatchCloseRoom = useCallback((groupId: string) => {
    if (!isConnected) return;
    currentGroupIdRef.current = groupId;
    emit('batch:join', { groupId });
  }, [isConnected, emit]);

  /**
   * 離開批量平倉房間
   */
  const leaveBatchCloseRoom = useCallback((groupId: string) => {
    if (!isConnected) return;
    emit('batch:leave', { groupId });
    if (currentGroupIdRef.current === groupId) {
      currentGroupIdRef.current = null;
    }
  }, [isConnected, emit]);

  /**
   * 開始批量平倉確認流程
   */
  const startBatchClose = useCallback((groupId: string) => {
    setState('confirming');
    setClosingGroupId(groupId);
    setError(null);
    setResult(null);
    setProgress(null);
  }, []);

  /**
   * 執行批量平倉
   */
  const executeBatchClose = useCallback(async (groupId: string): Promise<boolean> => {
    setState('closing');
    setClosingGroupId(groupId);
    setProgress({
      current: 0,
      total: 0,
      progress: 0,
      currentPositionId: '',
      message: '正在準備批量平倉...',
    });
    setError(null);
    setResult(null);

    // 加入 WebSocket room 以接收進度更新
    joinBatchCloseRoom(groupId);

    try {
      const response = await fetch(`/api/positions/group/${groupId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: BatchCloseResponse = await response.json();

      // 設置結果
      setResult({
        success: data.success,
        totalPositions: data.totalPositions,
        closedPositions: data.closedPositions,
        failedPositions: data.failedPositions,
        results: data.results,
        message: data.message,
      });

      // 設置最終進度
      setProgress({
        current: data.totalPositions,
        total: data.totalPositions,
        progress: 100,
        currentPositionId: '',
        message: data.message,
      });

      // 刷新持倉列表緩存
      await queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trading.groupedPositions() });

      if (response.status === 200) {
        // 全部成功或空操作
        setState('success');
        return true;
      } else if (response.status === 207) {
        // 部分成功
        setState('partial');
        return false;
      } else {
        // 全部失敗
        setError(data.message || '批量平倉失敗');
        setState('error');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量平倉操作失敗';
      setError(errorMessage);
      setState('error');
      return false;
    } finally {
      // 離開 WebSocket room
      leaveBatchCloseRoom(groupId);
    }
  }, [joinBatchCloseRoom, leaveBatchCloseRoom, queryClient]);

  /**
   * 確認並執行批量平倉
   */
  const confirmBatchClose = useCallback(async () => {
    if (!closingGroupId) return false;
    return executeBatchClose(closingGroupId);
  }, [closingGroupId, executeBatchClose]);

  /**
   * 取消批量平倉
   */
  const cancelBatchClose = useCallback(() => {
    if (closingGroupId) {
      leaveBatchCloseRoom(closingGroupId);
    }
    setState('idle');
    setClosingGroupId(null);
    setProgress(null);
    setError(null);
    setResult(null);
  }, [closingGroupId, leaveBatchCloseRoom]);

  /**
   * 重置狀態
   */
  const reset = useCallback(() => {
    if (closingGroupId) {
      leaveBatchCloseRoom(closingGroupId);
    }
    setState('idle');
    setClosingGroupId(null);
    setProgress(null);
    setError(null);
    setResult(null);
  }, [closingGroupId, leaveBatchCloseRoom]);

  return {
    // 狀態
    state,
    closingGroupId,
    progress,
    result,
    error,

    // 計算屬性
    isIdle: state === 'idle',
    isConfirming: state === 'confirming',
    isClosing: state === 'closing',
    isSuccess: state === 'success',
    isPartial: state === 'partial',
    isError: state === 'error',
    isLoading: state === 'closing',

    // 方法
    startBatchClose,
    confirmBatchClose,
    cancelBatchClose,
    executeBatchClose,
    reset,
  };
}

export default useBatchClose;
