/**
 * useBalanceSocket Hook
 * Feature: 052-specify-scripts-bash
 * Task: T073 - 資產總覽頁面接收即時餘額更新
 *
 * 透過 WebSocket 接收即時餘額更新
 */

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/** 餘額更新資料 */
export interface BalanceUpdate {
  exchange: string;
  asset: string;
  balance: string;
  change: string;
  timestamp: string;
}

/** 餘額快照資料 */
export interface BalanceSnapshot {
  balances: Record<string, Record<string, string>>;
  timestamp: string;
}

/** Hook 配置選項 */
interface UseBalanceSocketOptions {
  /** 是否啟用連線 */
  enabled?: boolean;
  /** 餘額更新回調 */
  onBalanceUpdate?: (data: BalanceUpdate) => void;
  /** 餘額快照回調 */
  onBalanceSnapshot?: (data: BalanceSnapshot) => void;
  /** 連線狀態變更回調 */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * 餘額 WebSocket Hook
 * 用於訂閱即時餘額更新
 */
export function useBalanceSocket(options: UseBalanceSocketOptions = {}) {
  const {
    enabled = true,
    onBalanceUpdate,
    onBalanceSnapshot,
    onConnectionChange,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  // 連接 WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    // 從環境變數取得 WebSocket URL，預設使用相對路徑
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';

    const socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 連線事件
    socket.on('connect', () => {
      isConnectedRef.current = true;
      onConnectionChange?.(true);
    });

    // 斷線事件
    socket.on('disconnect', () => {
      isConnectedRef.current = false;
      onConnectionChange?.(false);
    });

    // 連線錯誤 - 靜默處理，由重連機制自動恢復
    socket.on('connect_error', () => {
      // 連線錯誤會觸發自動重連
    });

    // 餘額更新事件
    socket.on('balance:update', (data: BalanceUpdate) => {
      onBalanceUpdate?.(data);
    });

    // 餘額快照事件
    socket.on('balance:snapshot', (data: BalanceSnapshot) => {
      onBalanceSnapshot?.(data);
    });

    socketRef.current = socket;
  }, [onBalanceUpdate, onBalanceSnapshot, onConnectionChange]);

  // 斷開連線
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    }
  }, []);

  // 根據 enabled 狀態管理連線
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
  };
}

export default useBalanceSocket;
