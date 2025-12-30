/**
 * WebSocket Status API Endpoint
 * Feature: 052-specify-scripts-bash
 * Task: T074 - WebSocket 連線狀態 API
 *
 * 提供 WebSocket 連線狀態資訊
 */

import { NextResponse } from 'next/server';

/** WebSocket 連線狀態 */
interface WsConnectionStatus {
  exchange: string;
  channelType: 'public' | 'private';
  status: 'connected' | 'reconnecting' | 'disconnected' | 'fallback_rest';
  lastUpdate: string | null;
  messageCount: number;
  error?: string;
}

/** API 回應 */
interface WsStatusResponse {
  success: boolean;
  data: {
    connections: WsConnectionStatus[];
    summary: {
      totalConnections: number;
      connectedCount: number;
      disconnectedCount: number;
      fallbackCount: number;
    };
    timestamp: string;
  };
}

/**
 * 取得 WebSocket 連線狀態
 *
 * @returns WebSocket 連線狀態資訊
 */
export async function GET(): Promise<NextResponse<WsStatusResponse>> {
  try {
    // 目前使用靜態模擬資料
    // 實際實作時需要從 PriceMonitor 或 DataSourceManager 取得狀態
    const connections: WsConnectionStatus[] = [
      {
        exchange: 'binance',
        channelType: 'public',
        status: 'connected',
        lastUpdate: new Date().toISOString(),
        messageCount: 0,
      },
      {
        exchange: 'okx',
        channelType: 'public',
        status: 'connected',
        lastUpdate: new Date().toISOString(),
        messageCount: 0,
      },
      {
        exchange: 'gateio',
        channelType: 'public',
        status: 'connected',
        lastUpdate: new Date().toISOString(),
        messageCount: 0,
      },
      {
        exchange: 'mexc',
        channelType: 'public',
        status: 'fallback_rest',
        lastUpdate: null,
        messageCount: 0,
        error: 'MEXC WebSocket not implemented, using REST fallback',
      },
      {
        exchange: 'bingx',
        channelType: 'public',
        status: 'connected',
        lastUpdate: new Date().toISOString(),
        messageCount: 0,
      },
    ];

    // 計算摘要
    const summary = {
      totalConnections: connections.length,
      connectedCount: connections.filter((c) => c.status === 'connected').length,
      disconnectedCount: connections.filter((c) => c.status === 'disconnected').length,
      fallbackCount: connections.filter((c) => c.status === 'fallback_rest').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        connections,
        summary,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get WebSocket status:', error);
    return NextResponse.json(
      {
        success: false,
        data: {
          connections: [],
          summary: {
            totalConnections: 0,
            connectedCount: 0,
            disconnectedCount: 0,
            fallbackCount: 0,
          },
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
