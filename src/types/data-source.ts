/**
 * 數據源模式類型定義
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 */

import type { ExchangeName } from '@/connectors/types';

/** 數據源模式 */
export type DataSourceMode = 'websocket' | 'rest' | 'hybrid';

/** 數據類型 */
export type DataType =
  | 'fundingRate'     // 資金費率
  | 'position'        // 持倉
  | 'order'           // 訂單
  | 'balance'         // 餘額
  | 'ticker';         // 行情

/** 單一數據源狀態 */
export interface DataSourceState {
  /** 交易所 */
  exchange: ExchangeName;
  /** 數據類型 */
  dataType: DataType;
  /** 當前模式 */
  mode: DataSourceMode;
  /** WebSocket 是否可用 */
  websocketAvailable: boolean;
  /** REST 是否可用 */
  restAvailable: boolean;
  /** 最後切換時間 */
  lastSwitchAt: Date | null;
  /** 切換原因 */
  switchReason?: string;
  /** 最後數據接收時間 */
  lastDataReceivedAt: Date | null;
  /** 數據延遲 (ms) */
  latency?: number;
}

/** 數據源切換事件 */
export interface DataSourceSwitchEvent {
  /** 交易所 */
  exchange: ExchangeName;
  /** 數據類型 */
  dataType: DataType;
  /** 切換前模式 */
  fromMode: DataSourceMode;
  /** 切換後模式 */
  toMode: DataSourceMode;
  /** 切換原因 */
  reason: DataSourceSwitchReason;
  /** 切換時間 */
  timestamp: Date;
}

/** 數據源切換原因 */
export type DataSourceSwitchReason =
  | 'websocket_connected'      // WebSocket 連線成功
  | 'websocket_disconnected'   // WebSocket 斷線
  | 'websocket_error'          // WebSocket 錯誤
  | 'websocket_timeout'        // WebSocket 超時
  | 'max_reconnect_reached'    // 達到最大重連次數
  | 'manual_switch'            // 手動切換
  | 'rest_fallback'            // REST 備援啟動
  | 'websocket_recovered';     // WebSocket 恢復

/** 數據源配置 */
export interface DataSourceConfig {
  /** 偏好模式 */
  preferredMode: DataSourceMode;
  /** 是否啟用自動切換 */
  autoSwitch: boolean;
  /** WebSocket 失敗後切換到 REST 的延遲 (ms) */
  fallbackDelay: number;
  /** WebSocket 恢復後切回的延遲 (ms) */
  recoveryDelay: number;
  /** REST 輪詢間隔 (ms) */
  restPollingInterval: number;
  /** 數據過期時間 (ms) */
  dataStaleThreshold: number;
}

/** 預設數據源配置 */
export const DEFAULT_DATA_SOURCE_CONFIG: DataSourceConfig = {
  preferredMode: 'websocket',
  autoSwitch: true,
  fallbackDelay: 5000,        // 5 秒後切換到 REST
  recoveryDelay: 10000,       // 10 秒後切回 WebSocket
  restPollingInterval: 5000,  // REST 輪詢 5 秒
  dataStaleThreshold: 30000,  // 30 秒沒有數據視為過期（預設值，各交易所可覆寫）
};

/**
 * 各交易所的數據過期閾值 (ms)
 *
 * 根據各交易所 WebSocket 推送頻率設定：
 * - Binance: markPrice 每 1 秒推送，設 30 秒
 * - OKX: funding-rate 每 60 秒推送，設 90 秒
 * - Gate.io: futures.tickers 每 1 秒推送，設 30 秒
 * - MEXC: 透過 CCXT watch，設 60 秒
 * - BingX: markPrice 每 1 秒推送，設 30 秒
 */
export const EXCHANGE_STALE_THRESHOLDS: Record<ExchangeName, number> = {
  binance: 30000,   // 30 秒
  okx: 90000,       // 90 秒（funding-rate 每 60 秒推送一次）
  gateio: 30000,    // 30 秒
  mexc: 60000,      // 60 秒
  bingx: 30000,     // 30 秒
};

/**
 * 取得指定交易所的數據過期閾值
 */
export function getExchangeStaleThreshold(exchange: ExchangeName): number {
  return EXCHANGE_STALE_THRESHOLDS[exchange] ?? DEFAULT_DATA_SOURCE_CONFIG.dataStaleThreshold;
}

/** 數據源管理器介面 */
export interface IDataSourceManager {
  /** 取得指定數據源的狀態 */
  getState(exchange: ExchangeName, dataType: DataType): DataSourceState | undefined;

  /** 取得所有數據源狀態 */
  getAllStates(): DataSourceState[];

  /** 取得當前模式 */
  getCurrentMode(exchange: ExchangeName, dataType: DataType): DataSourceMode;

  /** 切換數據源模式 */
  switchMode(
    exchange: ExchangeName,
    dataType: DataType,
    mode: DataSourceMode,
    reason: DataSourceSwitchReason
  ): void;

  /** 啟用 WebSocket */
  enableWebSocket(exchange: ExchangeName, dataType: DataType): Promise<void>;

  /** 停用 WebSocket (切換到 REST) */
  disableWebSocket(exchange: ExchangeName, dataType: DataType, reason: string): void;

  /** 嘗試恢復 WebSocket */
  tryRecoverWebSocket(exchange: ExchangeName, dataType: DataType): Promise<boolean>;

  /** 更新數據接收時間 */
  updateLastDataReceived(exchange: ExchangeName, dataType: DataType, latency?: number): void;

  /** 檢查數據是否過期 */
  isDataStale(exchange: ExchangeName, dataType: DataType): boolean;

  /** 註冊切換事件監聽器 */
  onSwitch(callback: (event: DataSourceSwitchEvent) => void): void;

  /** 移除切換事件監聽器 */
  offSwitch(callback: (event: DataSourceSwitchEvent) => void): void;
}

/** 數據源摘要 */
export interface DataSourceSummary {
  /** 總數據源數 */
  total: number;
  /** WebSocket 模式數 */
  websocketCount: number;
  /** REST 模式數 */
  restCount: number;
  /** 混合模式數 */
  hybridCount: number;
  /** 各交易所狀態 */
  byExchange: Record<ExchangeName, {
    fundingRate: DataSourceMode;
    position?: DataSourceMode;
    order?: DataSourceMode;
    balance?: DataSourceMode;
  }>;
  /** 最後更新時間 */
  lastUpdated: Date;
}

/** 數據源健康度 */
export type DataSourceHealth = 'optimal' | 'degraded' | 'fallback';

/** 數據源健康度檢查 */
export interface DataSourceHealthCheck {
  /** 交易所 */
  exchange: ExchangeName;
  /** 數據類型 */
  dataType: DataType;
  /** 健康度 */
  health: DataSourceHealth;
  /** 當前模式 */
  mode: DataSourceMode;
  /** 數據延遲 (ms) */
  latency?: number;
  /** 數據是否過期 */
  isStale: boolean;
  /** 檢查時間 */
  checkedAt: Date;
}

/** 建立初始數據源狀態 */
export function createInitialDataSourceState(
  exchange: ExchangeName,
  dataType: DataType,
  config: DataSourceConfig = DEFAULT_DATA_SOURCE_CONFIG
): DataSourceState {
  return {
    exchange,
    dataType,
    mode: config.preferredMode,
    websocketAvailable: false,
    restAvailable: true,
    lastSwitchAt: null,
    lastDataReceivedAt: null,
  };
}

/**
 * 判斷數據是否過期
 *
 * 優先使用各交易所特定的閾值（EXCHANGE_STALE_THRESHOLDS），
 * 若未設定則使用 config 中的預設值。
 *
 * @param state - 數據源狀態
 * @param config - 數據源配置（用於未設定交易所特定閾值時的 fallback）
 */
export function isDataStale(
  state: DataSourceState,
  config: DataSourceConfig = DEFAULT_DATA_SOURCE_CONFIG
): boolean {
  if (!state.lastDataReceivedAt) {
    return true;
  }

  // 優先使用交易所特定的閾值，若未設定則使用 config 中的預設值
  const threshold = EXCHANGE_STALE_THRESHOLDS[state.exchange] ?? config.dataStaleThreshold;
  const timeSinceLastData = Date.now() - state.lastDataReceivedAt.getTime();
  return timeSinceLastData > threshold;
}

/** 取得數據源健康度 */
export function getDataSourceHealth(
  state: DataSourceState,
  config: DataSourceConfig = DEFAULT_DATA_SOURCE_CONFIG
): DataSourceHealth {
  // 使用 WebSocket 且數據新鮮 = optimal
  if (state.mode === 'websocket' && !isDataStale(state, config)) {
    return 'optimal';
  }

  // 使用 REST 或混合模式 = degraded
  if (state.mode === 'rest' || state.mode === 'hybrid') {
    return isDataStale(state, config) ? 'fallback' : 'degraded';
  }

  // 數據過期 = fallback
  return 'fallback';
}

/** 交易所支援的數據源能力 */
export interface ExchangeDataSourceCapabilities {
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 支援的數據類型及其 WebSocket 支援狀態 */
  capabilities: {
    fundingRate: {
      websocket: boolean;
      rest: boolean;
      method?: 'ccxt' | 'native';  // ccxt = 使用 CCXT watchFundingRate, native = 自行實作
    };
    position?: {
      websocket: boolean;
      rest: boolean;
      method?: 'ccxt' | 'native';
    };
    order?: {
      websocket: boolean;
      rest: boolean;
      method?: 'ccxt' | 'native';
    };
    balance?: {
      websocket: boolean;
      rest: boolean;
      method?: 'ccxt' | 'native';
    };
  };
}

/** 各交易所數據源能力定義 */
export const EXCHANGE_DATA_SOURCE_CAPABILITIES: Record<ExchangeName, ExchangeDataSourceCapabilities> = {
  binance: {
    exchange: 'binance',
    capabilities: {
      fundingRate: { websocket: true, rest: true, method: 'native' },
      position: { websocket: true, rest: true, method: 'native' },
      order: { websocket: true, rest: true, method: 'native' },
      balance: { websocket: true, rest: true, method: 'native' },
    },
  },
  okx: {
    exchange: 'okx',
    capabilities: {
      // Feature 054: 使用原生 WebSocket 客戶端 (OkxFundingWs)
      fundingRate: { websocket: true, rest: true, method: 'native' },
      position: { websocket: true, rest: true, method: 'ccxt' },
      order: { websocket: true, rest: true, method: 'ccxt' },
      balance: { websocket: true, rest: true, method: 'ccxt' },
    },
  },
  gateio: {
    exchange: 'gateio',
    capabilities: {
      // Feature 054: 使用原生 WebSocket 客戶端 (GateioFundingWs)
      fundingRate: { websocket: true, rest: true, method: 'native' },
      position: { websocket: true, rest: true, method: 'ccxt' },
      order: { websocket: true, rest: true, method: 'ccxt' },
      balance: { websocket: true, rest: true, method: 'ccxt' },
    },
  },
  mexc: {
    exchange: 'mexc',
    capabilities: {
      fundingRate: { websocket: true, rest: true, method: 'ccxt' },
      // MEXC 不支援 API 交易，所以不需要持倉/訂單/餘額監控
    },
  },
  bingx: {
    exchange: 'bingx',
    capabilities: {
      // Feature 054: 使用原生 WebSocket 客戶端 (BingxFundingWs)
      fundingRate: { websocket: true, rest: true, method: 'native' },
      position: { websocket: true, rest: true, method: 'native' },
      order: { websocket: true, rest: true, method: 'native' },
      balance: { websocket: true, rest: true, method: 'native' },
    },
  },
};

/** 支援的數據類型（不含 ticker） */
type SupportedDataType = Exclude<DataType, 'ticker'>;

/** 檢查交易所是否支援指定數據類型的 WebSocket */
export function supportsWebSocket(exchange: ExchangeName, dataType: DataType): boolean {
  // ticker 類型暫不支援 WebSocket 資金費率功能
  if (dataType === 'ticker') return false;

  const capabilities = EXCHANGE_DATA_SOURCE_CAPABILITIES[exchange];
  if (!capabilities) return false;

  const dataCapability = capabilities.capabilities[dataType as SupportedDataType];
  return dataCapability?.websocket ?? false;
}

/** 取得交易所的實作方法 */
export function getImplementationMethod(
  exchange: ExchangeName,
  dataType: DataType
): 'ccxt' | 'native' | 'rest' | undefined {
  // ticker 類型暫不支援
  if (dataType === 'ticker') return undefined;

  const capabilities = EXCHANGE_DATA_SOURCE_CAPABILITIES[exchange];
  if (!capabilities) return undefined;

  const dataCapability = capabilities.capabilities[dataType as SupportedDataType];
  if (!dataCapability) return undefined;

  if (dataCapability.websocket) {
    return dataCapability.method ?? 'native';
  }

  return dataCapability.rest ? 'rest' : undefined;
}
