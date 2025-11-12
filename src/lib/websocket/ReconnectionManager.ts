/**
 * ReconnectionManager
 *
 * 管理 WebSocket 重連策略，實作指數退避和 Jitter
 * Feature: 004-fix-okx-add-price-display
 * Task: T028
 */

import { logger } from '../logger.js';

/**
 * 重連配置
 */
export interface ReconnectionConfig {
  /** 初始延遲（毫秒）*/
  initialDelayMs?: number;
  /** 最大延遲（毫秒）*/
  maxDelayMs?: number;
  /** 最大重試次數（0 = 無限制）*/
  maxRetries?: number;
  /** 指數退避因子 */
  backoffFactor?: number;
  /** Jitter 範圍（0-1，表示延遲的百分比）*/
  jitterRange?: number;
}

/**
 * 重連狀態
 */
export interface ReconnectionState {
  /** 當前重試次數 */
  retryCount: number;
  /** 下次重連延遲（毫秒）*/
  nextDelayMs: number;
  /** 是否已達到最大重試次數 */
  maxRetriesReached: boolean;
}

/**
 * ReconnectionManager
 *
 * 實作指數退避重連策略：
 * - 延遲 = min(initialDelay * (backoffFactor ^ retryCount), maxDelay)
 * - Jitter = delay * (1 ± jitterRange * random())
 */
export class ReconnectionManager {
  private config: Required<ReconnectionConfig>;
  private retryCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: ReconnectionConfig = {}) {
    this.config = {
      initialDelayMs: config.initialDelayMs ?? 1000, // 1 秒
      maxDelayMs: config.maxDelayMs ?? 30000, // 30 秒
      maxRetries: config.maxRetries ?? 0, // 0 = 無限制
      backoffFactor: config.backoffFactor ?? 2, // 每次加倍
      jitterRange: config.jitterRange ?? 0.1, // ±10%
    };

    logger.debug({
      config: this.config,
    }, 'ReconnectionManager initialized');
  }

  /**
   * 計算下次重連延遲（包含指數退避和 Jitter）
   */
  calculateDelay(): number {
    // 指數退避：initialDelay * (backoffFactor ^ retryCount)
    const exponentialDelay =
      this.config.initialDelayMs * Math.pow(this.config.backoffFactor, this.retryCount);

    // 限制最大延遲
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // 加入 Jitter：delay * (1 ± jitterRange * random())
    const jitterFactor = 1 + (Math.random() * 2 - 1) * this.config.jitterRange;
    const delayWithJitter = cappedDelay * jitterFactor;

    return Math.floor(delayWithJitter);
  }

  /**
   * 取得當前狀態
   */
  getState(): ReconnectionState {
    const maxRetriesReached =
      this.config.maxRetries > 0 && this.retryCount >= this.config.maxRetries;

    return {
      retryCount: this.retryCount,
      nextDelayMs: this.calculateDelay(),
      maxRetriesReached,
    };
  }

  /**
   * 檢查是否可以重試
   */
  canRetry(): boolean {
    if (this.config.maxRetries === 0) {
      return true; // 無限制
    }
    return this.retryCount < this.config.maxRetries;
  }

  /**
   * 增加重試次數
   */
  incrementRetry(): void {
    this.retryCount++;
    logger.debug({
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      nextDelayMs: this.calculateDelay(),
    }, 'Retry count incremented');
  }

  /**
   * 重置重試計數器
   */
  reset(): void {
    this.retryCount = 0;
    this.clearTimer();
    logger.debug('Reconnection manager reset');
  }

  /**
   * 排程重連
   * @param callback 重連回調函數
   * @returns 延遲時間（毫秒）
   */
  scheduleReconnect(callback: () => void | Promise<void>): number {
    if (!this.canRetry()) {
      logger.warn({
        retryCount: this.retryCount,
        maxRetries: this.config.maxRetries,
      }, 'Max retries reached, not scheduling reconnect');
      return 0;
    }

    const delay = this.calculateDelay();
    this.incrementRetry();

    logger.info({
      delay,
      retryCount: this.retryCount,
    }, 'Scheduling reconnect');

    this.clearTimer();
    this.reconnectTimer = setTimeout(() => {
      logger.info('Executing scheduled reconnect');
      Promise.resolve(callback()).catch((error) => {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, 'Reconnect callback failed');
      });
    }, delay);

    return delay;
  }

  /**
   * 取消排程的重連
   */
  clearTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    this.clearTimer();
    this.retryCount = 0;
    logger.debug('ReconnectionManager destroyed');
  }
}
