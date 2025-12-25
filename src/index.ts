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

    // TODO: Initialize arbitrage service
    // TODO: Start monitoring service

    logger.info('Bot started successfully');
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
