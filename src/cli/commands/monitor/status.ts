import { Command } from 'commander';
import { logger } from '../../../lib/logger.js';

export function createMonitorStatusCommand(): Command {
  const command = new Command('status');

  command
    .description('顯示監控服務狀態')
    .action(async () => {
      try {
        console.log('\n📊 監控服務狀態\n');
        console.log('CLI 監控狀態功能已由 Web 平台取代');
        console.log('請使用 Web 介面 (http://localhost:3000) 查看即時狀態\n');

        logger.info('Status command executed - redirecting to Web platform');
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, '查詢狀態失敗');
        console.error('\n❌ 查詢失敗:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
