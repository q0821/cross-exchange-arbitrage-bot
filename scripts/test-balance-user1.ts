import { PrismaClient } from '@/generated/prisma/client';
import { BalanceValidator } from '../src/services/trading/BalanceValidator';

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

  console.log(`Testing with user: ${user.email} (${user.id})\n`);

  const balanceValidator = new BalanceValidator(prisma);

  const exchangesToTest = ['binance', 'gateio', 'okx', 'mexc'] as const;

  for (const exchange of exchangesToTest) {
    console.log(`--- Testing ${exchange} ---`);
    try {
      const balances = await balanceValidator.getBalances(user.id, [exchange]);
      const balance = balances.get(exchange);
      console.log(`✅ ${exchange}: ${balance?.toFixed(2) ?? 'N/A'} USDT\n`);
    } catch (error) {
      console.error(`❌ ${exchange} failed:`);
      if (error instanceof Error) {
        console.error(`   ${error.name}: ${error.message}\n`);
      }
    }
  }

  await prisma.$disconnect();
}

test();
