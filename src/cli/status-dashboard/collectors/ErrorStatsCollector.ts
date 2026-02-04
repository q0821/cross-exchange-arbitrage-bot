/**
 * ErrorStatsCollector - 錯誤統計收集器
 *
 * @description 收集累計錯誤次數
 * @feature 071-cli-status-dashboard
 */

import { getMonitorInstance } from '@/services/MonitorService';
import type { IStatusCollector, ErrorStats } from '../types';

export class ErrorStatsCollector implements IStatusCollector<ErrorStats> {
  /**
   * 收集錯誤統計
   */
  async collect(): Promise<ErrorStats> {
    try {
      const monitor = getMonitorInstance();
      if (!monitor) {
        return {
          totalErrors: 0,
          lastErrorTime: null,
        };
      }

      const stats = monitor.getStats();
      return {
        totalErrors: stats.errorCount ?? 0,
        lastErrorTime: null, // 目前 MonitorStats 不提供此資訊
      };
    } catch {
      // 監控服務尚未初始化
      return {
        totalErrors: 0,
        lastErrorTime: null,
      };
    }
  }

  /**
   * 取得收集器名稱
   */
  getName(): string {
    return 'ErrorStatsCollector';
  }
}
