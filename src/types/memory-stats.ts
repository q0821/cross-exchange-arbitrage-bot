/**
 * Memory Stats Types
 *
 * 資料結構大小監控的型別定義
 * Feature: 066-memory-monitoring
 */

/**
 * 資料結構統計資訊
 */
export interface DataStructureStats {
  /** 服務名稱 */
  name: string;
  /** 各資料結構的大小（項目數量）*/
  sizes: Record<string, number>;
  /** 總項目數 */
  totalItems: number;
  /** EventEmitter listener 總數（可選，用於追蹤潛在的 listener 洩漏）*/
  eventListenerCount?: number;
  /** 額外診斷資訊（可選，用於儲存服務特定的詳細資料）*/
  details?: Record<string, unknown>;
}

/**
 * 可監控的服務介面
 *
 * 實作此介面的服務可以被 DataStructureRegistry 追蹤
 */
export interface Monitorable {
  /**
   * 取得資料結構統計資訊
   */
  getDataStructureStats(): DataStructureStats;
}

/**
 * 檢查物件是否實作 Monitorable 介面
 */
export function isMonitorable(obj: unknown): obj is Monitorable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getDataStructureStats' in obj &&
    typeof (obj as Monitorable).getDataStructureStats === 'function'
  );
}
