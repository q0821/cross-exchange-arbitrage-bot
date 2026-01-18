/**
 * Vitest Global Setup
 *
 * 在所有測試執行前執行一次：
 * - 載入 .env.test 環境變數
 * - 執行資料庫遷移（如果需要整合測試）
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';

export default async function globalSetup() {
  // 載入測試環境變數
  config({ path: '.env.test', override: true });

  // 只有在需要整合測試時才執行資料庫遷移
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
  const runTradingTests = process.env.RUN_TRADING_INTEGRATION_TESTS === 'true';

  if (runIntegrationTests || runTradingTests) {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      console.log('\n📦 執行資料庫遷移...');
      try {
        // 使用 db push 同步 schema（不建立新的 migration 檔案）
        execSync('pnpm exec prisma db push', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: databaseUrl },
        });
        console.log('✅ 資料庫遷移完成\n');
      } catch (error) {
        console.error('❌ 資料庫遷移失敗:', error);
        // 不中斷測試，讓測試自己處理連接問題
      }
    }
  }
}
