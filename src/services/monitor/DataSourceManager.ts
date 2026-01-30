/**
 * DataSourceManager
 * Feature: 052-specify-scripts-bash
 * Tasks: T051, T052, T053, T054, T055
 *
 * 數據源管理器 - 管理 WebSocket 和 REST 數據源的切換
 * - 當 WebSocket 不可用時自動切換到 REST
 * - 當 WebSocket 恢復時自動切回
 * - 提供統一的數據源狀態查詢和切換事件
 */

import { EventEmitter } from 'events';
import type { ExchangeName } from '../../connectors/types';
import {
  type DataSourceMode,
  type DataType,
  type DataSourceState,
  type DataSourceSwitchEvent,
  type DataSourceSwitchReason,
  type DataSourceConfig,
  type DataSourceSummary,
  type DataSourceHealthCheck,
  type IDataSourceManager,
  DEFAULT_DATA_SOURCE_CONFIG,
  createInitialDataSourceState,
  isDataStale,
  getDataSourceHealth,
  supportsWebSocket,
} from '../../types/data-source';
import type { DataStructureStats, Monitorable } from '../../types/memory-stats';
import { logger } from '../../lib/logger';
import { getEventEmitterStats } from '../../lib/event-emitter-stats';

// ==================== DataSourceManager 類別 ====================

/**
 * DataSourceManager 選項
 */
export interface DataSourceManagerOptions {
  /** 數據源配置 */
  config?: Partial<DataSourceConfig>;
}

/**
 * DataSourceManager
 *
 * 管理多交易所多數據類型的數據源切換
 */
export class DataSourceManager extends EventEmitter implements IDataSourceManager, Monitorable {
  private static instance: DataSourceManager | null = null;

  private states: Map<string, DataSourceState> = new Map();
  private config: DataSourceConfig;
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private staleCheckInterval: NodeJS.Timeout | null = null;

  private constructor(options?: DataSourceManagerOptions) {
    super();
    this.config = {
      ...DEFAULT_DATA_SOURCE_CONFIG,
      ...options?.config,
    };

    // 啟動過期檢查（每 10 秒）
    this.startStaleCheck();
  }

  /**
   * 獲取單例實例
   */
  static getInstance(options?: DataSourceManagerOptions): DataSourceManager {
    if (!DataSourceManager.instance) {
      DataSourceManager.instance = new DataSourceManager(options);
    }
    return DataSourceManager.instance;
  }

  /**
   * 重置單例 (僅用於測試)
   */
  static resetInstance(): void {
    if (DataSourceManager.instance) {
      DataSourceManager.instance.destroy();
      DataSourceManager.instance = null;
    }
  }

  /**
   * 生成狀態鍵值
   */
  private getStateKey(exchange: ExchangeName, dataType: DataType): string {
    return `${exchange}:${dataType}`;
  }

  /**
   * 取得或創建數據源狀態
   */
  private getOrCreateState(exchange: ExchangeName, dataType: DataType): DataSourceState {
    const key = this.getStateKey(exchange, dataType);
    let state = this.states.get(key);

    if (!state) {
      state = createInitialDataSourceState(exchange, dataType, this.config);
      // 如果交易所不支援 WebSocket，預設使用 REST
      if (!supportsWebSocket(exchange, dataType)) {
        state.mode = 'rest';
        state.websocketAvailable = false;
      }
      this.states.set(key, state);
    }

    return state;
  }

  // ==================== IDataSourceManager 介面實作 ====================

  /**
   * 取得指定數據源的狀態
   */
  getState(exchange: ExchangeName, dataType: DataType): DataSourceState | undefined {
    const key = this.getStateKey(exchange, dataType);
    return this.states.get(key);
  }

  /**
   * 取得所有數據源狀態
   */
  getAllStates(): DataSourceState[] {
    return Array.from(this.states.values());
  }

  /**
   * 取得當前模式
   */
  getCurrentMode(exchange: ExchangeName, dataType: DataType): DataSourceMode {
    const state = this.getOrCreateState(exchange, dataType);
    return state.mode;
  }

  /**
   * 切換數據源模式 (T052, T053)
   */
  switchMode(
    exchange: ExchangeName,
    dataType: DataType,
    mode: DataSourceMode,
    reason: DataSourceSwitchReason
  ): void {
    const state = this.getOrCreateState(exchange, dataType);
    const previousMode = state.mode;

    // 如果模式相同，不做任何事
    if (previousMode === mode) {
      return;
    }

    // 更新狀態
    state.mode = mode;
    state.lastSwitchAt = new Date();
    state.switchReason = reason;

    // 更新 WebSocket 可用性
    if (mode === 'websocket') {
      state.websocketAvailable = true;
    } else if (reason === 'websocket_disconnected' || reason === 'websocket_error' || reason === 'websocket_timeout') {
      state.websocketAvailable = false;
    }

    // T055: 記錄切換日誌
    logger.info(
      {
        exchange,
        dataType,
        fromMode: previousMode,
        toMode: mode,
        reason,
      },
      'Data source mode switched'
    );

    // 發送切換事件
    const event: DataSourceSwitchEvent = {
      exchange,
      dataType,
      fromMode: previousMode,
      toMode: mode,
      reason,
      timestamp: new Date(),
    };

    this.emit('switch', event);
  }

  /**
   * 啟用 WebSocket (T052)
   */
  async enableWebSocket(exchange: ExchangeName, dataType: DataType): Promise<void> {
    // 檢查是否支援 WebSocket
    if (!supportsWebSocket(exchange, dataType)) {
      logger.warn(
        { exchange, dataType },
        'WebSocket not supported for this exchange/dataType combination'
      );
      return;
    }

    const state = this.getOrCreateState(exchange, dataType);

    // 如果已經是 WebSocket 模式，只更新狀態
    if (state.mode === 'websocket') {
      state.websocketAvailable = true;
      return;
    }

    // 切換到 WebSocket 模式
    this.switchMode(exchange, dataType, 'websocket', 'websocket_connected');

    logger.info(
      { exchange, dataType },
      'WebSocket enabled for data source'
    );
  }

  /**
   * 停用 WebSocket (切換到 REST) (T052)
   */
  disableWebSocket(exchange: ExchangeName, dataType: DataType, reason: string): void {
    const state = this.getOrCreateState(exchange, dataType);

    // 如果已經是 REST 模式，只更新狀態
    if (state.mode === 'rest') {
      state.websocketAvailable = false;
      state.switchReason = reason;
      return;
    }

    // 決定切換原因
    let switchReason: DataSourceSwitchReason = 'websocket_error';
    if (reason.includes('disconnect')) {
      switchReason = 'websocket_disconnected';
    } else if (reason.includes('timeout')) {
      switchReason = 'websocket_timeout';
    } else if (reason.includes('max reconnect')) {
      switchReason = 'max_reconnect_reached';
    }

    // 切換到 REST 模式
    this.switchMode(exchange, dataType, 'rest', switchReason);

    // 設定恢復計時器 (T053)
    if (this.config.autoSwitch) {
      this.scheduleWebSocketRecovery(exchange, dataType);
    }

    logger.info(
      { exchange, dataType, reason },
      'WebSocket disabled, switched to REST'
    );
  }

  /**
   * 排程 WebSocket 恢復嘗試 (T053)
   */
  private scheduleWebSocketRecovery(exchange: ExchangeName, dataType: DataType): void {
    const key = this.getStateKey(exchange, dataType);

    // 清除現有計時器
    const existingTimer = this.recoveryTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 設定新的恢復計時器
    const timer = setTimeout(async () => {
      this.recoveryTimers.delete(key);
      await this.tryRecoverWebSocket(exchange, dataType);
    }, this.config.recoveryDelay);

    this.recoveryTimers.set(key, timer);

    logger.debug(
      { exchange, dataType, delayMs: this.config.recoveryDelay },
      'WebSocket recovery scheduled'
    );
  }

  /**
   * 嘗試恢復 WebSocket (T053)
   */
  async tryRecoverWebSocket(exchange: ExchangeName, dataType: DataType): Promise<boolean> {
    // 檢查是否支援 WebSocket
    if (!supportsWebSocket(exchange, dataType)) {
      return false;
    }

    const state = this.getOrCreateState(exchange, dataType);

    // 如果已經是 WebSocket 模式，無需恢復
    if (state.mode === 'websocket') {
      return true;
    }

    logger.info(
      { exchange, dataType },
      'Attempting to recover WebSocket connection'
    );

    // 發送恢復嘗試事件，讓外部處理實際的連線邏輯
    this.emit('recoveryAttempt', { exchange, dataType });

    // 實際的連線由外部處理，這裡只返回 false
    // 當連線成功時，外部應呼叫 enableWebSocket()
    return false;
  }

  /**
   * 更新數據接收時間
   */
  updateLastDataReceived(exchange: ExchangeName, dataType: DataType, latency?: number): void {
    const state = this.getOrCreateState(exchange, dataType);
    state.lastDataReceivedAt = new Date();
    if (latency !== undefined) {
      state.latency = latency;
    }
  }

  /**
   * 檢查數據是否過期
   */
  isDataStale(exchange: ExchangeName, dataType: DataType): boolean {
    const state = this.getState(exchange, dataType);
    if (!state) {
      return true;
    }
    return isDataStale(state, this.config);
  }

  /**
   * 註冊切換事件監聽器
   */
  onSwitch(callback: (event: DataSourceSwitchEvent) => void): void {
    this.on('switch', callback);
  }

  /**
   * 移除切換事件監聯器
   */
  offSwitch(callback: (event: DataSourceSwitchEvent) => void): void {
    this.off('switch', callback);
  }

  // ==================== 擴展方法 ====================

  /**
   * 取得數據源摘要
   */
  getSummary(): DataSourceSummary {
    const states = this.getAllStates();
    const byExchange: DataSourceSummary['byExchange'] = {} as any;

    let websocketCount = 0;
    let restCount = 0;
    let hybridCount = 0;

    for (const state of states) {
      // 計算模式數量
      switch (state.mode) {
        case 'websocket':
          websocketCount++;
          break;
        case 'rest':
          restCount++;
          break;
        case 'hybrid':
          hybridCount++;
          break;
      }

      // 按交易所分組
      if (!byExchange[state.exchange]) {
        byExchange[state.exchange] = {} as any;
      }

      switch (state.dataType) {
        case 'fundingRate':
          byExchange[state.exchange].fundingRate = state.mode;
          break;
        case 'position':
          byExchange[state.exchange].position = state.mode;
          break;
        case 'order':
          byExchange[state.exchange].order = state.mode;
          break;
        case 'balance':
          byExchange[state.exchange].balance = state.mode;
          break;
      }
    }

    return {
      total: states.length,
      websocketCount,
      restCount,
      hybridCount,
      byExchange,
      lastUpdated: new Date(),
    };
  }

  /**
   * 取得健康度檢查結果
   */
  getHealthCheck(exchange: ExchangeName, dataType: DataType): DataSourceHealthCheck {
    const state = this.getOrCreateState(exchange, dataType);

    return {
      exchange,
      dataType,
      health: getDataSourceHealth(state, this.config),
      mode: state.mode,
      latency: state.latency,
      isStale: isDataStale(state, this.config),
      checkedAt: new Date(),
    };
  }

  /**
   * 取得所有健康度檢查結果
   */
  getAllHealthChecks(): DataSourceHealthCheck[] {
    return this.getAllStates().map((state) =>
      this.getHealthCheck(state.exchange, state.dataType)
    );
  }

  /**
   * 啟動過期檢查
   */
  private startStaleCheck(): void {
    this.staleCheckInterval = setInterval(() => {
      const staleStates = this.getAllStates().filter((state) =>
        isDataStale(state, this.config)
      );

      if (staleStates.length > 0) {
        logger.warn(
          {
            staleCount: staleStates.length,
            states: staleStates.map((s) => ({
              exchange: s.exchange,
              dataType: s.dataType,
              mode: s.mode,
              lastDataReceivedAt: s.lastDataReceivedAt,
            })),
          },
          'Stale data sources detected'
        );

        // 發送過期事件
        this.emit('stale', staleStates);
      }
    }, 10000); // 每 10 秒檢查
  }

  /**
   * 停止過期檢查
   */
  private stopStaleCheck(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
  }

  /**
   * 取得配置
   */
  getConfig(): DataSourceConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<DataSourceConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };

    logger.info(
      { config: this.config },
      'DataSourceManager config updated'
    );
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const statesSize = this.states.size;
    const recoveryTimersSize = this.recoveryTimers.size;
    const emitterStats = getEventEmitterStats(this);

    return {
      name: 'DataSourceManager',
      sizes: {
        states: statesSize,
        recoveryTimers: recoveryTimersSize,
      },
      totalItems: statesSize + recoveryTimersSize,
      eventListenerCount: emitterStats.totalListeners,
      details: {
        listenersByEvent: emitterStats.listenersByEvent,
        hasStaleCheckInterval: this.staleCheckInterval !== null,
      },
    };
  }

  /**
   * 清除所有狀態
   */
  clear(): void {
    this.states.clear();

    // 清除所有恢復計時器
    for (const timer of this.recoveryTimers.values()) {
      clearTimeout(timer);
    }
    this.recoveryTimers.clear();
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    this.stopStaleCheck();
    this.clear();
    this.removeAllListeners();
    logger.debug('DataSourceManager destroyed');
  }
}

// ==================== 導出 ====================

/**
 * 導出單例訪問方法
 */
export const dataSourceManager = DataSourceManager.getInstance();

export default DataSourceManager;
