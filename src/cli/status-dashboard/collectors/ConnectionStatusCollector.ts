/**
 * ConnectionStatusCollector - 連線狀態收集器
 *
 * @description 收集各交易所 WebSocket 連線狀態
 * @feature 071-cli-status-dashboard
 */

import { DataSourceManager } from '@/services/monitor/DataSourceManager';
import { ACTIVE_EXCHANGES, EXCHANGE_CONFIGS } from '@/lib/exchanges/constants';
import type {
  IStatusCollector,
  ConnectionStatus,
  ExchangeConnectionStatus,
} from '../types';
import type { DataSourceSummary } from '@/types/data-source';

export class ConnectionStatusCollector
  implements IStatusCollector<ConnectionStatus>
{
  /**
   * 收集連線狀態
   */
  async collect(): Promise<ConnectionStatus> {
    let summary: DataSourceSummary | null = null;

    try {
      const manager = DataSourceManager.getInstance();
      summary = manager.getSummary();
    } catch {
      // DataSourceManager 尚未初始化
    }

    const exchanges = this.buildExchangeStatuses(summary);
    const connectedCount = exchanges.filter(
      (e) => e.wsStatus === 'connected'
    ).length;
    const totalCount = exchanges.length;
    const overallHealth =
      totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0;

    return {
      exchanges,
      connectedCount,
      totalCount,
      overallHealth,
    };
  }

  /**
   * 取得收集器名稱
   */
  getName(): string {
    return 'ConnectionStatusCollector';
  }

  /**
   * 建構各交易所狀態列表
   */
  private buildExchangeStatuses(
    summary: DataSourceSummary | null
  ): ExchangeConnectionStatus[] {
    return ACTIVE_EXCHANGES.map((exchangeId) => {
      const config = EXCHANGE_CONFIGS[exchangeId];
      const displayName = config?.displayName ?? exchangeId;

      // 從 summary 取得資料來源模式
      const exchangeData = summary?.byExchange?.[exchangeId];
      const dataSourceMode = exchangeData?.fundingRate ?? 'unknown';

      // 判斷 WebSocket 狀態
      let wsStatus: ExchangeConnectionStatus['wsStatus'];
      if (!summary) {
        wsStatus = 'unknown';
      } else if (dataSourceMode === 'websocket') {
        wsStatus = 'connected';
      } else if (dataSourceMode === 'rest') {
        wsStatus = 'disconnected';
      } else {
        wsStatus = 'unknown';
      }

      return {
        exchange: displayName,
        wsStatus,
        dataSourceMode: dataSourceMode as ExchangeConnectionStatus['dataSourceMode'],
        lastDataTime: null, // 可從 DataSourceManager 取得，但目前省略
      };
    });
  }
}
