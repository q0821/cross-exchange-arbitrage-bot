/**
 * 測試餘額 API 功能
 * 用於診斷 INTERNAL_ERROR 問題
 */

import { PrismaClient } from '@/generated/prisma/client';
import { BalanceValidator } from '../src/services/trading/BalanceValidator';

const prisma = new PrismaClient();

async function testBalanceAPI() {
  console.log('=== Testing Balance API ===\n');

  // 取得第一個用戶作為測試
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database');
    process.exit(1);
  }

  console.log(`Testing with user: ${user.email} (${user.id})\n`);

  const balanceValidator = new BalanceValidator(prisma);

  const exchangesToTest = ['binance', 'gateio', 'okx', 'mexc'] as const;

  for (const exchange of exchangesToTest) {
    console.log(`\n--- Testing ${exchange} ---`);
    try {
      const balances = await balanceValidator.getBalances(user.id, [exchange]);
      const balance = balances.get(exchange);
      console.log(`✅ ${exchange}: ${balance ?? 'N/A'} USDT`);
    } catch (error) {
      console.error(`❌ ${exchange} failed:`);
      if (error instanceof Error) {
        console.error(`   Name: ${error.name}`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
      } else {
        console.error(`   Unknown error: ${error}`);
      }
    }
  }

  console.log('\n=== Test Complete ===');
  await prisma.$disconnect();
}

testBalanceAPI().catch(console.error);
