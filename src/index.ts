import { logger } from './lib/logger.js';
import { config, validateApiKeys } from './lib/config.js';
import { ErrorHandler } from './lib/errors.js';

async function main() {
  try {
    logger.info({
      version: config.app.version,
      env: config.app.env,
    }, 'Starting Cross-Exchange Arbitrage Bot');

    // Validate API keys
    validateApiKeys();
    logger.info('API keys validated');

    // TODO: Initialize exchange connectors
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
