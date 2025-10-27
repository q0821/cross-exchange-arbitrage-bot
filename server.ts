import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from './src/websocket/SocketServer.js';
import { logger } from './src/lib/logger.js';

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
  httpServer.listen(port, () => {
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
  });

  // 優雅關閉
  const shutdown = () => {
    logger.info('Shutting down server...');
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
