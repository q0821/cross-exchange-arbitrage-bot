/**
 * Memory Delta Tracker
 *
 * 追蹤記憶體使用量和資料結構大小的變化量
 * 用於識別潛在的記憶體洩漏
 *
 * Feature: 066-memory-monitoring
 */

/**
 * 服務統計快照
 */
interface ServiceSnapshot {
  items: number;
  listeners: number;
}

/**
 * 整體統計快照
 */
export interface StatsSnapshot {
  timestamp: number;
  heapUsed: number;
  totalItems: number;
  totalEventListeners: number;
  serviceStats: Map<string, ServiceSnapshot>;
}

/**
 * 服務 Delta 變化
 */
export interface ServiceDelta {
  itemsDelta: number;
  listenersDelta: number;
}

/**
 * Delta 計算結果
 */
export interface DeltaResult {
  /** Heap 使用量變化 (MB) */
  heapDelta: number;
  /** 總項目數變化 */
  itemsDelta: number;
  /** 總 listener 數變化 */
  listenersDelta: number;
  /** 各服務的變化量 */
  serviceDeltas: Record<string, ServiceDelta>;
  /** 是否為首次計算（無前一個快照）*/
  isFirstSnapshot: boolean;
}

/**
 * 增長最快的服務
 */
export interface TopGrower {
  name: string;
  items: number;
  delta: number;
}

/**
 * Memory Delta Tracker
 *
 * 追蹤記憶體快照之間的變化量
 */
export class MemoryDeltaTracker {
  private previousSnapshot: StatsSnapshot | null = null;

  /**
   * 計算 Delta 變化量
   *
   * @param current - 當前快照
   * @returns Delta 計算結果
   */
  computeDelta(current: StatsSnapshot): DeltaResult {
    if (!this.previousSnapshot) {
      this.previousSnapshot = current;
      return {
        heapDelta: 0,
        itemsDelta: 0,
        listenersDelta: 0,
        serviceDeltas: {},
        isFirstSnapshot: true,
      };
    }

    const prev = this.previousSnapshot;
    const serviceDeltas: Record<string, ServiceDelta> = {};

    // 計算各服務的 delta
    for (const [name, currentStats] of current.serviceStats) {
      const prevStats = prev.serviceStats.get(name);
      if (prevStats) {
        serviceDeltas[name] = {
          itemsDelta: currentStats.items - prevStats.items,
          listenersDelta: currentStats.listeners - prevStats.listeners,
        };
      } else {
        // 新服務
        serviceDeltas[name] = {
          itemsDelta: currentStats.items,
          listenersDelta: currentStats.listeners,
        };
      }
    }

    // 檢查已移除的服務
    for (const [name, prevStats] of prev.serviceStats) {
      if (!current.serviceStats.has(name)) {
        serviceDeltas[name] = {
          itemsDelta: -prevStats.items,
          listenersDelta: -prevStats.listeners,
        };
      }
    }

    const result: DeltaResult = {
      heapDelta: Math.round((current.heapUsed - prev.heapUsed) * 100) / 100,
      itemsDelta: current.totalItems - prev.totalItems,
      listenersDelta: current.totalEventListeners - prev.totalEventListeners,
      serviceDeltas,
      isFirstSnapshot: false,
    };

    // 更新前一個快照
    this.previousSnapshot = current;

    return result;
  }

  /**
   * 取得增長最快的服務列表
   *
   * @param serviceDeltas - 服務變化量
   * @param currentStats - 當前各服務統計
   * @param limit - 返回數量限制
   * @returns 增長最快的服務列表
   */
  getTopGrowers(
    serviceDeltas: Record<string, ServiceDelta>,
    currentStats: Map<string, ServiceSnapshot>,
    limit = 5
  ): TopGrower[] {
    const growers: TopGrower[] = [];

    for (const [name, delta] of Object.entries(serviceDeltas)) {
      if (delta.itemsDelta > 0) {
        const current = currentStats.get(name);
        growers.push({
          name,
          items: current?.items ?? 0,
          delta: delta.itemsDelta,
        });
      }
    }

    // 按 delta 降序排序
    growers.sort((a, b) => b.delta - a.delta);

    return growers.slice(0, limit);
  }

  /**
   * 格式化 delta 為字串
   *
   * @param value - 數值
   * @returns 格式化字串（+N 或 -N）
   */
  static formatDelta(value: number): string {
    if (value === 0) return '0';
    return value > 0 ? `+${value}` : `${value}`;
  }

  /**
   * 重置追蹤器
   */
  reset(): void {
    this.previousSnapshot = null;
  }

  /**
   * 是否有前一個快照
   */
  hasPreviousSnapshot(): boolean {
    return this.previousSnapshot !== null;
  }
}

// 導出單例
export const memoryDeltaTracker = new MemoryDeltaTracker();
