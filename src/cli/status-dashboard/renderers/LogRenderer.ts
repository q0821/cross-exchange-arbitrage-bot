/**
 * LogRenderer - 結構化日誌渲染器
 *
 * @description 在非 TTY 環境中使用 Pino 輸出結構化 JSON 日誌
 * @feature 071-cli-status-dashboard
 */

import { createLogger } from '@/lib/logger';
import type {
  DashboardState,
  IDashboardRenderer,
  SystemStatus,
  ConnectionStatus,
} from '../types';

/** 日誌輸出格式 */
interface DashboardLogPayload {
  uptime: string;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  proxy: {
    enabled: boolean;
    url: string | null;
  };
  publicIp: string | null;
  opportunities: number;
  symbols: number;
  exchanges: number;
  wsStatus: {
    connected: number;
    total: number;
  };
  errors: number;
}

export class LogRenderer implements IDashboardRenderer {
  private readonly logger;

  constructor() {
    this.logger = createLogger('cli-dashboard');
  }

  /**
   * 渲染（輸出結構化日誌）
   */
  render(state: DashboardState): void {
    const payload = this.buildLogPayload(state);
    this.logger.info(payload, '狀態儀表板');
  }

  /**
   * 清理（無操作）
   */
  cleanup(): void {
    // LogRenderer 不需要清理
  }

  /**
   * 建構日誌 payload
   */
  private buildLogPayload(state: DashboardState): DashboardLogPayload {
    return {
      uptime: this.getUptime(state.system),
      memory: this.getMemory(state.system),
      proxy: this.getProxy(state.system),
      publicIp: state.system?.publicIp ?? null,
      opportunities: state.business?.activeOpportunities ?? 0,
      symbols: state.business?.monitoredSymbols ?? 0,
      exchanges: state.business?.connectedExchanges ?? 0,
      wsStatus: this.getWsStatus(state.connection),
      errors: state.errors?.totalErrors ?? 0,
    };
  }

  private getUptime(system: SystemStatus | null): string {
    return system?.uptimeFormatted ?? '載入中...';
  }

  private getMemory(system: SystemStatus | null): {
    used: number;
    total: number;
    percent: number;
  } {
    if (!system) {
      return { used: 0, total: 0, percent: 0 };
    }
    return {
      used: system.heapUsedMB,
      total: system.heapTotalMB,
      percent: system.heapUsagePercent,
    };
  }

  private getProxy(system: SystemStatus | null): {
    enabled: boolean;
    url: string | null;
  } {
    if (!system) {
      return { enabled: false, url: null };
    }
    return {
      enabled: system.proxyEnabled,
      url: system.proxyUrl,
    };
  }

  private getWsStatus(connection: ConnectionStatus | null): {
    connected: number;
    total: number;
  } {
    if (!connection) {
      return { connected: 0, total: 0 };
    }
    return {
      connected: connection.connectedCount,
      total: connection.totalCount,
    };
  }
}
