/**
 * Graceful Shutdown 模組
 *
 * 提供可測試的 shutdown 邏輯，包含：
 * - 超時強制退出機制
 * - Promise 包裝的 close 函數
 * - 統一的關閉流程
 * - 強制關閉活躍連線（解決 port 佔用問題）
 */

import type { Server as HttpServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import type { PrismaClient } from '@/generated/prisma/client';
import { logger as defaultLogger } from './logger';
import { closeSharedProxyAgent } from './shared-proxy-agent';

// 防止重複執行 shutdown
let isShuttingDown = false;

export interface ShutdownServices {
  /** 停止 FundingRateMonitor */
  stopMonitorService: () => Promise<void>;
  /** 停止 OI 快取服務 */
  stopOIRefreshService: () => Promise<void>;
  /** 停止資產快照排程 */
  stopAssetSnapshotScheduler: () => Promise<void>;
  /** 停止條件單監控 */
  stopConditionalOrderMonitor: () => Promise<void>;
  /** 關閉 Redis 連線 */
  closeRedisClient: () => Promise<void>;
}

export interface ShutdownOptions {
  /** 整體超時時間（毫秒），預設 10000 */
  timeout?: number;
  /** 單一服務關閉超時時間（毫秒），預設 5000 */
  serviceTimeout?: number;
  /** Logger 實例 */
  logger?: typeof defaultLogger;
  /** process.exit 函數（用於測試 mock） */
  exit?: (code: number) => void;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_SERVICE_TIMEOUT = 5000;

/**
 * 將 callback-based 的 close 函數包裝成 Promise，並加入超時機制
 */
export function closeWithTimeout(
  closeFn: (callback: (err?: Error) => void) => void,
  timeoutMs: number,
  serviceName: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${serviceName} close timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    closeFn((err) => {
      clearTimeout(timeout);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 建立 shutdown handler
 *
 * @param services - 需要關閉的服務
 * @param servers - HTTP Server 和 Socket.io Server
 * @param prisma - Prisma Client 實例
 * @param options - 配置選項
 * @returns shutdown 函數
 */
export function createShutdownHandler(
  services: ShutdownServices,
  servers: {
    httpServer: HttpServer;
    io: SocketIOServer;
  },
  prisma: PrismaClient,
  options: ShutdownOptions = {},
): () => Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    serviceTimeout = DEFAULT_SERVICE_TIMEOUT,
    logger = defaultLogger,
    exit = process.exit,
  } = options;

  return async () => {
    // 防止重複執行（例如快速按兩次 Ctrl+C）
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    isShuttingDown = true;

    logger.info('Shutting down server...');

    // 設定超時強制退出
    // 注意：不使用 .unref()，確保 timeout 會 hold 住事件循環
    // 這樣即使有活躍連線，也能在超時後強制退出
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      exit(1);
    }, timeout);

    try {
      // 1. 停止所有背景服務（並行）
      logger.info('Stopping background services...');
      const serviceResults = await Promise.allSettled([
        services.stopMonitorService(),
        services.stopOIRefreshService(),
        services.stopAssetSnapshotScheduler(),
        services.stopConditionalOrderMonitor(),
      ]);

      // 記錄失敗的服務
      const serviceNames = [
        'MonitorService',
        'OIRefreshService',
        'AssetSnapshotScheduler',
        'ConditionalOrderMonitor',
      ];
      serviceResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(
            { service: serviceNames[index], error: result.reason },
            'Service failed to stop',
          );
        }
      });
      logger.info('Background services stopped');

      // 2. 關閉 Redis
      logger.info('Closing Redis connection...');
      await services.closeRedisClient();

      // 2.5. 關閉共享的 ProxyAgent
      logger.info('Closing shared ProxyAgent...');
      await closeSharedProxyAgent();

      // 3. 關閉資料庫連線
      logger.info('Closing database connection...');
      await prisma.$disconnect();
      logger.info('Database connection closed');

      // 4. 關閉 Socket.io（先斷開所有連線）
      logger.info('Closing Socket.io server...');
      // 強制斷開所有 Socket.io 連線
      servers.io.disconnectSockets(true);
      await closeWithTimeout(
        (cb) => servers.io.close(cb),
        serviceTimeout,
        'Socket.io',
      );
      logger.info('Socket.io server closed');

      // 5. 關閉 HTTP Server（先檢查是否正在運行）
      if (servers.httpServer.listening) {
        logger.info('Closing HTTP server...');
        // 強制關閉所有活躍的 TCP 連線（Node.js 18.2+）
        // 這解決了 keep-alive 連線阻止 server.close() 完成的問題
        servers.httpServer.closeAllConnections();
        await closeWithTimeout(
          (cb) => servers.httpServer.close(cb),
          serviceTimeout,
          'HTTP server',
        );
        logger.info('HTTP server closed');
      } else {
        logger.info('HTTP server not running, skipping close');
      }

      clearTimeout(forceExitTimeout);
      logger.info('Graceful shutdown completed');
      exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      logger.error({ error }, 'Error during graceful shutdown');
      exit(1);
    }
  };
}

// 防止 HMR 時重複註冊 signal handlers
declare global {
  // eslint-disable-next-line no-var
  var __shutdownHandlersRegistered: boolean | undefined;
}

/**
 * 註冊 shutdown signal handlers
 * 使用 globalThis 防止 Hot Module Replacement 時重複註冊
 */
export function registerShutdownHandlers(shutdownFn: () => Promise<void>): void {
  if (globalThis.__shutdownHandlersRegistered) {
    return;
  }
  globalThis.__shutdownHandlersRegistered = true;

  process.on('SIGTERM', shutdownFn);
  process.on('SIGINT', shutdownFn);
}

/**
 * 重置 shutdown 狀態（僅供測試使用）
 */
export function resetShutdownState(): void {
  isShuttingDown = false;
  globalThis.__shutdownHandlersRegistered = false;
}
