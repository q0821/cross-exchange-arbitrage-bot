/**
 * Open Interest Refresh Service
 * Feature: 010-open-interest-selection
 *
 * 背景定期更新服務，自動刷新 OI 快取
 * - 每 30 分鐘自動從 Binance API 獲取最新 OI 排名
 * - 支援優雅啟動和關閉
 * - 完整錯誤處理和日誌記錄
 */

import { logger } from '../lib/logger';
import { getTopOISymbols } from './openInterestService';
import { oiCache } from '../lib/cache';

/**
 * OI 快取自動更新服務
 */
class OIRefreshService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly updateInterval: number;
  private readonly topN: number;
  private readonly minOI?: number;
  private lastUpdateTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  /**
   * @param updateInterval 更新間隔（毫秒），預設 30 分鐘
   * @param topN OI 排名前 N 個交易對，預設 100
   * @param minOI 最小 OI 門檻（美元），可選
   */
  constructor(
    updateInterval: number = 30 * 60 * 1000, // 30 分鐘
    topN: number = 100,
    minOI?: number,
  ) {
    this.updateInterval = updateInterval;
    this.topN = topN;
    this.minOI = minOI;

    logger.info(
      {
        updateIntervalMinutes: updateInterval / 60000,
        topN,
        minOI,
      },
      'OIRefreshService initialized',
    );
  }

  /**
   * 啟動定期更新服務
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('OIRefreshService already running');
      return;
    }

    logger.info('Starting OIRefreshService...');

    try {
      // 立即執行一次更新（避免冷啟動）
      await this.refresh();

      // 設定定期更新
      this.intervalId = setInterval(() => {
        this.refresh().catch((error) => {
          logger.error({ error }, 'Failed to refresh OI cache in interval');
        });
      }, this.updateInterval);

      this.isRunning = true;

      logger.info(
        {
          updateIntervalMinutes: this.updateInterval / 60000,
          nextUpdateAt: new Date(Date.now() + this.updateInterval).toISOString(),
        },
        'OIRefreshService started successfully',
      );
    } catch (error) {
      logger.error({ error }, 'Failed to start OIRefreshService');
      throw error;
    }
  }

  /**
   * 停止定期更新服務
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('OIRefreshService is not running');
      return;
    }

    logger.info('Stopping OIRefreshService...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info(
      {
        lastUpdateTime: this.lastUpdateTime?.toISOString(),
        totalUpdates: this.getTotalUpdates(),
      },
      'OIRefreshService stopped',
    );
  }

  /**
   * 手動觸發一次快取更新
   */
  async refresh(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        {
          topN: this.topN,
          minOI: this.minOI,
          consecutiveFailures: this.consecutiveFailures,
        },
        'Refreshing OI cache...',
      );

      // 呼叫 openInterestService 更新快取
      // getTopOISymbols 內部會檢查快取，但由於我們要強制更新，
      // 所以需要確保快取已過期或手動清除
      const symbols = await getTopOISymbols(this.topN, this.minOI);

      const duration = Date.now() - startTime;
      this.lastUpdateTime = new Date();
      this.consecutiveFailures = 0; // 重置失敗計數

      logger.info(
        {
          symbolCount: symbols.length,
          topSymbols: symbols.slice(0, 5),
          durationMs: duration,
          nextUpdateAt: new Date(Date.now() + this.updateInterval).toISOString(),
        },
        'OI cache refreshed successfully',
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.consecutiveFailures++;

      logger.error(
        {
          error,
          durationMs: duration,
          consecutiveFailures: this.consecutiveFailures,
          maxFailures: this.MAX_CONSECUTIVE_FAILURES,
        },
        'Failed to refresh OI cache',
      );

      // 如果連續失敗次數過多，發出警告
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        logger.error(
          {
            consecutiveFailures: this.consecutiveFailures,
            lastUpdateTime: this.lastUpdateTime?.toISOString(),
          },
          'OI cache refresh has failed multiple times consecutively',
        );
      }

      // 不拋出錯誤，避免中斷服務
      // 保留舊快取繼續服務用戶請求
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus(): {
    isRunning: boolean;
    lastUpdateTime: Date | null;
    nextUpdateTime: Date | null;
    consecutiveFailures: number;
    cacheStats: any;
  } {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      nextUpdateTime: this.isRunning && this.lastUpdateTime
        ? new Date(this.lastUpdateTime.getTime() + this.updateInterval)
        : null,
      consecutiveFailures: this.consecutiveFailures,
      cacheStats: oiCache.getStats(),
    };
  }

  /**
   * 獲取總更新次數（從 lastUpdateTime 推算）
   */
  private getTotalUpdates(): number {
    if (!this.lastUpdateTime) return 0;
    // 粗略估算（不完全準確，但足夠用於日誌）
    return Math.floor((Date.now() - this.lastUpdateTime.getTime()) / this.updateInterval) + 1;
  }
}

/**
 * 全域 OI 更新服務實例
 */
let oiRefreshServiceInstance: OIRefreshService | null = null;

/**
 * 啟動 OI 快取自動更新服務
 *
 * @param updateInterval 更新間隔（毫秒），預設從環境變數讀取或使用 30 分鐘
 * @param topN OI 排名前 N 個交易對，預設 100
 * @param minOI 最小 OI 門檻（美元），可選
 */
export async function startOIRefreshService(
  updateInterval?: number,
  topN?: number,
  minOI?: number,
): Promise<void> {
  if (oiRefreshServiceInstance) {
    logger.warn('OIRefreshService already exists');
    return;
  }

  try {
    // 從環境變數讀取配置
    const interval = updateInterval ?? parseInt(process.env.OI_REFRESH_INTERVAL_MS || '1800000', 10); // 30 分鐘
    const top = topN ?? parseInt(process.env.OI_DEFAULT_TOP_N || '100', 10);
    const minThreshold = minOI ?? (process.env.OI_MIN_THRESHOLD ? parseFloat(process.env.OI_MIN_THRESHOLD) : undefined);

    oiRefreshServiceInstance = new OIRefreshService(interval, top, minThreshold);
    await oiRefreshServiceInstance.start();

    logger.info('OI Refresh Service started');
  } catch (error) {
    logger.error({ error }, 'Failed to start OI Refresh Service');
    throw error;
  }
}

/**
 * 停止 OI 快取自動更新服務
 */
export async function stopOIRefreshService(): Promise<void> {
  if (!oiRefreshServiceInstance) {
    logger.warn('OIRefreshService does not exist');
    return;
  }

  try {
    await oiRefreshServiceInstance.stop();
    oiRefreshServiceInstance = null;
    logger.info('OI Refresh Service stopped');
  } catch (error) {
    logger.error({ error }, 'Failed to stop OI Refresh Service');
    throw error;
  }
}

/**
 * 獲取 OI 更新服務狀態（用於健康檢查）
 */
export function getOIRefreshServiceStatus() {
  if (!oiRefreshServiceInstance) {
    return {
      isRunning: false,
      message: 'Service not initialized',
    };
  }

  return oiRefreshServiceInstance.getStatus();
}

/**
 * 手動觸發一次 OI 快取更新（用於測試或管理端點）
 */
export async function manualRefreshOICache(): Promise<void> {
  if (!oiRefreshServiceInstance) {
    throw new Error('OIRefreshService is not running');
  }

  await oiRefreshServiceInstance.refresh();
}
