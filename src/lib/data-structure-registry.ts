/**
 * DataStructureRegistry
 *
 * 資料結構註冊中心，用於監控各服務的 Map/Set 大小
 * Feature: 066-memory-monitoring
 */

import type { DataStructureStats, Monitorable } from '@/types/memory-stats';
import { isMonitorable } from '@/types/memory-stats';

/**
 * 單例服務的 getter 類型
 */
type SingletonGetter = () => Monitorable | null;

/**
 * DataStructureRegistry - 資料結構註冊中心
 *
 * 單例模式，管理所有需要監控的服務
 */
class DataStructureRegistryClass {
  private static instance: DataStructureRegistryClass | null = null;

  /** 動態註冊的服務 */
  private services: Map<string, Monitorable> = new Map();

  /** 單例服務的 getter（延遲取得） */
  private singletonGetters: Map<string, SingletonGetter> = new Map();

  private constructor() {}

  /**
   * 取得單例實例
   */
  static getInstance(): DataStructureRegistryClass {
    if (!DataStructureRegistryClass.instance) {
      DataStructureRegistryClass.instance = new DataStructureRegistryClass();
    }
    return DataStructureRegistryClass.instance;
  }

  /**
   * 重置單例（僅用於測試）
   */
  static resetInstance(): void {
    if (DataStructureRegistryClass.instance) {
      DataStructureRegistryClass.instance.services.clear();
      DataStructureRegistryClass.instance.singletonGetters.clear();
      DataStructureRegistryClass.instance = null;
    }
  }

  /**
   * 註冊服務（動態註冊，適用於非單例或多實例服務）
   *
   * @param key - 服務識別鍵（如 "ConnectionPool:binance"）
   * @param service - 實作 Monitorable 介面的服務
   */
  register(key: string, service: Monitorable): void {
    if (!isMonitorable(service)) {
      throw new Error(`Service "${key}" does not implement Monitorable interface`);
    }
    this.services.set(key, service);
  }

  /**
   * 取消註冊服務
   *
   * @param key - 服務識別鍵
   */
  unregister(key: string): void {
    this.services.delete(key);
  }

  /**
   * 註冊單例服務的 getter（延遲取得，避免循環依賴）
   *
   * @param name - 服務名稱
   * @param getter - 取得服務實例的函式
   */
  registerSingletonGetter(name: string, getter: SingletonGetter): void {
    this.singletonGetters.set(name, getter);
  }

  /**
   * 收集所有服務的統計資訊
   *
   * @returns 所有服務的 DataStructureStats 陣列
   */
  getAllStats(): DataStructureStats[] {
    const stats: DataStructureStats[] = [];

    // 收集動態註冊的服務統計
    for (const [, service] of this.services) {
      try {
        stats.push(service.getDataStructureStats());
      } catch {
        // 忽略取得統計失敗的服務
      }
    }

    // 收集單例服務統計
    for (const [, getter] of this.singletonGetters) {
      try {
        const service = getter();
        if (service && isMonitorable(service)) {
          stats.push(service.getDataStructureStats());
        }
      } catch {
        // 忽略取得統計失敗的服務
      }
    }

    return stats;
  }

  /**
   * 取得已註冊服務數量
   */
  getRegisteredCount(): number {
    return this.services.size + this.singletonGetters.size;
  }

  /**
   * 取得總項目數（所有服務的 totalItems 加總）
   */
  getTotalItems(): number {
    return this.getAllStats().reduce((sum, stat) => sum + stat.totalItems, 0);
  }
}

/**
 * 導出單例
 */
export const DataStructureRegistry = DataStructureRegistryClass.getInstance();

/**
 * 初始化單例服務的 getter
 *
 * 在應用啟動時呼叫，避免循環依賴問題
 */
export function initializeSingletonGetters(): void {
  // RatesCache
  DataStructureRegistry.registerSingletonGetter('RatesCache', () => {
    try {
      // 動態導入避免循環依賴
       
      const { RatesCache } = require('@/services/monitor/RatesCache');
      const instance = RatesCache.getInstance();
      return isMonitorable(instance) ? instance : null;
    } catch {
      return null;
    }
  });

  // PositionWsHandler
  DataStructureRegistry.registerSingletonGetter('PositionWsHandler', () => {
    try {
       
      const { PositionWsHandler } = require('@/services/websocket/PositionWsHandler');
      const instance = PositionWsHandler.getInstance();
      return isMonitorable(instance) ? instance : null;
    } catch {
      return null;
    }
  });

  // DataSourceManager
  DataStructureRegistry.registerSingletonGetter('DataSourceManager', () => {
    try {
       
      const { DataSourceManager } = require('@/services/monitor/DataSourceManager');
      const instance = DataSourceManager.getInstance();
      return isMonitorable(instance) ? instance : null;
    } catch {
      return null;
    }
  });

  // TriggerDetector
  DataStructureRegistry.registerSingletonGetter('TriggerDetector', () => {
    try {

      const { TriggerDetector } = require('@/services/monitor/TriggerDetector');
      const instance = TriggerDetector.getInstance();
      return isMonitorable(instance) ? instance : null;
    } catch {
      return null;
    }
  });

  // ConnectionPoolManager（WebSocket 訂閱數量彙總）
  DataStructureRegistry.registerSingletonGetter('ConnectionPoolManager', () => {
    try {

      const { ConnectionPoolManager } = require('@/services/websocket/ConnectionPoolManager');
      return isMonitorable(ConnectionPoolManager) ? ConnectionPoolManager : null;
    } catch {
      return null;
    }
  });
}

export default DataStructureRegistry;
