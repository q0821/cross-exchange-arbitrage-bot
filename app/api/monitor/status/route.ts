/**
 * Monitor Status API
 * Feature: 050-sl-tp-trigger-monitor (Phase 7: Integration)
 *
 * T044: 監控狀態查詢 API
 *
 * GET /api/monitor/status - 獲取條件單監控服務狀態
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitorStatus } from '@/lib/monitor-init';

/**
 * GET /api/monitor/status
 *
 * 獲取 ConditionalOrderMonitor 服務狀態
 *
 * @returns 監控狀態
 */
export async function GET(_request: NextRequest) {
  try {
    const status = getMonitorStatus();

    return NextResponse.json({
      status: 'ok',
      monitor: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
