/**
 * 測試 Portfolio Margin 餘額查詢
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function test() {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      exchange: { in: ['binance', 'BINANCE'] },
      isActive: true,
      environment: 'MAINNET',
    },
  });

  if (!apiKey) {
    console.log('找不到 API Key');
    return;
  }

  const key = decrypt(apiKey.encryptedKey);
  const secret = decrypt(apiKey.encryptedSecret);

  async function signedRequest(baseUrl: string, endpoint: string) {
    const timestamp = Date.now().toString();
    const qs = new URLSearchParams({ timestamp, recvWindow: '5000' }).toString();
    const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
    const url = baseUrl + endpoint + '?' + qs + '&signature=' + sig;
    const res = await fetch(url, { headers: { 'X-MBX-APIKEY': key } });
    return await res.json();
  }

  interface BalanceItem {
    asset: string;
    totalWalletBalance: string;
    crossMarginFree: string;
    crossMarginLocked: string;
  }

  const pmData = (await signedRequest(
    'https://papi.binance.com',
    '/papi/v1/balance'
  )) as BalanceItem[];

  console.log('=== Portfolio Margin 餘額 ===');
  const balances = pmData
    .filter((b) => parseFloat(b.totalWalletBalance) > 0)
    .map((b) => ({
      asset: b.asset,
      total: parseFloat(b.totalWalletBalance),
      free: parseFloat(b.crossMarginFree) || 0,
      locked: parseFloat(b.crossMarginLocked) || 0,
    }));

  let totalUSD = 0;
  balances.forEach((b) => {
    console.log(b.asset + ':', b.total.toFixed(4), '(可用:', b.free.toFixed(4) + ')');
    if (b.asset === 'USDT') totalUSD += b.total;
  });
  console.log('\n總資產 (USD):', totalUSD.toFixed(2));

  await prisma.$disconnect();
}

test();
