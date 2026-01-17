/**
 * BinanceListenKeyManager
 * Feature: 052-specify-scripts-bash
 * Task: T037
 *
 * 管理 Binance User Data Stream 的 listenKey 生命週期
 * - 建立 listenKey
 * - 定期續期 (每 30 分鐘)
 * - 過期偵測和重建
 */

import { EventEmitter } from 'events';
import { logger } from '../../lib/logger';

// ==================== 類型定義 ====================

/**
 * listenKey 回應
 */
interface ListenKeyResponse {
  listenKey: string;
}

/**
 * API 函式類型
 */
export interface BinanceListenKeyApiOptions {
  /** 建立 listenKey (POST /fapi/v1/listenKey) */
  createListenKey: () => Promise<ListenKeyResponse>;
  /** 續期 listenKey (PUT /fapi/v1/listenKey) */
  renewListenKey: (listenKey: string) => Promise<void>;
  /** 關閉 listenKey (DELETE /fapi/v1/listenKey) */
  closeListenKey?: (listenKey: string) => Promise<void>;
}

/**
 * BinanceListenKeyManager 選項
 */
export interface BinanceListenKeyManagerOptions {
  /** 續期間隔 (毫秒)，預設 30 分鐘 */
  renewalIntervalMs?: number;
  /** listenKey 有效期 (毫秒)，預設 60 分鐘 */
  expirationMs?: number;
  /** 續期失敗最大重試次數 */
  maxRenewalRetries?: number;
  /** 重試間隔 (毫秒) */
  retryIntervalMs?: number;
}

/**
 * listenKey 狀態
 */
export type ListenKeyStatus = 'inactive' | 'creating' | 'active' | 'renewing' | 'expired';

// ==================== BinanceListenKeyManager 類別 ====================

/**
 * BinanceListenKeyManager
 *
 * 負責 Binance Futures User Data Stream 的 listenKey 管理
 */
export class BinanceListenKeyManager extends EventEmitter {
  private listenKey: string | null = null;
  private status: ListenKeyStatus = 'inactive';
  private renewalTimer: NodeJS.Timeout | null = null;
  private createdAt: Date | null = null;
  private lastRenewedAt: Date | null = null;
  private renewalCount = 0;
  private isDestroyed = false;

  private api: BinanceListenKeyApiOptions;
  private options: Required<BinanceListenKeyManagerOptions>;

  constructor(api: BinanceListenKeyApiOptions, options?: BinanceListenKeyManagerOptions) {
    super();
    this.api = api;
    this.options = {
      renewalIntervalMs: options?.renewalIntervalMs ?? 30 * 60 * 1000, // 30 分鐘
      expirationMs: options?.expirationMs ?? 60 * 60 * 1000, // 60 分鐘
      maxRenewalRetries: options?.maxRenewalRetries ?? 3,
      retryIntervalMs: options?.retryIntervalMs ?? 5000,
    };
  }

  /**
   * 建立新的 listenKey
   */
  async create(): Promise<string> {
    if (this.isDestroyed) {
      throw new Error('BinanceListenKeyManager has been destroyed');
    }

    this.status = 'creating';
    this.emit('creating');

    try {
      const response = await this.api.createListenKey();
      this.listenKey = response.listenKey;
      this.createdAt = new Date();
      this.lastRenewedAt = new Date();
      this.renewalCount = 0;
      this.status = 'active';

      // 啟動自動續期
      this.startRenewalTimer();

      logger.info(
        {
          listenKey: this.listenKey.substring(0, 10) + '...',
          renewalIntervalMs: this.options.renewalIntervalMs,
        },
        'Binance listenKey created'
      );

      this.emit('created', this.listenKey);
      return this.listenKey;
    } catch (error) {
      this.status = 'inactive';
      this.emit('createError', error);
      logger.error({ error }, 'Failed to create Binance listenKey');
      throw error;
    }
  }

  /**
   * 續期 listenKey
   */
  async renew(): Promise<void> {
    if (!this.listenKey) {
      throw new Error('No active listenKey to renew');
    }

    if (this.isDestroyed) {
      throw new Error('BinanceListenKeyManager has been destroyed');
    }

    this.status = 'renewing';
    this.emit('renewing');

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRenewalRetries; attempt++) {
      try {
        await this.api.renewListenKey(this.listenKey);
        this.lastRenewedAt = new Date();
        this.renewalCount++;
        this.status = 'active';

        logger.debug(
          {
            listenKey: this.listenKey.substring(0, 10) + '...',
            renewalCount: this.renewalCount,
          },
          'Binance listenKey renewed'
        );

        this.emit('renewed', this.listenKey);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          {
            attempt,
            maxAttempts: this.options.maxRenewalRetries,
            error: lastError.message,
          },
          'listenKey renewal attempt failed'
        );

        if (attempt < this.options.maxRenewalRetries) {
          await this.sleep(this.options.retryIntervalMs);
        }
      }
    }

    // 所有重試失敗
    this.status = 'expired';
    this.emit('renewalFailed', lastError);
    logger.error({ error: lastError }, 'All listenKey renewal attempts failed');
    throw lastError;
  }

  /**
   * 關閉 listenKey
   */
  async close(): Promise<void> {
    if (!this.listenKey) {
      return;
    }

    this.stopRenewalTimer();

    if (this.api.closeListenKey) {
      try {
        await this.api.closeListenKey(this.listenKey);
        logger.debug('Binance listenKey closed');
      } catch (error) {
        logger.warn({ error }, 'Failed to close listenKey');
      }
    }

    this.listenKey = null;
    this.status = 'inactive';
    this.emit('closed');
  }

  /**
   * 重建 listenKey (關閉舊的並建立新的)
   */
  async recreate(): Promise<string> {
    await this.close();
    return this.create();
  }

  /**
   * 取得當前 listenKey
   */
  getListenKey(): string | null {
    return this.listenKey;
  }

  /**
   * 取得狀態
   */
  getStatus(): ListenKeyStatus {
    return this.status;
  }

  /**
   * 檢查 listenKey 是否活躍
   */
  isActive(): boolean {
    return this.listenKey !== null && this.status === 'active' && !this.isDestroyed;
  }

  /**
   * 檢查 listenKey 是否即將過期
   */
  isExpiringSoon(): boolean {
    if (!this.lastRenewedAt) return false;

    const elapsed = Date.now() - this.lastRenewedAt.getTime();
    const threshold = this.options.expirationMs * 0.9; // 90% 的有效期

    return elapsed >= threshold;
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    listenKey: string | null;
    status: ListenKeyStatus;
    createdAt: Date | null;
    lastRenewedAt: Date | null;
    renewalCount: number;
    uptime: number;
    isExpiringSoon: boolean;
  } {
    return {
      listenKey: this.listenKey ? this.listenKey.substring(0, 10) + '...' : null,
      status: this.status,
      createdAt: this.createdAt,
      lastRenewedAt: this.lastRenewedAt,
      renewalCount: this.renewalCount,
      uptime: this.createdAt ? Date.now() - this.createdAt.getTime() : 0,
      isExpiringSoon: this.isExpiringSoon(),
    };
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stopRenewalTimer();
    this.listenKey = null;
    this.status = 'inactive';
    this.removeAllListeners();
    logger.debug('BinanceListenKeyManager destroyed');
  }

  // ==================== 私有方法 ====================

  /**
   * 啟動自動續期計時器
   */
  private startRenewalTimer(): void {
    this.stopRenewalTimer();

    this.renewalTimer = setInterval(async () => {
      if (this.isDestroyed || !this.listenKey) {
        this.stopRenewalTimer();
        return;
      }

      try {
        await this.renew();
      } catch (_error) {
        // renewalFailed 事件已在 renew() 中發出
        // 嘗試重建 listenKey
        try {
          await this.recreate();
          this.emit('recreated', this.listenKey);
        } catch (recreateError) {
          this.emit('recreateFailed', recreateError);
          logger.error({ error: recreateError }, 'Failed to recreate listenKey');
        }
      }
    }, this.options.renewalIntervalMs);

    logger.debug(
      { intervalMs: this.options.renewalIntervalMs },
      'listenKey renewal timer started'
    );
  }

  /**
   * 停止自動續期計時器
   */
  private stopRenewalTimer(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default BinanceListenKeyManager;
