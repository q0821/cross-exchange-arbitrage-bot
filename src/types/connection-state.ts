/**
 * WebSocket 連線狀態追蹤類型
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 */

import type { ExchangeName } from '@/connectors/types';

/** WebSocket 連線狀態 */
export type ConnectionStatus =
  | 'disconnected'    // 未連線
  | 'connecting'      // 連線中
  | 'connected'       // 已連線
  | 'reconnecting'    // 重連中
  | 'error'           // 錯誤狀態
  | 'fallback_rest';  // 已切換到 REST 備援

/** 連線類型 */
export type ChannelType = 'public' | 'private';

/** 單一連線狀態 */
export interface ConnectionState {
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 頻道類型 */
  type: ChannelType;
  /** 連線狀態 */
  status: ConnectionStatus;
  /** 最後心跳時間 */
  lastHeartbeat: Date | null;
  /** 重連嘗試次數 */
  reconnectAttempts: number;
  /** 最大重連次數 */
  maxReconnectAttempts: number;
  /** 連線建立時間 */
  connectedAt: Date | null;
  /** 最後錯誤訊息 */
  error?: string;
  /** 最後錯誤時間 */
  lastErrorAt?: Date;
  /** 訂閱的頻道列表 */
  subscribedChannels: Set<string>;
}

/** 連線健康度 */
export type ConnectionHealth = 'healthy' | 'degraded' | 'unhealthy';

/** 連線健康度檢查結果 */
export interface ConnectionHealthCheck {
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 頻道類型 */
  type: ChannelType;
  /** 健康度 */
  health: ConnectionHealth;
  /** 連線狀態 */
  status: ConnectionStatus;
  /** 延遲 (ms) */
  latency?: number;
  /** 最後心跳距今時間 (ms) */
  timeSinceLastHeartbeat?: number;
  /** 檢查時間 */
  checkedAt: Date;
}

/** 連線事件類型 */
export type ConnectionEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'reconnected'
  | 'error'
  | 'heartbeat'
  | 'fallback_activated'
  | 'fallback_deactivated';

/** 連線事件 */
export interface ConnectionEvent {
  /** 事件類型 */
  type: ConnectionEventType;
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 頻道類型 */
  channelType: ChannelType;
  /** 事件時間 */
  timestamp: Date;
  /** 額外資訊 */
  details?: {
    /** 重連嘗試次數 */
    reconnectAttempt?: number;
    /** 錯誤訊息 */
    errorMessage?: string;
    /** 錯誤代碼 */
    errorCode?: string;
    /** 延遲 (ms) */
    latency?: number;
  };
}

/** 所有連線狀態管理 */
export interface ConnectionStateManager {
  /** 取得指定交易所的連線狀態 */
  getState(exchange: ExchangeName, type: ChannelType): ConnectionState | undefined;

  /** 取得所有連線狀態 */
  getAllStates(): ConnectionState[];

  /** 更新連線狀態 */
  updateState(exchange: ExchangeName, type: ChannelType, update: Partial<ConnectionState>): void;

  /** 取得連線健康度 */
  getHealth(exchange: ExchangeName, type: ChannelType): ConnectionHealthCheck;

  /** 取得所有連線健康度 */
  getAllHealthChecks(): ConnectionHealthCheck[];

  /** 判斷是否所有連線都健康 */
  isAllHealthy(): boolean;

  /** 取得不健康的連線 */
  getUnhealthyConnections(): ConnectionState[];
}

/** ListenKey 狀態 (Binance/BingX) */
export interface ListenKeyState {
  /** 交易所 */
  exchange: 'binance' | 'bingx';
  /** 用戶 ID */
  userId: string;
  /** Listen Key */
  listenKey: string;
  /** 建立時間 */
  createdAt: Date;
  /** 過期時間 */
  expiresAt: Date;
  /** 最後續期時間 */
  lastRenewed: Date;
  /** 續期失敗次數 */
  renewalFailures: number;
}

/** 用戶私有連線狀態 */
export interface UserPrivateConnection {
  /** 用戶 ID */
  userId: string;
  /** 交易所 */
  exchange: ExchangeName;
  /** API Key ID (關聯到 ApiKey 模型) */
  apiKeyId: string;
  /** 訂閱的頻道 */
  subscriptions: Set<string>;
  /** Listen Key (Binance/BingX 專用) */
  listenKey?: string;
  /** 認證時間 */
  authenticatedAt: Date;
  /** 連線狀態 */
  status: 'authenticating' | 'authenticated' | 'failed' | 'disconnected';
  /** 錯誤訊息 */
  error?: string;
  /** 最後活動時間 */
  lastActivityAt: Date;
}

/** 連線狀態摘要 */
export interface ConnectionSummary {
  /** 總連線數 */
  totalConnections: number;
  /** 已連線數 */
  connectedCount: number;
  /** 重連中數 */
  reconnectingCount: number;
  /** 錯誤數 */
  errorCount: number;
  /** 備援模式數 */
  fallbackCount: number;
  /** 各交易所狀態 */
  byExchange: Record<ExchangeName, {
    public: ConnectionStatus;
    private: ConnectionStatus;
  }>;
  /** 最後更新時間 */
  lastUpdated: Date;
}

/** 預設連線配置 */
export interface ConnectionConfig {
  /** 心跳間隔 (ms) */
  heartbeatInterval: number;
  /** 心跳超時 (ms) */
  heartbeatTimeout: number;
  /** 重連延遲 (ms) */
  reconnectDelay: number;
  /** 最大重連次數 */
  maxReconnectAttempts: number;
  /** 重連延遲倍數 (指數退避) */
  reconnectBackoffMultiplier: number;
  /** 最大重連延遲 (ms) */
  maxReconnectDelay: number;
  /** 連線超時 (ms) */
  connectionTimeout: number;
}

/** 預設連線配置值 */
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  heartbeatInterval: 20000,       // 20 秒
  heartbeatTimeout: 60000,        // 60 秒
  reconnectDelay: 1000,           // 1 秒
  maxReconnectAttempts: 10,
  reconnectBackoffMultiplier: 2,
  maxReconnectDelay: 30000,       // 30 秒
  connectionTimeout: 10000,       // 10 秒
};

/** 建立初始連線狀態 */
export function createInitialConnectionState(
  exchange: ExchangeName,
  type: ChannelType
): ConnectionState {
  return {
    exchange,
    type,
    status: 'disconnected',
    lastHeartbeat: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts,
    connectedAt: null,
    subscribedChannels: new Set(),
  };
}

/** 判斷連線是否健康 */
export function isConnectionHealthy(
  state: ConnectionState,
  config: ConnectionConfig = DEFAULT_CONNECTION_CONFIG
): boolean {
  if (state.status !== 'connected') {
    return false;
  }

  if (!state.lastHeartbeat) {
    return true; // 剛連線，還沒有心跳
  }

  const timeSinceHeartbeat = Date.now() - state.lastHeartbeat.getTime();
  return timeSinceHeartbeat < config.heartbeatTimeout;
}

/** 計算重連延遲 (指數退避) */
export function calculateReconnectDelay(
  attempt: number,
  config: ConnectionConfig = DEFAULT_CONNECTION_CONFIG
): number {
  const delay = config.reconnectDelay * Math.pow(config.reconnectBackoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxReconnectDelay);
}
