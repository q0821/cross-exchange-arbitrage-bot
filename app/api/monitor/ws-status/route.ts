/**
 * WebSocket Status API Endpoint
 * Feature: 052-specify-scripts-bash
 * Task: T074 - WebSocket 連線狀態 API
 *
 * 提供 WebSocket 連線狀態資訊
 * 整合 DataSourceManager 提供真實的連線狀態
 */

import { NextResponse } from 'next/server';
import { DataSourceManager } from '@/services/monitor/DataSourceManager';
import type { DataSourceState, DataSourceHealthCheck } from '@/types/data-source';

/** WebSocket 連線狀態 */
interface WsConnectionStatus {
  exchange: string;
  dataType: string;
  status: 'connected' | 'reconnecting' | 'disconnected' | 'fallback_rest';
  mode: 'websocket' | 'rest' | 'hybrid';
  lastUpdate: string | null;
  latency: number | null;
  health: 'optimal' | 'degraded' | 'fallback';
  isStale: boolean;
}

/** API 回應 */
interface WsStatusResponse {
  success: boolean;
  data: {
    connections: WsConnectionStatus[];
    summary: {
      totalConnections: number;
      websocketCount: number;
      restCount: number;
      hybridCount: number;
      optimalCount: number;
      degradedCount: number;
      fallbackCount: number;
    };
    timestamp: string;
  };
}

/**
 * 將 DataSourceState 和 HealthCheck 轉換為 WsConnectionStatus
 */
function mapToConnectionStatus(
  state: DataSourceState,
  healthCheck: DataSourceHealthCheck
): WsConnectionStatus {
  // 根據模式和可用性判斷連線狀態
  let status: WsConnectionStatus['status'];

  if (state.mode === 'websocket' && state.websocketAvailable) {
    status = 'connected';
  } else if (state.mode === 'rest' && !state.websocketAvailable) {
    status = 'fallback_rest';
  } else if (state.mode === 'hybrid') {
    status = state.websocketAvailable ? 'connected' : 'fallback_rest';
  } else if (!state.websocketAvailable && !state.restAvailable) {
    status = 'disconnected';
  } else {
    status = 'reconnecting';
  }

  return {
    exchange: state.exchange,
    dataType: state.dataType,
    status,
    mode: state.mode,
    lastUpdate: state.lastDataReceivedAt?.toISOString() ?? null,
    latency: state.latency ?? null,
    health: healthCheck.health,
    isStale: healthCheck.isStale,
  };
}

/**
 * 取得 WebSocket 連線狀態
 *
 * @returns WebSocket 連線狀態資訊
 */
export async function GET(): Promise<NextResponse<WsStatusResponse>> {
  try {
    // 使用 DataSourceManager singleton 取得真實狀態
    const dataSourceManager = DataSourceManager.getInstance();
    const states = dataSourceManager.getAllStates();
    const healthChecks = dataSourceManager.getAllHealthChecks();
    const summary = dataSourceManager.getSummary();

    // 建立 healthCheck 查詢 map
    const healthCheckMap = new Map<string, DataSourceHealthCheck>();
    for (const hc of healthChecks) {
      healthCheckMap.set(`${hc.exchange}:${hc.dataType}`, hc);
    }

    // 轉換狀態
    const connections: WsConnectionStatus[] = states.map((state) => {
      const key = `${state.exchange}:${state.dataType}`;
      const healthCheck = healthCheckMap.get(key) ?? {
        exchange: state.exchange,
        dataType: state.dataType,
        health: 'fallback' as const,
        mode: state.mode,
        latency: state.latency,
        isStale: true,
        checkedAt: new Date(),
      };
      return mapToConnectionStatus(state, healthCheck);
    });

    // 計算健康統計
    let optimalCount = 0;
    let degradedCount = 0;
    let fallbackCount = 0;

    for (const conn of connections) {
      switch (conn.health) {
        case 'optimal':
          optimalCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'fallback':
          fallbackCount++;
          break;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        connections,
        summary: {
          totalConnections: summary.total,
          websocketCount: summary.websocketCount,
          restCount: summary.restCount,
          hybridCount: summary.hybridCount,
          optimalCount,
          degradedCount,
          fallbackCount,
        },
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
            websocketCount: 0,
            restCount: 0,
            hybridCount: 0,
            optimalCount: 0,
            degradedCount: 0,
            fallbackCount: 0,
          },
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
