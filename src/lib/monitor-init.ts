/**
 * monitor-init.ts
 * Feature: 050-sl-tp-trigger-monitor (Phase 7: Integration)
 *
 * T040: 監控服務初始化模組
 * T041: Singleton pattern 實作
 * T043: SIGINT/SIGTERM 信號處理（優雅關閉）
 *
 * 管理 ConditionalOrderMonitor 的生命週期
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { ConditionalOrderMonitor } from '@/services/monitor/ConditionalOrderMonitor';

/**
 * 初始化選項
 */
export interface MonitorInitOptions {
  /** 輪詢間隔（毫秒），預設 30000 */
  intervalMs?: number;
  /** 是否自動啟動，預設 false */
  autoStart?: boolean;
}

/**
 * 監控狀態
 */
export interface MonitorStatus {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否正在運行 */
  isRunning: boolean;
  /** 輪詢間隔（毫秒） */
  intervalMs: number;
}

// T041: Singleton instance
let monitorInstance: ConditionalOrderMonitor | null = null;

/**
 * T040: 初始化 ConditionalOrderMonitor
 *
 * 建立並可選擇性地啟動監控服務
 *
 * @param options - 初始化選項
 * @returns ConditionalOrderMonitor 實例
 */
export function initializeConditionalOrderMonitor(
  options: MonitorInitOptions = {},
): ConditionalOrderMonitor {
  const { intervalMs, autoStart = false } = options;

  // 如果已存在實例，返回現有實例（單例模式）
  if (monitorInstance) {
    logger.warn({}, 'ConditionalOrderMonitor already initialized, returning existing instance');
    return monitorInstance;
  }

  // 建立新實例
  monitorInstance = new ConditionalOrderMonitor(prisma, intervalMs);

  logger.info(
    { intervalMs: monitorInstance.intervalMs, autoStart },
    'ConditionalOrderMonitor initialized',
  );

  // 自動啟動
  if (autoStart) {
    monitorInstance.start().catch((error) => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to auto-start ConditionalOrderMonitor',
      );
    });
  }

  return monitorInstance;
}

/**
 * T041: 獲取 ConditionalOrderMonitor 實例
 *
 * @throws 如果尚未初始化則拋出錯誤
 * @returns ConditionalOrderMonitor 實例
 */
export function getConditionalOrderMonitor(): ConditionalOrderMonitor {
  if (!monitorInstance) {
    throw new Error('ConditionalOrderMonitor not initialized. Call initializeConditionalOrderMonitor() first.');
  }

  return monitorInstance;
}

/**
 * T041: 重置監控實例（用於測試）
 *
 * 停止並清除現有實例
 */
export async function resetMonitor(): Promise<void> {
  if (monitorInstance) {
    await monitorInstance.stop();
    monitorInstance = null;
    logger.info({}, 'ConditionalOrderMonitor reset');
  }
}

/**
 * T043: 優雅關閉
 *
 * 停止監控服務
 */
export async function gracefulShutdown(): Promise<void> {
  logger.info({}, 'Graceful shutdown initiated');

  if (monitorInstance) {
    try {
      await monitorInstance.stop();
      logger.info({}, 'ConditionalOrderMonitor stopped during graceful shutdown');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error stopping ConditionalOrderMonitor during graceful shutdown',
      );
    }
  }

  logger.info({}, 'Graceful shutdown completed');
}

/**
 * T043: 設置信號處理器
 *
 * 註冊 SIGINT 和 SIGTERM 信號處理，實現優雅關閉
 */
export function setupSignalHandlers(): void {
  // SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info({}, 'Received SIGINT signal');
    await gracefulShutdown();
    process.exit(0);
  });

  // SIGTERM (kill command)
  process.on('SIGTERM', async () => {
    logger.info({}, 'Received SIGTERM signal');
    await gracefulShutdown();
    process.exit(0);
  });

  logger.info({}, 'Signal handlers registered (SIGINT, SIGTERM)');
}

/**
 * 獲取監控狀態
 *
 * @returns 監控狀態物件
 */
export function getMonitorStatus(): MonitorStatus {
  if (!monitorInstance) {
    return {
      initialized: false,
      isRunning: false,
      intervalMs: 0,
    };
  }

  return {
    initialized: true,
    isRunning: monitorInstance.isRunning,
    intervalMs: monitorInstance.intervalMs,
  };
}

/**
 * 啟動監控服務
 *
 * 如果尚未初始化，會先初始化
 */
export async function startMonitor(options: MonitorInitOptions = {}): Promise<void> {
  if (!monitorInstance) {
    initializeConditionalOrderMonitor(options);
  }

  if (monitorInstance && !monitorInstance.isRunning) {
    await monitorInstance.start();
    logger.info({}, 'ConditionalOrderMonitor started');
  }
}

/**
 * 停止監控服務
 */
export async function stopMonitor(): Promise<void> {
  if (monitorInstance && monitorInstance.isRunning) {
    await monitorInstance.stop();
    logger.info({}, 'ConditionalOrderMonitor stopped');
  }
}

export default {
  initializeConditionalOrderMonitor,
  getConditionalOrderMonitor,
  resetMonitor,
  gracefulShutdown,
  setupSignalHandlers,
  getMonitorStatus,
  startMonitor,
  stopMonitor,
};
