import { logger } from './lib/logger.js';
import { config } from './lib/config.js';
import { ErrorHandler } from './lib/errors.js';
import { runStartupTasks } from './lib/startup.js';

async function main() {
  try {
    logger.info({
      version: config.app.version,
      env: config.app.env,
    }, 'Starting Cross-Exchange Arbitrage Bot');

    // Run startup tasks (includes exchange connectivity validation)
    const startupResult = await runStartupTasks();

    if (!startupResult.success) {
      logger.warn(
        { errors: startupResult.errors },
        'Startup completed with warnings - some features may be unavailable',
      );
    }

    // 主要功能由 Web 平台 (Next.js) 提供
    // CLI 入口點僅用於啟動驗證，實際服務透過 `pnpm dev` 或 `pnpm start` 啟動

    logger.info('Startup validation completed - use Web platform for full functionality');
  } catch (error) {
    if (error instanceof Error) {
      ErrorHandler.handle(error);
    }
    process.exit(1);
  }
}

// Start application
main().catch((error) => {
  logger.fatal({
    error: error instanceof Error ? error.message : String(error),
  }, 'Failed to start application');
  process.exit(1);
});
