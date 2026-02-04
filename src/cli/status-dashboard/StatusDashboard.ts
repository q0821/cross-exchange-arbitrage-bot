/**
 * StatusDashboard 核心類別
 *
 * @description CLI 狀態儀表板的主入口，負責協調收集器和渲染器
 * @feature 071-cli-status-dashboard
 */

import { logger } from '@/lib/logger';
import type {
  DashboardConfig,
  DashboardState,
  IDashboardRenderer,
  IStatusCollector,
  SystemStatus,
  BusinessMetrics,
  ConnectionStatus,
  ErrorStats,
} from './types';

type CollectorKey = 'system' | 'business' | 'connection' | 'errors';

export class StatusDashboard {
  private readonly config: DashboardConfig;
  private readonly renderer: IDashboardRenderer;
  private readonly collectors: Map<
    CollectorKey,
    IStatusCollector<SystemStatus | BusinessMetrics | ConnectionStatus | ErrorStats>
  > = new Map();

  private refreshTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: DashboardConfig, renderer: IDashboardRenderer) {
    this.config = config;
    this.renderer = renderer;
  }

  /**
   * 註冊收集器
   */
  registerCollector<T extends SystemStatus | BusinessMetrics | ConnectionStatus | ErrorStats>(
    key: CollectorKey,
    collector: IStatusCollector<T>
  ): void {
    this.collectors.set(key, collector as IStatusCollector<SystemStatus | BusinessMetrics | ConnectionStatus | ErrorStats>);
  }

  /**
   * 啟動儀表板
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug({ context: 'cli-dashboard' }, '儀表板已停用');
      return;
    }

    if (this.isRunning) {
      logger.debug({ context: 'cli-dashboard' }, '儀表板已在運行中');
      return;
    }

    this.isRunning = true;
    logger.info({ context: 'cli-dashboard' }, '啟動 CLI 狀態儀表板');

    // 首次渲染
    await this.refresh();

    // 設定定時刷新
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) => {
        logger.error(
          { context: 'cli-dashboard', error: String(error) },
          '定時刷新失敗'
        );
      });
    }, this.config.refreshIntervalMs);
  }

  /**
   * 停止儀表板
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.isRunning) {
      this.renderer.cleanup();
      this.isRunning = false;
      logger.info({ context: 'cli-dashboard' }, '停止 CLI 狀態儀表板');
    }
  }

  /**
   * 手動刷新
   */
  async refresh(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const state = await this.collectState();
    this.renderer.render(state);
  }

  /**
   * 收集所有狀態
   */
  private async collectState(): Promise<DashboardState> {
    const results = await Promise.allSettled(
      Array.from(this.collectors.entries()).map(async ([key, collector]) => {
        try {
          const data = await collector.collect();
          return { key, data };
        } catch (error) {
          logger.warn(
            {
              context: 'cli-dashboard',
              collector: collector.getName(),
              error: String(error),
            },
            '收集器執行失敗'
          );
          return { key, data: null };
        }
      })
    );

    let collectSuccess = true;
    const state: DashboardState = {
      system: null,
      business: null,
      connection: null,
      errors: null,
      lastUpdated: new Date(),
      collectSuccess: true,
    };

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { key, data } = result.value;
        if (data === null) {
          collectSuccess = false;
        }
        switch (key) {
          case 'system':
            state.system = data as SystemStatus | null;
            break;
          case 'business':
            state.business = data as BusinessMetrics | null;
            break;
          case 'connection':
            state.connection = data as ConnectionStatus | null;
            break;
          case 'errors':
            state.errors = data as ErrorStats | null;
            break;
        }
      } else {
        collectSuccess = false;
      }
    }

    state.collectSuccess = collectSuccess;
    return state;
  }

  /**
   * 取得運行狀態
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
