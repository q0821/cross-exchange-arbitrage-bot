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

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
}

/**
 * WebSocket Hook
 * 封裝 Socket.io 客戶端邏輯
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
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

  // 使用 ref 儲存回調函數，避免不必要的重新連線
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onConnect, onDisconnect, onError]);

  // 連線到 WebSocket 伺服器
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return; // 已經連線
    }

    console.log('[WebSocket] Attempting to connect to:', url);

    const socket = io(url, {
      withCredentials: true, // 包含 Cookie 認證（httpOnly cookies 會自動攜帶）
      transports: ['polling', 'websocket'], // 先用 polling（可以攜帶 cookie），再升級到 websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected to server');
      setIsConnected(true);
      setError(null);
      onConnectRef.current?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      onDisconnectRef.current?.();
    });

    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err);
      console.error('[WebSocket] Error details:', {
        message: err.message,
        type: err.constructor.name,
        stack: err.stack,
      });
      setError(err);
      setIsConnected(false);
      onErrorRef.current?.(err);
    });

    socket.on('error', (err) => {
      console.error('[WebSocket] Socket error:', err);
    });

    socketRef.current = socket;
  }, [url]);

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
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

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
