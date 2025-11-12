/**
 * HealthChecker
 *
 * 監控 WebSocket 連接健康狀態
 * Feature: 004-fix-okx-add-price-display
 * Task: T029
 */

import { logger } from '../logger.js';

/**
 * 健康檢查配置
 */
export interface HealthCheckConfig {
  /** 健康檢查間隔（毫秒）*/
  checkIntervalMs?: number;
  /** 無訊息超時時間（毫秒）*/
  timeoutMs?: number;
  /** 不健康回調 */
  onUnhealthy?: () => void | Promise<void>;
}

/**
 * 健康狀態
 */
export interface HealthStatus {
  /** 是否健康 */
  isHealthy: boolean;
  /** 最後訊息時間 */
  lastMessageTime: Date | null;
  /** 自最後訊息以來的時間（毫秒）*/
  timeSinceLastMessage: number | null;
}

/**
 * HealthChecker
 *
 * 追蹤 WebSocket 連接的健康狀態：
 * - 追蹤最後訊息時間
 * - 定期檢查是否超時（預設 60 秒無訊息）
 * - 觸發不健康回調
 */
export class HealthChecker {
  private config: Required<Omit<HealthCheckConfig, 'onUnhealthy'>> & {
    onUnhealthy?: () => void | Promise<void>;
  };
  private lastMessageTime: Date | null = null;
  private checkTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: HealthCheckConfig = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 30000, // 30 秒檢查一次
      timeoutMs: config.timeoutMs ?? 60000, // 60 秒無訊息視為不健康
      onUnhealthy: config.onUnhealthy,
    };

    logger.debug({
      config: {
        checkIntervalMs: this.config.checkIntervalMs,
        timeoutMs: this.config.timeoutMs,
      },
    }, 'HealthChecker initialized');
  }

  /**
   * 更新最後訊息時間（當收到訊息時調用）
   */
  recordMessage(): void {
    this.lastMessageTime = new Date();
    logger.debug({
      lastMessageTime: this.lastMessageTime,
    }, 'Message recorded');
  }

  /**
   * 取得健康狀態
   */
  getStatus(): HealthStatus {
    const now = Date.now();
    const timeSinceLastMessage = this.lastMessageTime
      ? now - this.lastMessageTime.getTime()
      : null;

    const isHealthy =
      this.lastMessageTime === null ||
      (timeSinceLastMessage !== null && timeSinceLastMessage < this.config.timeoutMs);

    return {
      isHealthy,
      lastMessageTime: this.lastMessageTime,
      timeSinceLastMessage,
    };
  }

  /**
   * 檢查健康狀態
   */
  private checkHealth(): void {
    const status = this.getStatus();

    if (!status.isHealthy) {
      logger.warn({
        timeSinceLastMessage: status.timeSinceLastMessage,
        timeoutMs: this.config.timeoutMs,
      }, 'WebSocket connection unhealthy - no messages received');

      // 觸發不健康回調
      if (this.config.onUnhealthy) {
        Promise.resolve(this.config.onUnhealthy()).catch((error) => {
          logger.error({
            error: error instanceof Error ? error.message : String(error),
          }, 'onUnhealthy callback failed');
        });
      }
    } else {
      logger.debug({
        timeSinceLastMessage: status.timeSinceLastMessage,
      }, 'WebSocket connection healthy');
    }
  }

  /**
   * 啟動健康檢查
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('HealthChecker already running');
      return;
    }

    this.isRunning = true;
    this.lastMessageTime = new Date(); // 啟動時記錄初始時間

    logger.info({
      checkIntervalMs: this.config.checkIntervalMs,
      timeoutMs: this.config.timeoutMs,
    }, 'HealthChecker started');

    // 設定定期檢查
    this.checkTimer = setInterval(() => {
      this.checkHealth();
    }, this.config.checkIntervalMs);
  }

  /**
   * 停止健康檢查
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    logger.info('HealthChecker stopped');
  }

  /**
   * 重置健康檢查器
   */
  reset(): void {
    this.lastMessageTime = null;
    logger.debug('HealthChecker reset');
  }

  /**
   * 銷毀健康檢查器
   */
  destroy(): void {
    this.stop();
    this.reset();
    logger.debug('HealthChecker destroyed');
  }
}
