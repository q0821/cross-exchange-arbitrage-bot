/**
 * GateioUserConnector 直接測試
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';
import { AccountBalance } from '../src/connectors/types';
import { logger } from '../src/lib/logger';

const prisma = new PrismaClient();

// 複製 GateioUserConnector 的邏輯來測試
async function testGateioConnector() {
  console.log('=== GateioUserConnector 測試 ===\n');

  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { exchange: 'gateio', isActive: true },
  });

  if (!apiKeyRecord) {
    console.log('❌ 找不到 Gate.io API Key');
    return;
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);
  const apiSecret = decrypt(apiKeyRecord.encryptedSecret);

  console.log(`API Key: ${apiKey.slice(0, 8)}...`);

  // 測試統一帳戶 API
  console.log('\n1. 測試 fetchUnifiedAccountBalance()...');
  const unifiedBalance = await fetchUnifiedAccountBalance(apiKey, apiSecret);
  console.log('統一帳戶結果:', JSON.stringify(unifiedBalance, null, 2));

  if (unifiedBalance && unifiedBalance.totalEquityUSD > 0) {
    console.log(`\n✅ 統一帳戶餘額: ${unifiedBalance.totalEquityUSD} USD`);
  } else {
    console.log('\n⚠️ 統一帳戶餘額為 0 或失敗');
  }
}

async function fetchUnifiedAccountBalance(
  apiKey: string,
  apiSecret: string
): Promise<AccountBalance | null> {
  const crypto = await import('crypto');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const method = 'GET';
  const url = '/api/v4/unified/accounts';
  const queryString = '';
  const bodyHash = crypto.createHash('sha512').update('').digest('hex');

  const signString = `${method}\n${url}\n${queryString}\n${bodyHash}\n${timestamp}`;
  const signature = crypto.createHmac('sha512', apiSecret).update(signString).digest('hex');

  console.log('發送請求到 Gate.io...');
  const response = await fetch(`https://api.gateio.ws${url}`, {
    method,
    headers: {
      KEY: apiKey,
      Timestamp: timestamp,
      SIGN: signature,
      'Content-Type': 'application/json',
    },
  });

  console.log(`回應狀態: ${response.status}`);

  if (!response.ok) {
    console.log('回應不是 200');
    return null;
  }

  const data = await response.json();
  console.log('原始回應 (部分):', {
    unified_account_total_equity: data.unified_account_total_equity,
    user_id: data.user_id,
    hasBalances: !!data.balances,
    label: data.label,
    message: data.message,
  });

  // 檢查是否有錯誤
  if (data.label || data.message) {
    console.log('API 返回錯誤');
    return null;
  }

  // 解析統一帳戶餘額
  const totalEquityUSD = parseFloat(data.unified_account_total_equity || '0');
  const balancesData = data.balances || {};

  const balances = Object.entries(balancesData)
    .filter(([_, v]) => {
      const val = v as { equity?: string };
      return parseFloat(val.equity || '0') > 0;
    })
    .map(([asset, v]) => {
      const val = v as { available?: string; freeze?: string; equity?: string };
      const available = parseFloat(val.available || '0');
      const freeze = parseFloat(val.freeze || '0');
      const equity = parseFloat(val.equity || '0');
      return {
        asset,
        free: available,
        locked: freeze,
        total: equity,
      };
    });

  return {
    exchange: 'gateio',
    balances,
    totalEquityUSD,
    timestamp: new Date(),
  };
}

testGateioConnector()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
