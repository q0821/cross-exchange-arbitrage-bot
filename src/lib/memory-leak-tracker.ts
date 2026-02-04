/**
 * Memory Leak Tracker
 *
 * 可整合到現有服務中的記憶體洩漏追蹤模組
 * 追蹤未被 Monitorable 監控的物件
 *
 * 使用方式：
 *   import { MemoryLeakTracker } from '@/lib/memory-leak-tracker';
 *   const tracker = MemoryLeakTracker.getInstance();
 *   tracker.start();
 */

import v8 from 'v8';
import { logger } from './logger.js';

// ============================================================================
// 1. 類型定義
// ============================================================================

interface DetailedMemorySnapshot {
  timestamp: Date;
  heap: {
    used: number;
    total: number;
    external: number;
    arrayBuffers: number;
  };
  v8: {
    usedHeapSize: number;
    totalHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    numberOfDetachedContexts: number;
  };
  handles: {
    active: number;
    requests: number;
  };
  timers: {
    timeouts: number;
    intervals: number;
  };
}

interface LeakAlert {
  type: 'heap' | 'handles' | 'timers' | 'detached_contexts';
  message: string;
  currentValue: number;
  delta: number;
  severity: 'warning' | 'critical';
}

// ============================================================================
// 2. Timer 追蹤器
// ============================================================================

class TimerTracker {
  private static instance: TimerTracker;
  private timeoutCount = 0;
  private intervalCount = 0;
  private initialized = false;

  private constructor() {}

  static getInstance(): TimerTracker {
    if (!TimerTracker.instance) {
      TimerTracker.instance = new TimerTracker();
    }
    return TimerTracker.instance;
  }

  initialize(): void {
    if (this.initialized) return;

    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    // 使用 ReturnType 來取得正確的類型
    type TimeoutId = ReturnType<typeof setTimeout>;
    const timeoutIds = new Set<TimeoutId>();
    const intervalIds = new Set<TimeoutId>();

    // 使用閉包保存 this 的屬性更新函數
    const updateTimeoutCount = (size: number) => { this.timeoutCount = size; };
    const updateIntervalCount = (size: number) => { this.intervalCount = size; };

    // 覆寫 setTimeout
    (global as unknown as { setTimeout: typeof setTimeout }).setTimeout = function(
      callback: (...args: unknown[]) => void,
      ms?: number,
      ...args: unknown[]
    ) {
      const id = originalSetTimeout(callback, ms, ...args);
      timeoutIds.add(id);
      updateTimeoutCount(timeoutIds.size);

      // 自動清理（當 timeout 完成時）
      const wrappedCallback = () => {
        timeoutIds.delete(id);
        updateTimeoutCount(timeoutIds.size);
      };
      originalSetTimeout(wrappedCallback, (ms || 0) + 100);

      return id;
    } as typeof setTimeout;

    (global as unknown as { clearTimeout: typeof clearTimeout }).clearTimeout = function(
      id: TimeoutId | undefined
    ) {
      if (id !== undefined) {
        timeoutIds.delete(id);
        updateTimeoutCount(timeoutIds.size);
      }
      return originalClearTimeout(id);
    } as typeof clearTimeout;

    // 覆寫 setInterval
    (global as unknown as { setInterval: typeof setInterval }).setInterval = function(
      callback: (...args: unknown[]) => void,
      ms?: number,
      ...args: unknown[]
    ) {
      const id = originalSetInterval(callback, ms, ...args);
      intervalIds.add(id);
      updateIntervalCount(intervalIds.size);
      return id;
    } as typeof setInterval;

    (global as unknown as { clearInterval: typeof clearInterval }).clearInterval = function(
      id: TimeoutId | undefined
    ) {
      if (id !== undefined) {
        intervalIds.delete(id);
        updateIntervalCount(intervalIds.size);
      }
      return originalClearInterval(id);
    } as typeof clearInterval;

    this.initialized = true;
  }

  getStats(): { timeouts: number; intervals: number } {
    return {
      timeouts: this.timeoutCount,
      intervals: this.intervalCount,
    };
  }
}

// ============================================================================
// 3. Memory Leak Tracker
// ============================================================================

export class MemoryLeakTracker {
  private static instance: MemoryLeakTracker;
  private intervalId: NodeJS.Timeout | null = null;
  private snapshots: DetailedMemorySnapshot[] = [];
  private maxSnapshots = 60; // 保留最近 60 個快照
  private alertThresholds = {
    heapGrowthPerMinute: 100, // MB
    heapAbsolute: 2000, // MB
    handlesGrowth: 20,
    intervalsGrowth: 5,
    detachedContextsGrowth: 3,
  };

  private constructor() {
    TimerTracker.getInstance().initialize();
  }

  static getInstance(): MemoryLeakTracker {
    if (!MemoryLeakTracker.instance) {
      MemoryLeakTracker.instance = new MemoryLeakTracker();
    }
    return MemoryLeakTracker.instance;
  }

  /**
   * 開始追蹤（每分鐘一次）
   */
  start(intervalMs = 60000): void {
    if (this.intervalId) {
      logger.warn('MemoryLeakTracker already running');
      return;
    }

    logger.info({ intervalMs }, 'MemoryLeakTracker started');

    // 立即取一個快照
    this.takeSnapshot();

    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }

  /**
   * 停止追蹤
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('MemoryLeakTracker stopped');
    }
  }

  /**
   * 取得詳細的記憶體快照
   */
  private takeSnapshot(): void {
    const snapshot = this.getDetailedSnapshot();
    this.snapshots.push(snapshot);

    // 保持快照數量在限制內
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // 檢測洩漏
    const alerts = this.detectLeaks();

    // 記錄快照
    logger.info(
      {
        heap: snapshot.heap,
        v8: {
          detachedContexts: snapshot.v8.numberOfDetachedContexts,
          mallocedMemory: snapshot.v8.mallocedMemory,
        },
        handles: snapshot.handles,
        timers: snapshot.timers,
        alerts: alerts.length > 0 ? alerts : undefined,
      },
      'Memory leak tracker snapshot'
    );

    // 如果有嚴重警告，輸出到 critical log
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      logger.error(
        { alerts: criticalAlerts, heap: snapshot.heap.used },
        'Memory leak detected - critical alerts'
      );
    }
  }

  /**
   * 獲取詳細的記憶體快照
   */
  private getDetailedSnapshot(): DetailedMemorySnapshot {
    const memUsage = process.memoryUsage();
    const v8Stats = v8.getHeapStatistics();
    const timerStats = TimerTracker.getInstance().getStats();

    return {
      timestamp: new Date(),
      heap: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
      },
      v8: {
        usedHeapSize: Math.round(v8Stats.used_heap_size / 1024 / 1024),
        totalHeapSize: Math.round(v8Stats.total_heap_size / 1024 / 1024),
        heapSizeLimit: Math.round(v8Stats.heap_size_limit / 1024 / 1024),
        mallocedMemory: Math.round(v8Stats.malloced_memory / 1024 / 1024),
        numberOfDetachedContexts: v8Stats.number_of_detached_contexts,
      },
      handles: {
        active: (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()?.length ?? -1,
        requests: (process as unknown as { _getActiveRequests?: () => unknown[] })._getActiveRequests?.()?.length ?? -1,
      },
      timers: timerStats,
    };
  }

  /**
   * 檢測可能的洩漏
   */
  private detectLeaks(): LeakAlert[] {
    const alerts: LeakAlert[] = [];

    if (this.snapshots.length < 2) {
      return alerts;
    }

    const current = this.snapshots[this.snapshots.length - 1]!;
    const previous = this.snapshots[this.snapshots.length - 2]!;

    // 計算時間差（分鐘）
    const timeDiffMinutes = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000 / 60;

    // 1. Heap 增長檢測
    const heapDelta = current.heap.used - previous.heap.used;
    const heapGrowthRate = heapDelta / timeDiffMinutes;

    if (heapGrowthRate > this.alertThresholds.heapGrowthPerMinute) {
      alerts.push({
        type: 'heap',
        message: `Heap growing at ${heapGrowthRate.toFixed(1)} MB/min`,
        currentValue: current.heap.used,
        delta: heapDelta,
        severity: heapGrowthRate > 200 ? 'critical' : 'warning',
      });
    }

    if (current.heap.used > this.alertThresholds.heapAbsolute) {
      alerts.push({
        type: 'heap',
        message: `Heap exceeded ${this.alertThresholds.heapAbsolute} MB`,
        currentValue: current.heap.used,
        delta: heapDelta,
        severity: 'critical',
      });
    }

    // 2. Handles 增長檢測
    const handlesDelta = current.handles.active - previous.handles.active;
    if (handlesDelta > this.alertThresholds.handlesGrowth) {
      alerts.push({
        type: 'handles',
        message: `Active handles increased by ${handlesDelta}`,
        currentValue: current.handles.active,
        delta: handlesDelta,
        severity: handlesDelta > 50 ? 'critical' : 'warning',
      });
    }

    // 3. Intervals 增長檢測（interval 洩漏很嚴重）
    const intervalsDelta = current.timers.intervals - previous.timers.intervals;
    if (intervalsDelta > this.alertThresholds.intervalsGrowth) {
      alerts.push({
        type: 'timers',
        message: `Active intervals increased by ${intervalsDelta} (possible interval leak)`,
        currentValue: current.timers.intervals,
        delta: intervalsDelta,
        severity: 'critical',
      });
    }

    // 4. Detached contexts 檢測
    const detachedDelta = current.v8.numberOfDetachedContexts - previous.v8.numberOfDetachedContexts;
    if (detachedDelta > this.alertThresholds.detachedContextsGrowth) {
      alerts.push({
        type: 'detached_contexts',
        message: `Detached contexts increased by ${detachedDelta} (possible closure leak)`,
        currentValue: current.v8.numberOfDetachedContexts,
        delta: detachedDelta,
        severity: 'warning',
      });
    }

    // 5. 長期趨勢檢測（如果有 5+ 個快照）
    if (this.snapshots.length >= 5) {
      const oldest = this.snapshots[0]!;
      const totalTimeDiff = (current.timestamp.getTime() - oldest.timestamp.getTime()) / 1000 / 60;
      const totalHeapGrowth = current.heap.used - oldest.heap.used;
      const avgGrowthRate = totalHeapGrowth / totalTimeDiff;

      if (avgGrowthRate > 50 && totalHeapGrowth > 500) {
        alerts.push({
          type: 'heap',
          message: `Sustained heap growth: ${totalHeapGrowth} MB over ${totalTimeDiff.toFixed(0)} min (avg ${avgGrowthRate.toFixed(1)} MB/min)`,
          currentValue: current.heap.used,
          delta: totalHeapGrowth,
          severity: 'critical',
        });
      }
    }

    return alerts;
  }

  /**
   * 獲取當前統計資訊
   */
  getStats(): {
    snapshotCount: number;
    latestSnapshot: DetailedMemorySnapshot | null;
    heapTrend: { start: number; end: number; delta: number } | null;
  } {
    const latestSnapshot = this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] ?? null : null;

    let heapTrend: { start: number; end: number; delta: number } | null = null;
    if (this.snapshots.length >= 2) {
      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];
      if (first && last) {
        heapTrend = {
          start: first.heap.used,
          end: last.heap.used,
          delta: last.heap.used - first.heap.used,
        };
      }
    }

    return {
      snapshotCount: this.snapshots.length,
      latestSnapshot,
      heapTrend,
    };
  }

  /**
   * 清除快照歷史
   */
  clearHistory(): void {
    this.snapshots = [];
  }
}

// 導出單例
export const memoryLeakTracker = MemoryLeakTracker.getInstance();
