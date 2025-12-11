/**
 * 測試 Binance API 連線
 * 用於診斷 API Key 錯誤
 *
 * Usage: pnpm tsx scripts/test-binance-api.ts
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function testBinanceApi() {
  // 1. 取得第一個用戶的 Binance API Key (MAINNET 優先)
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      exchange: { in: ['binance', 'BINANCE'] },
      isActive: true,
      environment: 'MAINNET',
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  if (!apiKey) {
    console.log('找不到有效的 Binance API Key');
    return;
  }

  console.log('用戶:', apiKey.user.email);
  console.log('交易所:', apiKey.exchange);
  console.log('環境:', apiKey.environment);

  // 2. 解密 API Key
  let decryptedKey: string;
  let decryptedSecret: string;
  try {
    decryptedKey = decrypt(apiKey.encryptedKey);
    decryptedSecret = decrypt(apiKey.encryptedSecret);
    console.log('API Key (前8字元):', decryptedKey.substring(0, 8) + '...');
  } catch (error) {
    console.error('解密失敗:', error);
    return;
  }

  // 3. 測試 API 連線 - 使用 Spot API
  const isTestnet = apiKey.environment === 'TESTNET';
  const baseUrl = isTestnet
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com';

  console.log('Base URL:', baseUrl, '(Spot API)');

  // 測試簽名請求
  const timestamp = Date.now().toString();
  const queryParams = { timestamp, recvWindow: '5000' };
  const queryString = new URLSearchParams(queryParams).toString();
  const signature = crypto
    .createHmac('sha256', decryptedSecret)
    .update(queryString)
    .digest('hex');

  const url = `${baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

  console.log('\n發送請求到:', url.replace(signature, 'SIG_HIDDEN'));

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': decryptedKey,
      },
    });

    const responseText = await response.text();
    console.log('HTTP Status:', response.status);

    if (response.ok) {
      const data = JSON.parse(responseText);
      // Spot API 返回 balances 陣列
      const balances = data.balances?.filter((b: { free: string; locked: string }) =>
        parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      ) || [];
      console.log('成功！找到', balances.length, '個有餘額的幣種');
      if (balances.length > 0) {
        console.log('前 5 個幣種:');
        balances.slice(0, 5).forEach((b: { asset: string; free: string; locked: string }) => {
          console.log(`  ${b.asset}: ${b.free} (可用) + ${b.locked} (鎖定)`);
        });
      }
    } else {
      console.log('錯誤回應:', responseText);

      // 解析 Binance 錯誤碼
      try {
        const errorData = JSON.parse(responseText);
        console.log('\nBinance 錯誤碼:', errorData.code);
        console.log('錯誤訊息:', errorData.msg);

        // 常見錯誤說明
        if (errorData.code === -2015) {
          console.log('\n診斷: API Key 無效或權限不足');
          console.log('建議: 確認 API Key 有啟用 Futures 權限');
        } else if (errorData.code === -1021) {
          console.log('\n診斷: 時間戳不同步');
          console.log('建議: 檢查伺服器時間');
        } else if (errorData.code === -1022) {
          console.log('\n診斷: 簽名無效');
          console.log('建議: 確認 API Secret 正確');
        } else if (errorData.code === -2014) {
          console.log('\n診斷: API Key 格式無效');
          console.log('建議: 確認 API Key 正確複製，沒有多餘空白');
        } else if (errorData.code === -1002) {
          console.log('\n診斷: 未授權請求');
          console.log('建議: 確認 API Key 已啟用，且 IP 白名單設定正確');
        }
      } catch {
        // 不是 JSON 格式
      }
    }
  } catch (error) {
    console.error('網路錯誤:', error);
  }

  await prisma.$disconnect();
}

testBinanceApi();
