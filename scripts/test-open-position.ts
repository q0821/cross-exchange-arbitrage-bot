/**
 * 測試開倉流程
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PositionOrchestrator } from '../src/services/trading/PositionOrchestrator';

const prisma = new PrismaClient();

async function test() {
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
    console.log('  Symbol: FOLKSUSDT');
    console.log('  Long: binance');
    console.log('  Short: gateio');
    console.log('  Quantity: 1');
    console.log('  Leverage: 1');
    console.log('');

    const position = await orchestrator.openPosition({
      userId: user.id,
      symbol: 'FOLKSUSDT',
      longExchange: 'binance',
      shortExchange: 'gateio',
      quantity: new Decimal(1),
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
