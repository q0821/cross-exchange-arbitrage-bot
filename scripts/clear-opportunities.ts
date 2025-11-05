#!/usr/bin/env tsx
/**
 * 清空套利機會資料庫
 *
 * 用途：清除基於舊閾值（0.05%）的套利機會資料
 * 新閾值：0.37%（包含所有交易成本）
 *
 * 執行方式：
 * pnpm tsx scripts/clear-opportunities.ts
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger.js';

const prisma = new PrismaClient();

async function clearOpportunities() {
  try {
    logger.info('開始清理套利機會資料...');

    // 統計現有資料
    const existingCount = await prisma.arbitrageOpportunity.count();
    const historyCount = await prisma.opportunityHistory.count();
    const notificationCount = await prisma.notificationLog.count();

    logger.info({
      opportunities: existingCount,
      history: historyCount,
      notifications: notificationCount,
    }, '現有資料統計');

    if (existingCount === 0 && historyCount === 0 && notificationCount === 0) {
      logger.info('資料庫已經是空的，無需清理');
      return;
    }

    // 詢問確認
    console.log('\n⚠️  即將刪除以下資料：');
    console.log(`  - 套利機會記錄：${existingCount} 筆`);
    console.log(`  - 機會歷史記錄：${historyCount} 筆`);
    console.log(`  - 通知日誌：${notificationCount} 筆`);
    console.log('\n是否確認刪除？(y/N) ');

    // 等待用戶輸入
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('', (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      });
    });

    if (answer !== 'y' && answer !== 'yes') {
      logger.info('取消清理操作');
      console.log('\n❌ 已取消');
      return;
    }

    // 開始刪除
    logger.info('開始刪除資料...');

    // 1. 刪除通知日誌（有外鍵參照）
    const deletedNotifications = await prisma.notificationLog.deleteMany();
    logger.info({ count: deletedNotifications.count }, '已刪除通知日誌');

    // 2. 刪除機會歷史（有外鍵參照）
    const deletedHistory = await prisma.opportunityHistory.deleteMany();
    logger.info({ count: deletedHistory.count }, '已刪除機會歷史記錄');

    // 3. 刪除套利機會
    const deletedOpportunities = await prisma.arbitrageOpportunity.deleteMany();
    logger.info({ count: deletedOpportunities.count }, '已刪除套利機會記錄');

    // 驗證刪除結果
    const remainingCount = await prisma.arbitrageOpportunity.count();

    if (remainingCount === 0) {
      logger.info('✅ 資料庫清理完成');
      console.log('\n✅ 清理完成！');
      console.log('\n📋 刪除統計：');
      console.log(`  - 套利機會：${deletedOpportunities.count} 筆`);
      console.log(`  - 機會歷史：${deletedHistory.count} 筆`);
      console.log(`  - 通知日誌：${deletedNotifications.count} 筆`);
      console.log('\n💡 提示：');
      console.log('  使用新閾值重新啟動監控服務：');
      console.log('  pnpm cli monitor start -t 0.37');
    } else {
      logger.error({ remaining: remainingCount }, '清理後仍有殘留資料');
      console.log('\n⚠️  警告：清理後仍有殘留資料');
    }
  } catch (error) {
    logger.error({ error }, '清理失敗');
    console.error('\n❌ 清理失敗：', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 執行清理
clearOpportunities()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('執行失敗：', error);
    process.exit(1);
  });
