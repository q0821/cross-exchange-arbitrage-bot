/**
 * Memory Monitor
 *
 * 定期記錄 Node.js 記憶體使用狀況到 log
 * 用於監控生產環境的記憶體趨勢，及早發現記憶體洩漏
 *
 * Feature: 066-memory-monitoring
 * - 整合資料結構大小監控
 * - 記憶體日誌分流到 logs/memory/YYYY-MM-DD.log
 * - Delta 變化量追蹤（識別潛在洩漏）
 * - EventEmitter listener 數量追蹤
 *
 * Feature: memory-usage-improvement
 * - Heap 增長超過閾值時自動抓取並分析 heap snapshot
 */

import { logger } from './logger';
import { memoryLogger } from './memory-logger';
import { DataStructureRegistry, initializeSingletonGetters } from './data-structure-registry';
import {
  memoryDeltaTracker,
  MemoryDeltaTracker,
  type StatsSnapshot,
  type TopGrower,
} from './memory-delta-tracker';
import {
  captureAndAnalyzeHeap,
  isHeapSnapshotEnabled,
  getHeapSnapshotThresholdMB,
} from './heap-snapshot';
import type { DataStructureStats } from '@/types/memory-stats';

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

/**
 * 擴展記憶體統計資訊（含資料結構和 Delta）
 * Feature: 066-memory-monitoring
 */
export interface ExtendedMemoryStats extends MemoryStats {
  /** 資料結構摘要 */
  dataStructures: {
    totalServices: number;
    totalItems: number;
    totalEventListeners: number;
  };
  /** 資料結構詳細資訊 */
  dataStructureDetails: DataStructureStats[];
}

/**
 * Delta 統計資訊
 */
export interface DeltaStats {
  /** Heap 使用量變化 (MB) */
  heapDelta: string;
  /** 總項目數變化 */
  itemsDelta: string;
  /** 總 listener 數變化 */
  listenersDelta: string;
  /** 增長最快的服務列表 */
  topGrowers: TopGrower[];
  /** 是否為首次快照 */
  isFirstSnapshot: boolean;
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
 * 取得擴展記憶體統計（含資料結構）
 * Feature: 066-memory-monitoring
 */
export function getExtendedMemoryStats(): ExtendedMemoryStats {
  const basicStats = getMemoryStats();
  const dataStructureDetails = DataStructureRegistry.getAllStats();

  const totalItems = dataStructureDetails.reduce((sum, ds) => sum + ds.totalItems, 0);
  const totalEventListeners = dataStructureDetails.reduce(
    (sum, ds) => sum + (ds.eventListenerCount ?? 0),
    0
  );

  return {
    ...basicStats,
    dataStructures: {
      totalServices: dataStructureDetails.length,
      totalItems,
      totalEventListeners,
    },
    dataStructureDetails,
  };
}

/**
 * 建立統計快照（用於 Delta 計算）
 */
function createStatsSnapshot(
  extendedStats: ExtendedMemoryStats
): StatsSnapshot {
  const serviceStats = new Map<string, { items: number; listeners: number }>();

  for (const ds of extendedStats.dataStructureDetails) {
    serviceStats.set(ds.name, {
      items: ds.totalItems,
      listeners: ds.eventListenerCount ?? 0,
    });
  }

  return {
    timestamp: Date.now(),
    heapUsed: extendedStats.heapUsed,
    totalItems: extendedStats.dataStructures.totalItems,
    totalEventListeners: extendedStats.dataStructures.totalEventListeners,
    serviceStats,
  };
}

/**
 * 記錄記憶體使用狀況
 * Feature: 066-memory-monitoring - 整合資料結構統計、Delta 追蹤並分流日誌
 */
function logMemoryUsage(): void {
  const extendedStats = getExtendedMemoryStats();
  const uptimeSeconds = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;

  // 更新峰值
  if (extendedStats.heapUsed > peakHeapUsed) {
    peakHeapUsed = extendedStats.heapUsed;
  }

  // 建立快照並計算 Delta
  const snapshot = createStatsSnapshot(extendedStats);
  const deltaResult = memoryDeltaTracker.computeDelta(snapshot);
  const topGrowers = memoryDeltaTracker.getTopGrowers(
    deltaResult.serviceDeltas,
    snapshot.serviceStats,
    5
  );

  // Delta 統計（格式化為字串）
  const deltaStats: DeltaStats = {
    heapDelta: MemoryDeltaTracker.formatDelta(deltaResult.heapDelta),
    itemsDelta: MemoryDeltaTracker.formatDelta(deltaResult.itemsDelta),
    listenersDelta: MemoryDeltaTracker.formatDelta(deltaResult.listenersDelta),
    topGrowers,
    isFirstSnapshot: deltaResult.isFirstSnapshot,
  };

  // 完整資料寫入 memoryLogger（logs/memory/）
  const fullLogData = {
    timestamp: new Date().toISOString(),
    heap: {
      used: extendedStats.heapUsed,
      total: extendedStats.heapTotal,
      percent: extendedStats.heapUsagePercent,
      delta: deltaStats.heapDelta,
    },
    summary: {
      totalEventListeners: extendedStats.dataStructures.totalEventListeners,
      totalEventListenersDelta: deltaStats.listenersDelta,
      totalItems: extendedStats.dataStructures.totalItems,
      totalItemsDelta: deltaStats.itemsDelta,
      topGrowers: deltaStats.topGrowers,
    },
    rss: extendedStats.rss,
    external: extendedStats.external,
    arrayBuffers: extendedStats.arrayBuffers,
    peakHeapUsedMB: Math.round(peakHeapUsed * 100) / 100,
    uptimeMinutes: Math.round(uptimeSeconds / 60),
    services: extendedStats.dataStructureDetails.map((ds) => ({
      name: ds.name,
      items: ds.totalItems,
      listeners: ds.eventListenerCount ?? 0,
      sizes: ds.sizes,
      details: ds.details,
    })),
  };

  memoryLogger.info(fullLogData, 'Memory snapshot');

  // 摘要資料寫入主 logger
  const summaryLogData = {
    heapUsedMB: extendedStats.heapUsed,
    heapDelta: deltaStats.heapDelta,
    heapUsagePercent: extendedStats.heapUsagePercent,
    peakHeapUsedMB: Math.round(peakHeapUsed * 100) / 100,
    uptimeMinutes: Math.round(uptimeSeconds / 60),
    dataStructureItems: extendedStats.dataStructures.totalItems,
    itemsDelta: deltaStats.itemsDelta,
    eventListeners: extendedStats.dataStructures.totalEventListeners,
    listenersDelta: deltaStats.listenersDelta,
  };

  // 超過 1GB 使用警告級別，超過 2GB 使用錯誤級別
  if (extendedStats.heapUsed > 2048) {
    logger.error(summaryLogData, 'Memory usage CRITICAL - heap > 2GB');
  } else if (extendedStats.heapUsed > 1024) {
    logger.warn(summaryLogData, 'Memory usage HIGH - heap > 1GB');
  } else {
    logger.info(summaryLogData, 'Memory usage');
  }

  // 如果有 topGrowers，額外記錄警告
  if (topGrowers.length > 0 && !deltaResult.isFirstSnapshot) {
    const significantGrowers = topGrowers.filter((g) => g.delta > 10);
    if (significantGrowers.length > 0) {
      logger.warn(
        { topGrowers: significantGrowers },
        'Significant data structure growth detected'
      );
    }
  }

  // Feature: memory-usage-improvement
  // 當 heap 增長超過閾值時抓取並分析 heap snapshot
  // 可透過環境變數控制：
  //   ENABLE_HEAP_SNAPSHOT=true 啟用（預設關閉，避免影響 production 效能）
  //   HEAP_SNAPSHOT_THRESHOLD_MB=100 設定觸發閾值（MB）
  if (isHeapSnapshotEnabled()) {
    const thresholdMB = getHeapSnapshotThresholdMB();
    if (deltaResult.heapDelta > thresholdMB && !deltaResult.isFirstSnapshot) {
      // 使用 async/await 處理（不阻塞主執行緒）
      captureAndAnalyzeHeap(`growth-${Math.round(deltaResult.heapDelta)}MB`)
        .then((report) => {
          if (report) {
            logger.warn(
              {
                heapDeltaMB: deltaResult.heapDelta,
                thresholdMB,
                snapshotFile: report.filepath,
                topTypes: report.topTypes.slice(0, 5),
              },
              'Heap growth exceeded threshold - snapshot captured'
            );
          }
        })
        .catch((error) => {
          logger.error({ error }, 'Failed to capture heap snapshot');
        });
    }
  }
}

/**
 * 啟動記憶體監控
 *
 * @param intervalMs - 記錄間隔（毫秒），預設 300000 (5 分鐘)
 */
export function startMemoryMonitor(intervalMs = 300000): void {
  if (intervalId) {
    logger.warn('Memory monitor already running');
    return;
  }

  // 初始化 singleton getters（確保所有服務都能被監控）
  initializeSingletonGetters();

  startTime = new Date();
  peakHeapUsed = 0;

  // 重置 Delta 追蹤器
  memoryDeltaTracker.reset();

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
