/**
 * Gate.io API 連線診斷腳本
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../src/lib/encryption';
import { createCcxtExchange } from '../src/lib/ccxt-factory';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Gate.io API 連線診斷 ===\n');

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      exchange: { in: ['gateio', 'gate', 'GATEIO', 'GATE'] },
      isActive: true,
    },
  });

  if (!apiKey) {
    console.log('❌ 找不到 Gate.io API Key');
    return;
  }

  console.log(`API Key ID: ${apiKey.id}`);
  console.log(`User ID: ${apiKey.userId}`);
  console.log(`Exchange: ${apiKey.exchange}`);

  const key = decrypt(apiKey.encryptedKey);
  const secret = decrypt(apiKey.encryptedSecret);
  console.log(`API Key: ${key.slice(0, 8)}...`);

  console.log('\n測試 CCXT 連線...');
  try {

    const exchange = createCcxtExchange('gateio', {
      apiKey: key,
      secret: secret,
      enableRateLimit: true,
      timeout: 30000,
      options: { defaultType: 'swap' },
    });

    console.log('✅ CCXT gateio 實例建立成功');

    // 測試不同帳戶類型
    const types = ['spot', 'swap', 'future'];

    for (const type of types) {
      console.log(`\n測試餘額查詢 (${type})...`);
      try {
        const balance = await exchange.fetchBalance({ type });
        const total = balance.total || {};
        const nonZero = Object.entries(total).filter(([_, v]) => (v as number) > 0.0001);
        if (nonZero.length > 0) {
          console.log(`✅ ${type}:`, JSON.stringify(Object.fromEntries(nonZero)));
        } else {
          console.log(`- ${type}: 無餘額`);
        }
      } catch (e: any) {
        console.log(`- ${type}: ${e.message?.slice(0, 100) || '錯誤'}`);
      }
    }

    // 嘗試 Gate.io 統一帳戶 API (直接 REST 呼叫)
    console.log('\n嘗試統一帳戶 REST API...');
    try {
      const crypto = await import('crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const url = '/api/v4/unified/accounts';
      const queryString = '';
      const bodyHash = crypto.createHash('sha512').update('').digest('hex');

      const signString = `${method}\n${url}\n${queryString}\n${bodyHash}\n${timestamp}`;
      const signature = crypto.createHmac('sha512', secret).update(signString).digest('hex');

      const response = await fetch(`https://api.gateio.ws${url}`, {
        method,
        headers: {
          'KEY': key,
          'Timestamp': timestamp,
          'SIGN': signature,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('統一帳戶回應:', JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.log(`- 統一帳戶 API: ${e.message || '錯誤'}`);
    }

  } catch (error) {
    console.log('❌ 錯誤:', error);
  }
}

main().finally(() => prisma.$disconnect());
