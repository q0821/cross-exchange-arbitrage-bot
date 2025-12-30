#!/usr/bin/env node
/**
 * Test Conditional Orders Script
 *
 * 測試 OKX 和 Gate.io 的條件單 API 是否正常工作
 * 注意：此腳本會創建真實的條件單，請在測試網或小額測試
 *
 * 使用方式：
 *   pnpm tsx src/scripts/test-conditional-orders.ts
 *   pnpm tsx src/scripts/test-conditional-orders.ts --exchange=okx
 *   pnpm tsx src/scripts/test-conditional-orders.ts --exchange=gateio
 *   pnpm tsx src/scripts/test-conditional-orders.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { ConditionalOrderAdapterFactory } from '../services/trading/ConditionalOrderAdapterFactory';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

// 支援的交易所
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'gateio'] as const;
type TestExchange = (typeof SUPPORTED_EXCHANGES)[number];

// 解析命令行參數
function parseArgs(): {
  exchange?: TestExchange;
  userId?: string;
  dryRun: boolean;
  symbol: string;
} {
  const args = process.argv.slice(2);
  let exchange: TestExchange | undefined;
  let userId: string | undefined;
  let dryRun = false;
  let symbol = 'BTCUSDT';

  for (const arg of args) {
    if (arg.startsWith('--exchange=')) {
      const ex = arg.split('=')[1] as TestExchange;
      if (SUPPORTED_EXCHANGES.includes(ex)) {
        exchange = ex;
      }
    } else if (arg.startsWith('--userId=')) {
      userId = arg.split('=')[1] ?? userId;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--symbol=')) {
      symbol = arg.split('=')[1] ?? symbol;
    }
  }

  return { exchange, userId, dryRun, symbol };
}

// 測試單一交易所的條件單
async function testConditionalOrder(
  exchange: TestExchange,
  userId: string,
  symbol: string,
  dryRun: boolean,
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 測試 ${exchange.toUpperCase()} 條件單 API`);
  console.log('='.repeat(60));

  const factory = new ConditionalOrderAdapterFactory(prisma);

  try {
    console.log(`📋 取得 ${exchange} 適配器...`);
    const adapter = await factory.getAdapter(exchange as any, userId);
    console.log(`✅ 適配器創建成功`);

    // 模擬參數（使用極端價格避免真的觸發）
    const mockEntryPrice = new Decimal('100000'); // 使用遠離市場的價格
    const stopLossPrice = mockEntryPrice.times(0.5); // 50% 停損（不會觸發）
    const takeProfitPrice = mockEntryPrice.times(2); // 100% 停利（不會觸發）
    const quantity = new Decimal('0.01'); // OKX BTC 最小數量是 0.01

    console.log(`\n📊 測試參數:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Side: LONG`);
    console.log(`   Quantity: ${quantity}`);
    console.log(`   Stop Loss Price: ${stopLossPrice} (50% below mock entry)`);
    console.log(`   Take Profit Price: ${takeProfitPrice} (100% above mock entry)`);

    if (dryRun) {
      console.log(`\n⚠️  Dry run 模式 - 不會實際創建訂單`);
      console.log(`   如要實際測試，請移除 --dry-run 參數`);
      return;
    }

    // 測試停損單
    console.log(`\n🔴 測試停損單...`);
    const slResult = await adapter.setStopLossOrder({
      symbol,
      side: 'LONG',
      quantity,
      triggerPrice: stopLossPrice,
    });

    if (slResult.success) {
      console.log(`✅ 停損單創建成功!`);
      console.log(`   Order ID: ${slResult.orderId}`);
      console.log(`   Trigger Price: ${slResult.triggerPrice}`);

      // 嘗試取消訂單
      console.log(`\n🗑️  取消停損單...`);
      const cancelResult = await adapter.cancelConditionalOrder(symbol, slResult.orderId!);
      console.log(cancelResult ? `✅ 停損單已取消` : `❌ 取消失敗`);
    } else {
      console.log(`❌ 停損單創建失敗: ${slResult.error}`);
    }

    // 測試停利單
    console.log(`\n🟢 測試停利單...`);
    const tpResult = await adapter.setTakeProfitOrder({
      symbol,
      side: 'LONG',
      quantity,
      triggerPrice: takeProfitPrice,
    });

    if (tpResult.success) {
      console.log(`✅ 停利單創建成功!`);
      console.log(`   Order ID: ${tpResult.orderId}`);
      console.log(`   Trigger Price: ${tpResult.triggerPrice}`);

      // 嘗試取消訂單
      console.log(`\n🗑️  取消停利單...`);
      const cancelResult = await adapter.cancelConditionalOrder(symbol, tpResult.orderId!);
      console.log(cancelResult ? `✅ 停利單已取消` : `❌ 取消失敗`);
    } else {
      console.log(`❌ 停利單創建失敗: ${tpResult.error}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`\n❌ 測試失敗: ${errorMsg}`);
    logger.error({ error, exchange }, 'Conditional order test failed');
  }
}

// 主函數
async function main() {
  const { exchange, userId, dryRun, symbol } = parseArgs();

  console.log('\n🔧 條件單 API 測試腳本');
  console.log('='.repeat(60));
  console.log(`📅 時間: ${new Date().toISOString()}`);
  console.log(`💱 交易對: ${symbol}`);
  console.log(`🔄 Dry Run: ${dryRun ? '是' : '否'}`);

  try {
    // 獲取用戶 ID
    let targetUserId = userId;

    if (!targetUserId) {
      const firstApiKey = await prisma.apiKey.findFirst({
        where: {
          isActive: true,
          exchange: exchange ? { in: [exchange] } : { in: [...SUPPORTED_EXCHANGES] },
        },
        select: { userId: true },
      });

      if (!firstApiKey) {
        console.log(`\n❌ 資料庫中沒有找到可用的 API Key`);
        return;
      }

      targetUserId = firstApiKey.userId;
    }

    console.log(`👤 用戶 ID: ${targetUserId}`);

    // 確定要測試的交易所
    const exchangesToTest: TestExchange[] = exchange
      ? [exchange]
      : [...SUPPORTED_EXCHANGES];

    console.log(`🏢 測試交易所: ${exchangesToTest.join(', ')}`);

    // 測試每個交易所
    for (const ex of exchangesToTest) {
      // 檢查是否有該交易所的 API Key
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          userId: targetUserId,
          exchange: ex,
          isActive: true,
        },
      });

      if (!apiKey) {
        console.log(`\n⚠️  跳過 ${ex}: 沒有可用的 API Key`);
        continue;
      }

      await testConditionalOrder(ex, targetUserId, symbol, dryRun);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 測試完成');
  } catch (error) {
    logger.error({ error }, 'Script failed');
    console.error('❌ 腳本執行失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 執行
main().catch(console.error);
