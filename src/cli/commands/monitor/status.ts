import { Command } from 'commander';
import { logger } from '../../../lib/logger.js';

export function createMonitorStatusCommand(): Command {
  const command = new Command('status');

  command
    .description('顯示監控服務狀態')
    .action(async () => {
      try {
        console.log('\n📊 監控服務狀態\n');
        console.log('此功能需要實作服務狀態持久化或 IPC 通訊');
        console.log('暫時請使用 monitor start 指令啟動監控服務查看即時狀態\n');

        // TODO: 實作方式可以是:
        // 1. 使用共享檔案儲存狀態 (簡單但不即時)
        // 2. 使用 IPC (進程間通訊)
        // 3. 使用 HTTP API (需要額外的 API 服務)
        // 4. 使用資料庫查詢最新狀態 (需要資料庫)

        logger.info('Status command executed');
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
