'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  /**
   * WebSocket 伺服器 URL
   * 預設使用環境變數 NEXT_PUBLIC_WS_URL
   */
  url?: string;

  /**
   * 是否自動連線
   * 預設為 true
   */
  autoConnect?: boolean;

  /**
   * 連線成功回調
   */
  onConnect?: () => void;

  /**
   * 斷線回調
   */
  onDisconnect?: () => void;

  /**
   * 錯誤回調
   */
  onError?: (error: Error) => void;
}

/**
 * WebSocket Hook
 * 封裝 Socket.io 客戶端邏輯
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000',
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 連線到 WebSocket 伺服器
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return; // 已經連線
    }

    const socket = io(url, {
      withCredentials: true, // 包含 Cookie 認證
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected to server');
      setIsConnected(true);
      setError(null);
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err);
      setError(err);
      setIsConnected(false);
      onError?.(err);
    });

    socketRef.current = socket;
  }, [url, onConnect, onDisconnect, onError]);

  // 斷開連線
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // 訂閱事件
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) {
      console.warn('[WebSocket] Socket not initialized');
      return;
    }

    socketRef.current.on(event, handler);
  }, []);

  // 取消訂閱事件
  const off = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) {
      return;
    }

    socketRef.current.off(event, handler);
  }, []);

  // 發送事件
  const emit = useCallback((event: string, ...args: any[]) => {
    if (!socketRef.current) {
      console.warn('[WebSocket] Socket not initialized');
      return;
    }

    socketRef.current.emit(event, ...args);
  }, []);

  // 自動連線和清理
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    on,
    off,
    emit,
  };
}
