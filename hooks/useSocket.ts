'use client';

/**
 * Shared WebSocket Hook
 *
 * Provides a centralized socket.io connection for all components.
 * This is a singleton pattern - all components share the same socket instance.
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

// Singleton socket instance
let sharedSocket: Socket | null = null;
let connectionCount = 0;

interface UseSocketOptions {
  /** Enable automatic connection (default: true) */
  enabled?: boolean;
}

interface UseSocketReturn {
  /** The socket.io instance */
  socket: Socket | null;
  /** Whether the socket is currently connected */
  isConnected: boolean;
  /** Manually connect the socket */
  connect: () => void;
  /** Manually disconnect the socket */
  disconnect: () => void;
}

/**
 * useSocket - Shared WebSocket connection hook
 *
 * Uses a singleton pattern to share a single socket connection
 * across all components that use this hook.
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  // Get or create the shared socket
  const getSocket = useCallback(() => {
    if (!sharedSocket) {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';

      sharedSocket = io(wsUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }
    return sharedSocket;
  }, []);

  // Connect handler
  const connect = useCallback(() => {
    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }
  }, [getSocket]);

  // Disconnect handler
  const disconnect = useCallback(() => {
    if (sharedSocket && connectionCount <= 1) {
      sharedSocket.disconnect();
    }
  }, []);

  // Setup socket and event listeners
  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    connectionCount++;

    const socket = getSocket();

    const handleConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
      }
    };

    const handleDisconnect = () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Update initial state
    setIsConnected(socket.connected);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      mountedRef.current = false;
      connectionCount--;

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);

      // Only disconnect if this was the last user
      if (connectionCount === 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, [enabled, getSocket]);

  const result = useMemo(
    () => ({
      socket: enabled ? sharedSocket : null,
      isConnected,
      connect,
      disconnect,
    }),
    [enabled, isConnected, connect, disconnect]
  );

  return result;
}
