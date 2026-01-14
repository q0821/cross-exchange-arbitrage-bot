/**
 * Memory Monitor
 *
 * 定期記錄 Node.js 記憶體使用狀況到 log
 * 用於監控生產環境的記憶體趨勢，及早發現記憶體洩漏
 */

import { logger } from './logger';

/**
 * 記憶體統計資訊
 */
export interface MemoryStats {
  /** RSS (Resident Set Size) - 進程總記憶體 (MB) */
  rss: number;
  /** Heap 已使用 (MB) */
  heapUsed: number;
  /** Heap 總大小 (MB) */
  heapTotal: number;
  /** 外部記憶體 (MB) */
  external: number;
  /** Array Buffers (MB) */
  arrayBuffers: number;
  /** Heap 使用率 (%) */
  heapUsagePercent: number;
}

// 全域變數
let intervalId: NodeJS.Timeout | null = null;
let startTime: Date | null = null;
let peakHeapUsed = 0;

/**
 * 取得當前記憶體統計
 */
export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  const heapUsed = mem.heapUsed / 1024 / 1024;
  const heapTotal = mem.heapTotal / 1024 / 1024;

  return {
    rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(heapUsed * 100) / 100,
    heapTotal: Math.round(heapTotal * 100) / 100,
    external: Math.round(mem.external / 1024 / 1024 * 100) / 100,
    arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024 * 100) / 100,
    heapUsagePercent: Math.round(heapUsed / heapTotal * 100),
  };
}

/**
 * 記錄記憶體使用狀況
 */
function logMemoryUsage(): void {
  const stats = getMemoryStats();
  const uptimeSeconds = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;

  // 更新峰值
  if (stats.heapUsed > peakHeapUsed) {
    peakHeapUsed = stats.heapUsed;
  }

  // 根據記憶體使用狀況選擇 log 級別
  const logData = {
    ...stats,
    peakHeapUsedMB: Math.round(peakHeapUsed * 100) / 100,
    uptimeMinutes: Math.round(uptimeSeconds / 60),
  };

  // 超過 1GB 使用警告級別，超過 2GB 使用錯誤級別
  if (stats.heapUsed > 2048) {
    logger.error(logData, 'Memory usage CRITICAL - heap > 2GB');
  } else if (stats.heapUsed > 1024) {
    logger.warn(logData, 'Memory usage HIGH - heap > 1GB');
  } else {
    logger.info(logData, 'Memory usage');
  }
}

/**
 * 啟動記憶體監控
 *
 * @param intervalMs - 記錄間隔（毫秒），預設 60000 (1 分鐘)
 */
export function startMemoryMonitor(intervalMs = 60000): void {
  if (intervalId) {
    logger.warn('Memory monitor already running');
    return;
  }

  startTime = new Date();
  peakHeapUsed = 0;

  // 立即記錄一次
  logMemoryUsage();

  // 定期記錄
  intervalId = setInterval(logMemoryUsage, intervalMs);

  logger.info(
    { intervalMs, intervalMinutes: intervalMs / 60000 },
    'Memory monitor started'
  );
}

/**
 * 停止記憶體監控
 */
export function stopMemoryMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;

    // 記錄最終統計
    const stats = getMemoryStats();
    const uptimeSeconds = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;

    logger.info(
      {
        finalStats: stats,
        peakHeapUsedMB: Math.round(peakHeapUsed * 100) / 100,
        totalUptimeMinutes: Math.round(uptimeSeconds / 60),
      },
      'Memory monitor stopped'
    );

    startTime = null;
  }
}

/**
 * 檢查是否正在運行
 */
export function isMemoryMonitorRunning(): boolean {
  return intervalId !== null;
}
