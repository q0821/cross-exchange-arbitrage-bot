/**
 * UserConnectorFactory 診斷腳本
 * 測試用戶連接器工廠是否正確返回 MEXC 餘額
 *
 * 使用方式：
 * pnpm tsx scripts/test-user-connector.ts
 */

import { PrismaClient } from '@/generated/prisma/client';
import { UserConnectorFactory } from '../src/services/assets/UserConnectorFactory';

const prisma = new PrismaClient();

async function main() {
  console.log('=== UserConnectorFactory 診斷 ===\n');

  // 查找有 MEXC API Key 的用戶
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      exchange: {
        in: ['mexc', 'MEXC'],
      },
      isActive: true,
    },
    select: {
      userId: true,
    },
  });

  if (!apiKey) {
    console.log('❌ 找不到有 MEXC API Key 的用戶');
    return;
  }

  const userId = apiKey.userId;
  console.log(`用戶 ID: ${userId}\n`);

  // 測試 UserConnectorFactory
  const factory = new UserConnectorFactory(prisma);

  console.log('1. 呼叫 getBalancesForUser()...');
  const results = await factory.getBalancesForUser(userId);

  console.log('\n2. 結果:');
  for (const result of results) {
    console.log(`\n--- ${result.exchange.toUpperCase()} ---`);
    console.log(`Status: ${result.status}`);
    console.log(`Balance USD: ${result.balanceUSD}`);
    if (result.errorMessage) {
      console.log(`Error: ${result.errorMessage}`);
    }
  }

  // 計算總資產
  const total = results
    .filter((r) => r.status === 'success' && r.balanceUSD !== null)
    .reduce((sum, r) => sum + (r.balanceUSD || 0), 0);

  console.log(`\n總資產 (USD): ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
