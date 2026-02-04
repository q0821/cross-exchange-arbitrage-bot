/**
 * AssetSnapshotScheduler
 * 資產快照排程服務 - 定期為所有用戶建立資產快照
 *
 * Feature 031: Asset Tracking History (T027-T034)
 *
 * 功能：
 * - 每小時自動為所有有 API Key 的用戶建立資產快照
 * - 批次處理避免 API 過載
 * - 自動清理過期資料（30 天）
 * - 完整錯誤處理和日誌記錄
 */

import { PrismaClient } from '@/generated/prisma/client';
import { logger } from '@lib/logger';
import { AssetSnapshotService } from './AssetSnapshotService';
import {
  AssetSnapshotRepository,
  AssetSnapshotData,
} from '../../repositories/AssetSnapshotRepository';

/**
 * 排程服務狀態
 */
export interface SchedulerStatus {
  isRunning: boolean;
  lastRunTime: Date | null;
  nextRunTime: Date | null;
  totalSnapshots: number;
  consecutiveFailures: number;
}

/**
 * 排程服務配置
 */
interface SchedulerConfig {
  intervalMs: number; // 快照間隔（毫秒）
  batchSize: number; // 批次處理大小
  retentionDays: number; // 資料保留天數
}

const DEFAULT_CONFIG: SchedulerConfig = {
  intervalMs: 60 * 60 * 1000, // 1 小時
  batchSize: 10,
  retentionDays: 30,
};

/**
 * AssetSnapshotScheduler
 * 單例模式排程服務
 */
class AssetSnapshotScheduler {
  private static instance: AssetSnapshotScheduler | null = null;

  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  /** 任務執行中標誌，防止定時觸發與手動觸發重疊執行 */
  private isJobRunning: boolean = false;
  private config: SchedulerConfig;
  private lastRunTime: Date | null = null;
  private totalSnapshots: number = 0;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  private readonly service: AssetSnapshotService;
  private readonly repository: AssetSnapshotRepository;

  private constructor(prisma: PrismaClient) {
    this.service = new AssetSnapshotService(prisma);
    this.repository = new AssetSnapshotRepository(prisma);

    // 從環境變數讀取配置
    const intervalMs = parseInt(
      process.env.ASSET_SNAPSHOT_INTERVAL_MS || String(DEFAULT_CONFIG.intervalMs),
      10
    );

    this.config = {
      intervalMs: isNaN(intervalMs) ? DEFAULT_CONFIG.intervalMs : intervalMs,
      batchSize: DEFAULT_CONFIG.batchSize,
      retentionDays: DEFAULT_CONFIG.retentionDays,
    };

    logger.info(
      {
        intervalMinutes: this.config.intervalMs / 60000,
        batchSize: this.config.batchSize,
        retentionDays: this.config.retentionDays,
      },
      'AssetSnapshotScheduler initialized'
    );
  }

  /**
   * 獲取單例實例
   */
  static getInstance(prisma: PrismaClient): AssetSnapshotScheduler {
    if (!AssetSnapshotScheduler.instance) {
      AssetSnapshotScheduler.instance = new AssetSnapshotScheduler(prisma);
    }
    return AssetSnapshotScheduler.instance;
  }

  /**
   * 啟動排程服務
   */
  async start(): Promise<void> {
    // 檢查是否啟用
    const enabled = process.env.ENABLE_ASSET_SNAPSHOT !== 'false';
    if (!enabled) {
      logger.info('AssetSnapshotScheduler is disabled by ENABLE_ASSET_SNAPSHOT=false');
      return;
    }

    if (this.isRunning) {
      logger.warn('AssetSnapshotScheduler already running');
      return;
    }

    logger.info('Starting AssetSnapshotScheduler...');

    try {
      // 立即執行一次（避免冷啟動）
      await this.runSnapshotJob();

      // 設定定期執行
      this.intervalId = setInterval(() => {
        this.runSnapshotJob().catch((error) => {
          logger.error({ error }, 'Failed to run snapshot job in interval');
        });
      }, this.config.intervalMs);

      this.isRunning = true;

      logger.info(
        {
          intervalMinutes: this.config.intervalMs / 60000,
          nextRunAt: new Date(Date.now() + this.config.intervalMs).toISOString(),
        },
        'AssetSnapshotScheduler started successfully'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to start AssetSnapshotScheduler');
      throw error;
    }
  }

  /**
   * 停止排程服務
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('AssetSnapshotScheduler is not running');
      return;
    }

    logger.info('Stopping AssetSnapshotScheduler...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('AssetSnapshotScheduler stopped');
  }

  /**
   * 獲取排程服務狀態
   */
  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.isRunning
        ? new Date(Date.now() + this.config.intervalMs)
        : null,
      totalSnapshots: this.totalSnapshots,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * 手動觸發一次快照任務
   */
  async manualRun(): Promise<{ success: boolean; snapshotCount: number }> {
    if (this.isJobRunning) {
      logger.warn('Snapshot job already running, manual trigger skipped');
      return { success: false, snapshotCount: 0 };
    }
    logger.info('Manual snapshot job triggered');
    return this.runSnapshotJob();
  }

  /**
   * 執行快照任務
   */
  private async runSnapshotJob(): Promise<{
    success: boolean;
    snapshotCount: number;
  }> {
    // 防止重疊執行
    if (this.isJobRunning) {
      logger.warn('Snapshot job already running, skipping this cycle');
      return { success: false, snapshotCount: 0 };
    }

    this.isJobRunning = true;
    const startTime = Date.now();
    let snapshotCount = 0;

    try {
      logger.info('Starting snapshot job...');

      // 1. 獲取需要建立快照的用戶
      const users = await this.repository.findUsersWithApiKeys();

      if (users.length === 0) {
        logger.info('No users with API keys found, skipping snapshot');
        this.lastRunTime = new Date();
        return { success: true, snapshotCount: 0 };
      }

      logger.info({ userCount: users.length }, 'Found users for snapshot');

      // 2. 批次處理用戶
      const batches = this.chunkArray(users, this.config.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch) continue;

        logger.debug(
          { batchIndex: i + 1, totalBatches: batches.length, batchSize: batch.length },
          'Processing batch'
        );

        // 並行處理批次內的用戶
        const results = await Promise.allSettled(
          batch.map((user) => this.createSnapshotForUser(user.id))
        );

        // 統計結果
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            snapshotCount++;
          }
        }

        // 批次間等待，避免 API 過載
        if (i < batches.length - 1) {
          await this.delay(1000); // 1 秒
        }
      }

      // 3. 清理過期資料
      const deletedCount = await this.service.cleanupOldSnapshots(
        this.config.retentionDays
      );

      if (deletedCount > 0) {
        logger.info({ deletedCount }, 'Cleaned up old snapshots');
      }

      // 更新狀態
      this.lastRunTime = new Date();
      this.totalSnapshots += snapshotCount;
      this.consecutiveFailures = 0;

      const duration = Date.now() - startTime;
      logger.info(
        {
          snapshotCount,
          userCount: users.length,
          durationMs: duration,
        },
        'Snapshot job completed successfully'
      );

      return { success: true, snapshotCount };
    } catch (error) {
      this.consecutiveFailures++;

      logger.error(
        {
          error,
          consecutiveFailures: this.consecutiveFailures,
        },
        'Snapshot job failed'
      );

      // 連續失敗過多，發出警告
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        logger.warn(
          {
            consecutiveFailures: this.consecutiveFailures,
            maxFailures: this.MAX_CONSECUTIVE_FAILURES,
          },
          'AssetSnapshotScheduler has too many consecutive failures'
        );
      }

      return { success: false, snapshotCount };
    } finally {
      // 確保任務標誌被重設
      this.isJobRunning = false;
    }
  }

  /**
   * 為單一用戶建立快照
   */
  private async createSnapshotForUser(
    userId: string
  ): Promise<AssetSnapshotData | null> {
    try {
      const snapshot = await this.service.createSnapshotForUser(userId);
      return snapshot;
    } catch (error) {
      logger.error(
        { error, userId },
        'Failed to create snapshot for user'
      );
      return null;
    }
  }

  /**
   * 將陣列分割成批次
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 延遲執行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 導出工廠函數
let schedulerInstance: AssetSnapshotScheduler | null = null;

export function getAssetSnapshotScheduler(
  prisma: PrismaClient
): AssetSnapshotScheduler {
  if (!schedulerInstance) {
    schedulerInstance = AssetSnapshotScheduler.getInstance(prisma);
  }
  return schedulerInstance;
}

export async function startAssetSnapshotScheduler(
  prisma: PrismaClient
): Promise<void> {
  const scheduler = getAssetSnapshotScheduler(prisma);
  await scheduler.start();
}

export async function stopAssetSnapshotScheduler(): Promise<void> {
  if (schedulerInstance) {
    await schedulerInstance.stop();
  }
}

export function getAssetSnapshotSchedulerStatus(): SchedulerStatus | null {
  return schedulerInstance?.getStatus() ?? null;
}

export { AssetSnapshotScheduler };
