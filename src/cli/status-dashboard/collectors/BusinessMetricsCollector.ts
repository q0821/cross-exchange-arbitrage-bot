/**
 * BusinessMetricsCollector - 業務指標收集器
 *
 * @description 收集套利機會數量、最高 APY、監控交易對數量、交易所連接數
 * @feature 071-cli-status-dashboard
 */

import { getMonitorInstance, getTrackerInstance } from '@/services/MonitorService';
import { ACTIVE_EXCHANGES, EXCHANGE_CONFIGS } from '@/lib/exchanges/constants';
import type { IStatusCollector, BusinessMetrics } from '../types';

export class BusinessMetricsCollector implements IStatusCollector<BusinessMetrics> {
  /**
   * 收集業務指標
   */
  async collect(): Promise<BusinessMetrics> {
    const [opportunities, topAPY, symbols, exchanges] = await Promise.all([
      this.collectOpportunities(),
      this.collectTopAPY(),
      this.collectMonitoredSymbols(),
      this.collectExchanges(),
    ]);

    return {
      activeOpportunities: opportunities,
      topAPY,
      monitoredSymbols: symbols,
      connectedExchanges: exchanges.count,
      exchangeList: exchanges.list,
    };
  }

  /**
   * 取得收集器名稱
   */
  getName(): string {
    return 'BusinessMetricsCollector';
  }

  /**
   * 收集活躍套利機會數量
   */
  private collectOpportunities(): number {
    try {
      const monitor = getMonitorInstance();
      if (!monitor) return 0;
      const stats = monitor.getStats();
      return stats.activeOpportunities ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 收集最高年化報酬率
   */
  private collectTopAPY(): number | null {
    try {
      const tracker = getTrackerInstance();
      if (!tracker) return null;
      return tracker.getTopAPY();
    } catch {
      return null;
    }
  }

  /**
   * 收集監控中的交易對數量
   */
  private collectMonitoredSymbols(): number {
    try {
      const monitor = getMonitorInstance();
      if (!monitor) return 0;
      const status = monitor.getStatus();
      return status.symbols?.length ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 收集交易所資訊
   */
  private collectExchanges(): { count: number; list: string[] } {
    const count = ACTIVE_EXCHANGES.length;
    const list = ACTIVE_EXCHANGES.map((exchange) => {
      const config = EXCHANGE_CONFIGS[exchange];
      return config?.displayName ?? exchange;
    });

    return { count, list };
  }
}
