/**
 * CLI 狀態儀表板 - 型別定義
 *
 * @description 定義儀表板所需的所有介面和型別
 * @feature 071-cli-status-dashboard
 */

/**
 * 系統狀態資訊
 */
export interface SystemStatus {
  /** 系統運行時間（秒） */
  uptimeSeconds: number;
  /** 格式化的運行時間 (e.g., "1h 23m 45s") */
  uptimeFormatted: string;
  /** Heap 已使用（MB） */
  heapUsedMB: number;
  /** Heap 總大小（MB） */
  heapTotalMB: number;
  /** Heap 使用率（%） */
  heapUsagePercent: number;
  /** 是否啟用 Proxy */
  proxyEnabled: boolean;
  /** Proxy URL（若啟用） */
  proxyUrl: string | null;
  /** 公開 IP 位址 */
  publicIp: string | null;
}

/**
 * 業務指標資訊
 */
export interface BusinessMetrics {
  /** 當前活躍套利機會數量 */
  activeOpportunities: number;
  /** 最高年化報酬率（%），null 表示無活躍機會 */
  topAPY: number | null;
  /** 監控中的交易對數量 */
  monitoredSymbols: number;
  /** 已連接的交易所數量 */
  connectedExchanges: number;
  /** 交易所清單 */
  exchangeList: string[];
}

/**
 * 單一交易所連線狀態
 */
export interface ExchangeConnectionStatus {
  /** 交易所名稱 */
  exchange: string;
  /** WebSocket 連線狀態 */
  wsStatus: 'connected' | 'disconnected' | 'connecting' | 'unknown';
  /** 目前資料來源模式 */
  dataSourceMode: 'websocket' | 'rest' | 'unknown';
  /** 最後收到資料時間 */
  lastDataTime: Date | null;
}

/**
 * 連線狀態總覽
 */
export interface ConnectionStatus {
  /** 各交易所連線狀態 */
  exchanges: ExchangeConnectionStatus[];
  /** 整體連線健康度（0-100%） */
  overallHealth: number;
  /** 連線中的交易所數量 */
  connectedCount: number;
  /** 總交易所數量 */
  totalCount: number;
}

/**
 * 錯誤統計資訊
 */
export interface ErrorStats {
  /** 累計錯誤次數 */
  totalErrors: number;
  /** 最近錯誤時間 */
  lastErrorTime: Date | null;
}

/**
 * 儀表板完整狀態
 */
export interface DashboardState {
  /** 系統狀態 */
  system: SystemStatus | null;
  /** 業務指標 */
  business: BusinessMetrics | null;
  /** 連線狀態 */
  connection: ConnectionStatus | null;
  /** 錯誤統計 */
  errors: ErrorStats | null;
  /** 最後更新時間 */
  lastUpdated: Date;
  /** 收集是否成功 */
  collectSuccess: boolean;
}

/**
 * 儀表板配置
 */
export interface DashboardConfig {
  /** 是否啟用 */
  enabled: boolean;
  /** 刷新間隔（毫秒） */
  refreshIntervalMs: number;
  /** 是否強制 TTY 模式 */
  forceTty: boolean;
}

/**
 * 渲染器介面
 */
export interface IDashboardRenderer {
  /** 渲染儀表板狀態 */
  render(state: DashboardState): void;
  /** 清理資源 */
  cleanup(): void;
}

/**
 * 狀態收集器介面
 */
export interface IStatusCollector<T> {
  /** 收集狀態資訊 */
  collect(): Promise<T | null>;
  /** 取得收集器名稱（用於錯誤報告） */
  getName(): string;
}

/**
 * 環境變數配置預設值
 */
export const DEFAULT_CONFIG: DashboardConfig = {
  enabled: true,
  refreshIntervalMs: 10000,
  forceTty: false,
};

/**
 * 從環境變數讀取配置
 */
export function loadConfigFromEnv(): DashboardConfig {
  return {
    enabled: process.env.ENABLE_CLI_DASHBOARD !== 'false',
    refreshIntervalMs: parseInt(
      process.env.CLI_DASHBOARD_INTERVAL_MS || '10000',
      10
    ),
    forceTty: process.env.CLI_DASHBOARD_FORCE_TTY === 'true',
  };
}
