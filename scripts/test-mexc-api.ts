/**
 * MEXC API 連線診斷腳本
 * 用於測試 MEXC API Key 是否正確配置
 *
 * 使用方式：
 * pnpm tsx scripts/test-mexc-api.ts
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MEXC API 連線診斷 ===\n');

  // 1. 查詢資料庫中的 MEXC API Key
  console.log('1. 查詢 MEXC API Key...');

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      exchange: {
        in: ['mexc', 'MEXC'],
      },
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      exchange: true,
      environment: true,
      label: true,
      encryptedKey: true,
      encryptedSecret: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (apiKeys.length === 0) {
    console.log('❌ 找不到 MEXC API Key');
    console.log('\n請確認：');
    console.log('1. 已在設定頁面新增 MEXC API Key');
    console.log('2. API Key 的 exchange 欄位是 "mexc"（小寫）');
    return;
  }

  console.log(`✅ 找到 ${apiKeys.length} 個 MEXC API Key\n`);

  for (const key of apiKeys) {
    console.log(`--- API Key: ${key.id} ---`);
    console.log(`User ID: ${key.userId}`);
    console.log(`Exchange: ${key.exchange}`);
    console.log(`Environment: ${key.environment}`);
    console.log(`Label: ${key.label}`);
    console.log(`Created: ${key.createdAt}`);

    // 2. 解密 API Key
    console.log('\n2. 解密 API Key...');
    let apiKey: string;
    let apiSecret: string;

    try {
      apiKey = decrypt(key.encryptedKey);
      apiSecret = decrypt(key.encryptedSecret);
      console.log(`✅ API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
      console.log(`✅ API Secret: ${apiSecret.slice(0, 4)}...${apiSecret.slice(-4)}`);
    } catch (error) {
      console.log('❌ 解密失敗:', error);
      continue;
    }

    // 3. 測試 CCXT 連線
    console.log('\n3. 測試 CCXT 連線...');
    try {
      const ccxt = await import('ccxt');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exchange = new (ccxt as any).mexc({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          defaultType: 'swap',
        },
      });

      console.log('✅ CCXT mexc 實例建立成功');

      // 4. 測試餘額查詢
      console.log('\n4. 測試餘額查詢...');
      const balance = await exchange.fetchBalance();

      console.log('✅ 餘額查詢成功');
      console.log('\n餘額詳情:');
      console.log('- total:', JSON.stringify(balance.total, null, 2));
      console.log('- free:', JSON.stringify(balance.free, null, 2));

      // 計算 USD 總值
      const totalUSD = balance.total?.USDT || balance.total?.USD || 0;
      console.log(`\n總資產 (USD): ${totalUSD}`);

    } catch (error) {
      console.log('❌ CCXT 錯誤:', error);
      if (error instanceof Error) {
        console.log('錯誤訊息:', error.message);
        console.log('錯誤堆疊:', error.stack);
      }
    }

    console.log('\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
