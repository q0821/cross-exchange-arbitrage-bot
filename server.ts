import { createServer } from 'http';
import { parse } from 'url';
import { execFileSync } from 'child_process';
import v8 from 'v8';
import next from 'next';
import { initializeSocketServer } from './src/websocket/SocketServer';
import { logger } from './src/lib/logger';
import { startMonitorService, stopMonitorService } from './src/services/MonitorService';
import { startOIRefreshService, stopOIRefreshService } from './src/services/OIRefreshService';
import {
  startAssetSnapshotScheduler,
  stopAssetSnapshotScheduler,
} from './src/services/assets/AssetSnapshotScheduler';
import { createPrismaClient } from './src/lib/prisma-factory';
import { closeRedisClient } from './src/lib/redis';
import { stopMonitor as stopConditionalOrderMonitor } from './src/lib/monitor-init';
import {
  createShutdownHandler,
  registerShutdownHandlers,
  type ShutdownServices,
} from './src/lib/graceful-shutdown';
import { createStatusDashboard } from './src/cli/status-dashboard';

// 在啟動時執行 Prisma migration
function runMigrations(): void {
  console.log('> Running database migrations...');
  try {
    const output = execFileSync('pnpm', ['prisma', 'migrate', 'deploy'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output);
    console.log('> Database migrations completed');
  } catch (error) {
    // Migration 可能因為「沒有待執行的 migration」而輸出到 stderr，這不是錯誤
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    if (execError.stdout) {
      console.log(execError.stdout);
    }
    if (execError.stderr && !execError.stderr.includes('No pending migrations')) {
      console.error('> Migration warning:', execError.stderr);
    }
    // 只有在 exit code 非 0 時才記錄錯誤，但不要阻止啟動
    if (execError.status && execError.status !== 0) {
      logger.warn({ error }, 'Migration returned non-zero exit code, but continuing startup');
    }
    console.log('> Database migrations check completed');
  }
}

// 執行 migration
runMigrations();

const prisma = createPrismaClient();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// 初始化 Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 建立 HTTP Server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error({ error: err }, 'Error handling request');
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // 初始化 Socket.io
  const io = initializeSocketServer(httpServer);

  // 啟動伺服器
  httpServer.listen(port, async () => {
    const heapStats = v8.getHeapStatistics();
    const heapLimitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);

    logger.info(
      {
        port,
        hostname,
        env: process.env.NODE_ENV,
        heapLimitMB,
      },
      'Server started successfully',
    );
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> V8 Heap Limit: ${heapLimitMB} MB`);
    console.log(`> Socket.io enabled`);

    // 啟動內建的資金費率監控服務
    try {
      await startMonitorService();
      console.log(`> Funding rate monitor enabled`);
    } catch (error) {
      logger.error({ error }, 'Failed to start monitor service');
      console.error('> Warning: Funding rate monitor failed to start');
    }

    // 啟動 OI 快取自動更新服務
    // 暫時禁用：在 Binance API 被地理限制的環境中無法使用
    // TODO: 實作使用 OKX API 獲取 OI 數據的替代方案
    if (process.env.ENABLE_OI_REFRESH === 'true') {
      try {
        await startOIRefreshService();
        console.log(`> OI cache refresh service enabled`);
      } catch (error) {
        logger.error({ error }, 'Failed to start OI refresh service');
        console.error('> Warning: OI refresh service failed to start');
      }
    } else {
      console.log(`> OI cache refresh service disabled (set ENABLE_OI_REFRESH=true to enable)`);
    }

    // 啟動資產快照排程服務 (Feature 031)
    if (process.env.ENABLE_ASSET_SNAPSHOT !== 'false') {
      try {
        await startAssetSnapshotScheduler(prisma);
        console.log(`> Asset snapshot scheduler enabled`);
      } catch (error) {
        logger.error({ error }, 'Failed to start asset snapshot scheduler');
        console.error('> Warning: Asset snapshot scheduler failed to start');
      }
    } else {
      console.log(`> Asset snapshot scheduler disabled (set ENABLE_ASSET_SNAPSHOT=true to enable)`);
    }

    // 啟動 CLI 狀態儀表板 (Feature 071)
    if (process.env.ENABLE_CLI_DASHBOARD !== 'false') {
      try {
        const dashboard = createStatusDashboard();
        await dashboard.start();
        console.log(`> CLI status dashboard enabled`);

        // 將 dashboard 加入 shutdown 處理
        process.on('SIGINT', () => dashboard.stop());
        process.on('SIGTERM', () => dashboard.stop());
      } catch (error) {
        logger.error({ error }, 'Failed to start CLI status dashboard');
        console.error('> Warning: CLI status dashboard failed to start');
      }
    } else {
      console.log(`> CLI status dashboard disabled (set ENABLE_CLI_DASHBOARD=true to enable)`);
    }
  });

  // 設定 graceful shutdown
  const shutdownServices: ShutdownServices = {
    stopMonitorService,
    stopOIRefreshService,
    stopAssetSnapshotScheduler,
    stopConditionalOrderMonitor,
    closeRedisClient,
  };

  const shutdown = createShutdownHandler(
    shutdownServices,
    { httpServer, io },
    prisma,
    {
      timeout: 10000,        // 整體超時 10 秒
      serviceTimeout: 5000,  // 單一服務超時 5 秒
      logger,
    },
  );

  registerShutdownHandlers(shutdown);
});
