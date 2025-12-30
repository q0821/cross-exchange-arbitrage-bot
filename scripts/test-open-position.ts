/**
 * 測試開倉流程
 *
 * Usage:
 *   pnpm tsx scripts/test-open-position.ts <symbol> <quantity> <longExchange> <shortExchange>
 *
 * Example:
 *   pnpm tsx scripts/test-open-position.ts BEATUSDT 40 binance okx
 */

import { PrismaClient } from '@/generated/prisma/client';
import { Decimal } from 'decimal.js';
import { PositionOrchestrator } from '../src/services/trading/PositionOrchestrator';

const prisma = new PrismaClient();

async function test() {
  // 解析命令列參數
  const args = process.argv.slice(2);
  const symbol = args[0] || 'BEATUSDT';
  const quantity = parseFloat(args[1]) || 40;
  const longExchange = (args[2] || 'binance') as 'binance' | 'okx' | 'mexc' | 'gateio';
  const shortExchange = (args[3] || 'okx') as 'binance' | 'okx' | 'mexc' | 'gateio';

  // 使用 q0821yeh1@gmail.com 的 userId
  const user = await prisma.user.findFirst({
    where: { email: 'q0821yeh1@gmail.com' }
  });

  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  console.log(`Testing open position with user: ${user.email}\n`);

  const orchestrator = new PositionOrchestrator(prisma);

  try {
    console.log('Attempting to open position...');
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Long: ${longExchange}`);
    console.log(`  Short: ${shortExchange}`);
    console.log(`  Quantity: ${quantity}`);
    console.log('  Leverage: 1');
    console.log('');

    const position = await orchestrator.openPosition({
      userId: user.id,
      symbol,
      longExchange,
      shortExchange,
      quantity: new Decimal(quantity),
      leverage: 1,
    });

    console.log('✅ Position opened successfully!');
    console.log('  Position ID:', position.id);
    console.log('  Status:', position.status);
  } catch (error) {
    console.error('❌ Failed to open position:');
    if (error instanceof Error) {
      console.error('  Name:', error.name);
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    } else {
      console.error('  Error:', error);
    }
  }

  await prisma.$disconnect();
}

test();
