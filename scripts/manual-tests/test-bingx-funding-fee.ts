/**
 * 測試 BingX 資金費率查詢 - 嘗試不同參數
 */
import * as ccxt from 'ccxt';
import { prisma } from '../lib/db';
import { decrypt } from '../lib/encryption';

async function testBingxFundingFee() {
  console.log('=== BingX 資金費率查詢測試 ===\n');

  const apiKey = await prisma.apiKey.findFirst({
    where: { exchange: 'bingx', isActive: true },
  });

  if (!apiKey) {
    console.log('找不到 BingX API Key');
    await prisma.$disconnect();
    return;
  }

  const bingx = new ccxt.bingx({
    apiKey: decrypt(apiKey.encryptedKey),
    secret: decrypt(apiKey.encryptedSecret),
    enableRateLimit: true,
    options: { defaultType: 'swap' },
  });

  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000;

  console.log('=== 測試 1: 不帶 symbol ===');
  try {
    const res1 = await (bingx as any).swapV2PrivateGetUserIncome({
      incomeType: 'FUNDING_FEE',
      startTime,
      endTime,
      limit: 100,
    });
    console.log('結果:', JSON.stringify(res1, null, 2));
  } catch (e: any) {
    console.log('錯誤:', e.message);
  }

  console.log('\n=== 測試 2: 不帶 incomeType ===');
  try {
    const res2 = await (bingx as any).swapV2PrivateGetUserIncome({
      startTime,
      endTime,
      limit: 100,
    });
    console.log('結果:', JSON.stringify(res2, null, 2));
  } catch (e: any) {
    console.log('錯誤:', e.message);
  }

  await prisma.$disconnect();
  process.exit(0);
}

testBingxFundingFee().catch(console.error);
