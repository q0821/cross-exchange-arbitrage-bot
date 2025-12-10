import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { PrismaClient } from '@prisma/client';
import { initializeSocketServer } from './src/websocket/SocketServer';
import { logger } from './src/lib/logger';
import { startMonitorService, stopMonitorService } from './src/services/MonitorService';
import { startOIRefreshService, stopOIRefreshService } from './src/services/OIRefreshService';
import {
  startAssetSnapshotScheduler,
  stopAssetSnapshotScheduler,
} from './src/services/assets/AssetSnapshotScheduler';

const prisma = new PrismaClient();

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
    logger.info(
      {
        port,
        hostname,
        env: process.env.NODE_ENV,
      },
      'Server started successfully',
    );
    console.log(`> Ready on http://${hostname}:${port}`);
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
  });

  // 優雅關閉
  const shutdown = async () => {
    logger.info('Shutting down server...');

    // 停止背景服務
    await stopMonitorService();
    await stopOIRefreshService();
    await stopAssetSnapshotScheduler();

    io.close(() => {
      logger.info('Socket.io server closed');
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
