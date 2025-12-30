#!/usr/bin/env node
/**
 * 測試開倉平倉流程（含停損停利）
 *
 * 直接調用 PositionOrchestrator 和 PositionCloser 測試
 * 注意：此腳本會創建真實倉位，請使用小額測試
 *
 * 使用方式：
 *   pnpm tsx src/scripts/test-open-close-position.ts
 *   pnpm tsx src/scripts/test-open-close-position.ts --dry-run
 *   pnpm tsx src/scripts/test-open-close-position.ts --close-only=<positionId>
 */

import { PrismaClient } from '@/generated/prisma/client';
import Decimal from 'decimal.js';
import { PositionOrchestrator } from '../services/trading/PositionOrchestrator';
import { PositionCloser } from '../services/trading/PositionCloser';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

// 解析命令行參數
function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let closeOnly: string | undefined;
  let userId: string | undefined;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--close-only=')) {
      closeOnly = arg.split('=')[1];
    } else if (arg.startsWith('--userId=')) {
      userId = arg.split('=')[1];
    }
  }

  return { dryRun, closeOnly, userId };
}

async function testOpenPosition(userId: string) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 測試開倉（含停損停利）');
  console.log('='.repeat(60));

  const orchestrator = new PositionOrchestrator(prisma);

  // 使用極小數量測試
  const params = {
    userId,
    symbol: 'BTCUSDT',
    longExchange: 'okx' as const,
    shortExchange: 'gateio' as const,
    quantity: new Decimal('0.001'), // 極小數量
    leverage: 2 as const, // LeverageOption: 1 | 2
    stopLossEnabled: true,
    stopLossPercent: 5, // 5% 停損
    takeProfitEnabled: true,
    takeProfitPercent: 10, // 10% 停利
  };

  console.log('\n📋 開倉參數:');
  console.log(`   Symbol: ${params.symbol}`);
  console.log(`   Long: ${params.longExchange}`);
  console.log(`   Short: ${params.shortExchange}`);
  console.log(`   Quantity: ${params.quantity}`);
  console.log(`   Leverage: ${params.leverage}x`);
  console.log(`   Stop Loss: ${params.stopLossEnabled ? `${params.stopLossPercent}%` : 'Disabled'}`);
  console.log(`   Take Profit: ${params.takeProfitEnabled ? `${params.takeProfitPercent}%` : 'Disabled'}`);

  try {
    console.log('\n⏳ 執行開倉...');
    const position = await orchestrator.openPosition(params);

    console.log('\n✅ 開倉成功!');
    console.log(`   Position ID: ${position.id}`);
    console.log(`   Status: ${position.status}`);
    console.log(`   Long Entry: ${position.longEntryPrice}`);
    console.log(`   Short Entry: ${position.shortEntryPrice}`);
    console.log(`   Conditional Order Status: ${position.conditionalOrderStatus}`);

    // 查詢詳細條件單資訊
    const fullPosition = await prisma.position.findUnique({
      where: { id: position.id },
    });

    if (fullPosition) {
      console.log('\n📋 條件單詳情:');
      console.log(`   Long SL Order ID: ${fullPosition.longStopLossOrderId || 'N/A'}`);
      console.log(`   Long SL Price: ${fullPosition.longStopLossPrice || 'N/A'}`);
      console.log(`   Long TP Order ID: ${fullPosition.longTakeProfitOrderId || 'N/A'}`);
      console.log(`   Long TP Price: ${fullPosition.longTakeProfitPrice || 'N/A'}`);
      console.log(`   Short SL Order ID: ${fullPosition.shortStopLossOrderId || 'N/A'}`);
      console.log(`   Short SL Price: ${fullPosition.shortStopLossPrice || 'N/A'}`);
      console.log(`   Short TP Order ID: ${fullPosition.shortTakeProfitOrderId || 'N/A'}`);
      console.log(`   Short TP Price: ${fullPosition.shortTakeProfitPrice || 'N/A'}`);

      if (fullPosition.conditionalOrderError) {
        console.log(`   ⚠️ Error: ${fullPosition.conditionalOrderError}`);
      }
    }

    return position.id;
  } catch (error) {
    console.log(`\n❌ 開倉失敗: ${error instanceof Error ? error.message : error}`);
    logger.error({ error }, 'Open position test failed');
    return null;
  }
}

async function testClosePosition(userId: string, positionId: string) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 測試平倉（含取消條件單）');
  console.log('='.repeat(60));

  // 先查詢倉位狀態
  const position = await prisma.position.findUnique({
    where: { id: positionId },
  });

  if (!position) {
    console.log(`❌ 倉位不存在: ${positionId}`);
    return;
  }

  console.log('\n📋 倉位資訊:');
  console.log(`   Position ID: ${position.id}`);
  console.log(`   Symbol: ${position.symbol}`);
  console.log(`   Status: ${position.status}`);
  console.log(`   Long SL Order ID: ${position.longStopLossOrderId || 'N/A'}`);
  console.log(`   Long TP Order ID: ${position.longTakeProfitOrderId || 'N/A'}`);
  console.log(`   Short SL Order ID: ${position.shortStopLossOrderId || 'N/A'}`);
  console.log(`   Short TP Order ID: ${position.shortTakeProfitOrderId || 'N/A'}`);

  if (position.status !== 'OPEN') {
    console.log(`⚠️ 倉位狀態不是 OPEN，無法平倉`);
    return;
  }

  const positionCloser = new PositionCloser(prisma);

  try {
    console.log('\n⏳ 執行平倉...');
    const result = await positionCloser.closePosition({
      userId,
      positionId,
    });

    if (result.success) {
      console.log('\n✅ 平倉成功!');
      console.log(`   Trade ID: ${result.trade.id}`);
      console.log(`   PnL: ${result.trade.totalPnL}`);
      console.log(`   ROI: ${result.trade.roi}%`);
      console.log(`   Long Exit Price: ${result.longClose.price}`);
      console.log(`   Short Exit Price: ${result.shortClose.price}`);
      console.log('\n✅ 條件單應已被取消（查看上方日誌確認）');
    } else {
      console.log('\n⚠️ 部分平倉:');
      console.log(`   成功邊: ${result.closedSide.exchange} ${result.closedSide.side}`);
      console.log(`   失敗邊: ${result.failedSide.exchange} ${result.failedSide.side}`);
      console.log(`   錯誤: ${result.failedSide.error.message}`);
    }
  } catch (error) {
    console.log(`\n❌ 平倉失敗: ${error instanceof Error ? error.message : error}`);
    logger.error({ error }, 'Close position test failed');
  }
}

async function main() {
  const { dryRun, closeOnly, userId: argUserId } = parseArgs();

  console.log('🔧 開倉平倉測試腳本');
  console.log('='.repeat(60));
  console.log(`📅 時間: ${new Date().toISOString()}`);
  console.log(`🔄 Dry Run: ${dryRun ? '是' : '否'}`);

  try {
    // 獲取用戶 ID
    let userId = argUserId;

    if (!userId) {
      const user = await prisma.user.findFirst({
        where: { email: 'q0821yeh1@gmail.com' },
      });

      if (!user) {
        console.log('❌ 找不到測試用戶');
        return;
      }

      userId = user.id;
    }

    console.log(`👤 用戶 ID: ${userId}`);

    if (dryRun) {
      console.log('\n⚠️ Dry Run 模式 - 不會執行實際操作');
      console.log('   移除 --dry-run 參數以執行實際測試');
      return;
    }

    if (closeOnly) {
      // 只測試平倉
      await testClosePosition(userId, closeOnly);
    } else {
      // 測試開倉 + 平倉
      const positionId = await testOpenPosition(userId);

      if (positionId) {
        // 等待一下讓條件單完全設定
        console.log('\n⏳ 等待 3 秒...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 測試平倉
        await testClosePosition(userId, positionId);
      }
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

main().catch(console.error);
