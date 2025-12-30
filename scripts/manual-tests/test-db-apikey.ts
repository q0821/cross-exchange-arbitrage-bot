import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../lib/encryption';
import crypto from 'crypto';

async function signedRequest(
  baseUrl: string,
  endpoint: string,
  apiKey: string,
  apiSecret: string,
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const timestamp = Date.now().toString();
  const queryParams = { timestamp, recvWindow: '5000' };
  const queryString = new URLSearchParams(queryParams).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function test() {
  const prisma = new PrismaClient();

  try {
    // 1. 查詢所有 Binance API Keys
    const apiKeys = await prisma.apiKey.findMany({
      where: { exchange: 'binance' },
      select: {
        id: true,
        userId: true,
        exchange: true,
        environment: true,
        label: true,
        encryptedKey: true,
        encryptedSecret: true,
        isActive: true,
      },
    });

    console.log('找到 ' + apiKeys.length + ' 個 Binance API Keys:\n');

    for (const key of apiKeys) {
      console.log('ID: ' + key.id);
      console.log('Label: ' + key.label);
      console.log('Environment: ' + key.environment);
      console.log('Active: ' + key.isActive);

      // 解密
      const decryptedKey = decrypt(key.encryptedKey);
      const decryptedSecret = decrypt(key.encryptedSecret);

      console.log('API Key (前8字): ' + decryptedKey.substring(0, 8) + '...');

      // 測試連線
      console.log('\n測試連線...');

      // Try Portfolio Margin
      const pmResult = await signedRequest('https://papi.binance.com', '/papi/v1/balance', decryptedKey, decryptedSecret);
      console.log('Portfolio Margin API: ' + (pmResult.ok ? '✅' : '❌'));
      if (!pmResult.ok) console.log('  Error: ' + (pmResult.error?.substring(0, 100) || 'unknown'));

      // Try Futures
      const futuresResult = await signedRequest('https://fapi.binance.com', '/fapi/v2/account', decryptedKey, decryptedSecret);
      console.log('Futures API: ' + (futuresResult.ok ? '✅' : '❌'));
      if (!futuresResult.ok) console.log('  Error: ' + (futuresResult.error?.substring(0, 100) || 'unknown'));

      // Try Spot
      const spotResult = await signedRequest('https://api.binance.com', '/api/v3/account', decryptedKey, decryptedSecret);
      console.log('Spot API: ' + (spotResult.ok ? '✅' : '❌'));
      if (!spotResult.ok) console.log('  Error: ' + (spotResult.error?.substring(0, 100) || 'unknown'));

      console.log('\n-----------------------------------\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

test().catch(console.error);
