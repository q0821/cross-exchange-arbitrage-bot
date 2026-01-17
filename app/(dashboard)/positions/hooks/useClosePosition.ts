/**
 * useClosePosition Hook
 *
 * 管理平倉操作的狀態和邏輯
 * Feature: 035-close-position (T009)
 * Feature: 035-close-position (T024) - WebSocket progress listener
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type {
  ClosePositionResponse,
  PartialCloseResponse,
  PositionMarketDataResponse,
  ClosePositionStep,
  TradePerformanceInfo,
  SupportedExchange,
  TradeSide,
} from '@/src/types/trading';

/**
 * WebSocket 事件類型
 */
interface CloseProgressEvent {
  positionId: string;
  step: ClosePositionStep;
  progress: number;
  message: string;
  exchange?: string;
}

interface CloseSuccessEvent {
  positionId: string;
  trade: TradePerformanceInfo;
  longClose: {
    exchange: string;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortClose: {
    exchange: string;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
}

interface CloseFailedEvent {
  positionId: string;
  error: string;
  errorCode: string;
  details?: {
    exchange?: string;
    originalError?: string;
  };
}

interface ClosePartialEvent {
  positionId: string;
  message: string;
  closedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    error: string;
    errorCode: string;
  };
}

/**
 * 平倉狀態
 */
export type ClosePositionState =
  | 'idle'
  | 'loading_market_data'
  | 'confirming'
  | 'closing'
  | 'success'
  | 'partial'
  | 'error';

/**
 * 平倉進度資訊
 */
export interface CloseProgress {
  step: ClosePositionStep;
  progress: number;
  message: string;
  exchange?: SupportedExchange;
}

/**
 * 平倉成功結果
 */
export interface CloseSuccessResult {
  trade: TradePerformanceInfo;
  longClose: {
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortClose: {
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
}

/**
 * 部分平倉結果
 */
export interface PartialCloseResult {
  closedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    error: string;
    errorCode: string;
  };
  message: string;
}

/**
 * 市場數據
 */
export interface MarketData {
  positionId: string;
  symbol: string;
  longExchange: {
    name: string;
    currentPrice: number;
    entryPrice: string;
    unrealizedPnL: number;
  };
  shortExchange: {
    name: string;
    currentPrice: number;
    entryPrice: string;
    unrealizedPnL: number;
  };
  estimatedPnL: {
    priceDiffPnL: number;
    fees: number;
    netPnL: number;
  };
  updatedAt: string;
}

/**
 * useClosePosition Hook
 */
export function useClosePosition() {
  // 狀態
  const [state, setState] = useState<ClosePositionState>('idle');
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [progress, setProgress] = useState<CloseProgress | null>(null);
  const [successResult, setSuccessResult] = useState<CloseSuccessResult | null>(null);
  const [partialResult, setPartialResult] = useState<PartialCloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 用於追蹤當前監聽的 positionId
  const currentPositionIdRef = useRef<string | null>(null);

  // WebSocket 連接
  const { isConnected, on, off, emit } = useWebSocket({
    autoConnect: true,
  });

  /**
   * 處理 WebSocket 進度事件
   */
  const handleProgressEvent = useCallback((event: CloseProgressEvent) => {
    if (event.positionId !== currentPositionIdRef.current) return;

    setProgress({
      step: event.step,
      progress: event.progress,
      message: event.message,
      exchange: event.exchange as SupportedExchange | undefined,
    });
  }, []);

  /**
   * 處理 WebSocket 成功事件
   */
  const handleSuccessEvent = useCallback((event: CloseSuccessEvent) => {
    if (event.positionId !== currentPositionIdRef.current) return;

    setSuccessResult({
      trade: event.trade,
      longClose: event.longClose,
      shortClose: event.shortClose,
    });
    setProgress({
      step: 'completing',
      progress: 100,
      message: '平倉完成',
    });
    setState('success');
  }, []);

  /**
   * 處理 WebSocket 失敗事件
   */
  const handleFailedEvent = useCallback((event: CloseFailedEvent) => {
    if (event.positionId !== currentPositionIdRef.current) return;

    setError(event.error);
    setState('error');
  }, []);

  /**
   * 處理 WebSocket 部分成功事件
   */
  const handlePartialEvent = useCallback((event: ClosePartialEvent) => {
    if (event.positionId !== currentPositionIdRef.current) return;

    setPartialResult({
      closedSide: {
        exchange: event.closedSide.exchange as SupportedExchange,
        side: event.closedSide.side,
        orderId: event.closedSide.orderId,
        price: event.closedSide.price,
        quantity: event.closedSide.quantity,
        fee: event.closedSide.fee,
      },
      failedSide: {
        exchange: event.failedSide.exchange as SupportedExchange,
        side: event.failedSide.side,
        error: event.failedSide.error,
        errorCode: event.failedSide.errorCode,
      },
      message: event.message,
    });
    setState('partial');
  }, []);

  /**
   * 設置 WebSocket 事件監聽
   */
  useEffect(() => {
    if (!isConnected) return;

    // 監聽平倉相關事件
    on('position:close:progress', handleProgressEvent);
    on('position:close:success', handleSuccessEvent);
    on('position:close:failed', handleFailedEvent);
    on('position:close:partial', handlePartialEvent);

    return () => {
      off('position:close:progress', handleProgressEvent);
      off('position:close:success', handleSuccessEvent);
      off('position:close:failed', handleFailedEvent);
      off('position:close:partial', handlePartialEvent);
    };
  }, [isConnected, on, off, handleProgressEvent, handleSuccessEvent, handleFailedEvent, handlePartialEvent]);

  /**
   * 加入 position room（開始監聽特定持倉的事件）
   */
  const joinPositionRoom = useCallback((positionId: string) => {
    if (!isConnected) return;
    currentPositionIdRef.current = positionId;
    emit('position:join', { positionId });
  }, [isConnected, emit]);

  /**
   * 離開 position room
   */
  const leavePositionRoom = useCallback((positionId: string) => {
    if (!isConnected) return;
    emit('position:leave', { positionId });
    if (currentPositionIdRef.current === positionId) {
      currentPositionIdRef.current = null;
    }
  }, [isConnected, emit]);

  /**
   * 獲取市場數據（用於確認對話框）
   */
  const fetchMarketData = useCallback(async (positionId: string): Promise<MarketData | null> => {
    setState('loading_market_data');
    setClosingPositionId(positionId);
    setError(null);

    try {
      const response = await fetch(`/api/positions/${positionId}/market-data`);
      const data: PositionMarketDataResponse = await response.json();

      if (data.success) {
        setMarketData(data.data);
        setState('confirming');
        return data.data;
      } else {
        throw new Error('無法獲取市場數據');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '獲取市場數據失敗';
      setError(errorMessage);
      setState('error');
      return null;
    }
  }, []);

  /**
   * 執行平倉
   */
  const closePosition = useCallback(async (positionId: string): Promise<boolean> => {
    setState('closing');
    setClosingPositionId(positionId);
    setProgress({
      step: 'validating',
      progress: 10,
      message: '驗證持倉狀態...',
    });
    setError(null);
    setSuccessResult(null);
    setPartialResult(null);

    try {
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.status === 200 && data.success) {
        // 平倉成功
        const successData = data as ClosePositionResponse;
        setSuccessResult({
          trade: successData.trade!,
          longClose: {
            orderId: '',
            price: successData.trade!.longExitPrice,
            quantity: successData.trade!.longPositionSize,
            fee: '0',
          },
          shortClose: {
            orderId: '',
            price: successData.trade!.shortExitPrice,
            quantity: successData.trade!.shortPositionSize,
            fee: '0',
          },
        });
        setProgress({
          step: 'completing',
          progress: 100,
          message: '平倉完成',
        });
        setState('success');
        return true;
      } else if (response.status === 207 && data.error === 'PARTIAL_CLOSE') {
        // 部分平倉
        const partialData = data as PartialCloseResponse;
        setPartialResult({
          closedSide: partialData.partialClosed,
          failedSide: {
            exchange: partialData.failedSide.exchange,
            side: partialData.partialClosed.side === 'LONG' ? 'SHORT' : 'LONG',
            error: partialData.failedSide.error,
            errorCode: partialData.failedSide.errorCode,
          },
          message: partialData.message,
        });
        setState('partial');
        return false;
      } else {
        // 平倉失敗
        throw new Error(data.message || data.error || '平倉失敗');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '平倉操作失敗';
      setError(errorMessage);
      setState('error');
      return false;
    }
  }, []);

  /**
   * 開始平倉流程（先獲取市場數據，再確認）
   */
  const startClose = useCallback(async (positionId: string) => {
    // 加入 WebSocket room 以接收進度更新
    joinPositionRoom(positionId);
    await fetchMarketData(positionId);
  }, [fetchMarketData, joinPositionRoom]);

  /**
   * 確認平倉（從確認對話框調用）
   */
  const confirmClose = useCallback(async () => {
    if (!closingPositionId) return false;
    const result = await closePosition(closingPositionId);
    // 平倉完成後離開 room
    if (result) {
      leavePositionRoom(closingPositionId);
    }
    return result;
  }, [closingPositionId, closePosition, leavePositionRoom]);

  /**
   * 取消平倉
   */
  const cancelClose = useCallback(() => {
    // 離開 WebSocket room
    if (closingPositionId) {
      leavePositionRoom(closingPositionId);
    }
    setState('idle');
    setClosingPositionId(null);
    setMarketData(null);
    setProgress(null);
    setError(null);
    setSuccessResult(null);
    setPartialResult(null);
  }, [closingPositionId, leavePositionRoom]);

  /**
   * 重置狀態
   */
  const reset = useCallback(() => {
    // 離開 WebSocket room
    if (closingPositionId) {
      leavePositionRoom(closingPositionId);
    }
    setState('idle');
    setClosingPositionId(null);
    setMarketData(null);
    setProgress(null);
    setError(null);
    setSuccessResult(null);
    setPartialResult(null);
  }, [closingPositionId, leavePositionRoom]);

  return {
    // 狀態
    state,
    closingPositionId,
    marketData,
    progress,
    successResult,
    partialResult,
    error,

    // 計算屬性
    isLoading: state === 'loading_market_data' || state === 'closing',
    isConfirming: state === 'confirming',
    isSuccess: state === 'success',
    isPartial: state === 'partial',
    isError: state === 'error',

    // 方法
    startClose,
    confirmClose,
    cancelClose,
    closePosition,
    fetchMarketData,
    reset,
  };
}

export default useClosePosition;
