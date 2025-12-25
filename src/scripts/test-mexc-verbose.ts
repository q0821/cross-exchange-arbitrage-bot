/**
 * 詳細模式測試 MEXC Swap 下單
 */

import ccxt from 'ccxt';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/encryption';

const prisma = new PrismaClient();

async function testMexcVerbose() {
  console.log('='.repeat(60));
  console.log('MEXC 詳細模式測試');
  console.log('='.repeat(60));

  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { exchange: 'mexc', isActive: true, environment: 'MAINNET' },
  });

  if (!apiKeyRecord) {
    console.log('❌ 找不到 MEXC API Key');
    await prisma.$disconnect();
    return;
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);
  const apiSecret = decrypt(apiKeyRecord.encryptedSecret);

  const mexc = new (ccxt as any).mexc({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    timeout: 60000, // 60 秒超時
    verbose: true,  // 詳細日誌
    options: {
      defaultType: 'swap',
    },
  });

  console.log('\n1️⃣ 載入市場...');
  await mexc.loadMarkets();

  // 使用 DOGE 測試 (價格較低)
  const symbol = 'DOGE/USDT:USDT';
  const market = mexc.markets[symbol];

  console.log(`\n2️⃣ 市場資訊: ${symbol}`);
  console.log(`   合約大小: ${market.contractSize}`);
  console.log(`   最小數量: ${market.limits?.amount?.min}`);

  // 檢查持倉模式
  let isHedged = false;
  try {
    const positionMode = await mexc.fetchPositionMode(symbol);
    isHedged = positionMode.hedged;
    console.log(`\n3️⃣ Hedge Mode: ${isHedged}`);
  } catch (error: any) {
    console.log(`\n3️⃣ ⚠️ 持倉模式: ${error.message}`);
  }

  // 獲取價格
  const ticker = await mexc.fetchTicker(symbol);
  console.log(`\n4️⃣ 價格: ${ticker.last}`);

  // 嘗試下單
  console.log('\n5️⃣ 嘗試開多單 (60 秒超時)...');
  console.log('   (以下是 CCXT verbose 輸出)');
  console.log('-'.repeat(40));

  try {
    const order = await mexc.createOrder(
      symbol,
      'market',
      'buy',
      1, // 最小數量
      undefined,
      {
        leverage: 1,
        hedged: isHedged,
        positionMode: isHedged ? 1 : 2,
      }
    );

    console.log('-'.repeat(40));
    console.log(`   ✅ 成功！訂單 ID: ${order.id}`);

    // 立即平倉
    console.log('\n6️⃣ 平倉...');
    const closeOrder = await mexc.createOrder(
      symbol,
      'market',
      'sell',
      1,
      undefined,
      { reduceOnly: true }
    );
    console.log(`   ✅ 平倉成功！訂單 ID: ${closeOrder.id}`);

  } catch (error: any) {
    console.log('-'.repeat(40));
    console.log(`   ❌ 失敗: ${error.message}`);
    console.log(`   錯誤類型: ${error.constructor.name}`);

    if (error.message.includes('timed out')) {
      console.log('\n   💡 超時原因可能:');
      console.log('   1. MEXC 合約 API 對此 IP/區域有限制');
      console.log('   2. MEXC 合約 API 維護中');
      console.log('   3. 需要在 MEXC 帳戶開通合約交易權限');
    }
  }

  console.log('\n' + '='.repeat(60));
  await prisma.$disconnect();
}

testMexcVerbose().catch(async (error) => {
  console.error('錯誤:', error);
  await prisma.$disconnect();
});
