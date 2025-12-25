/**
 * 測試 MEXC Contract 私有 API 端點
 */

import ccxt from 'ccxt';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/encryption';

const prisma = new PrismaClient();

async function testMexcPrivateEndpoints() {
  console.log('='.repeat(60));
  console.log('MEXC Contract 私有 API 端點測試');
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
    timeout: 30000,
    options: {
      defaultType: 'swap',
    },
  });

  await mexc.loadMarkets();

  // 1. 測試私有讀取端點
  console.log('\n1️⃣ 測試 fetchBalance (私有讀取)...');
  try {
    const balance = await mexc.fetchBalance();
    console.log(`   ✅ 成功！USDT: ${balance.total?.USDT || 0}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  console.log('\n2️⃣ 測試 fetchPositions (私有讀取)...');
  try {
    const positions = await mexc.fetchPositions();
    console.log(`   ✅ 成功！持倉數: ${positions.length}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  console.log('\n3️⃣ 測試 fetchPositionMode (私有讀取)...');
  try {
    const positionMode = await mexc.fetchPositionMode('BTC/USDT:USDT');
    console.log(`   ✅ 成功！Hedge Mode: ${positionMode.hedged}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  console.log('\n4️⃣ 測試 fetchLeverage (私有讀取)...');
  try {
    const leverage = await mexc.fetchLeverage('BTC/USDT:USDT');
    console.log(`   ✅ 成功！Long Leverage: ${leverage.longLeverage}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  console.log('\n5️⃣ 測試 fetchOpenOrders (私有讀取)...');
  try {
    const openOrders = await mexc.fetchOpenOrders('BTC/USDT:USDT');
    console.log(`   ✅ 成功！掛單數: ${openOrders.length}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 6. 嘗試寫入端點 - setLeverage (不會產生交易)
  console.log('\n6️⃣ 測試 setLeverage (私有寫入)...');
  try {
    await mexc.setLeverage(1, 'BTC/USDT:USDT');
    console.log(`   ✅ 成功！已設定槓桿為 1x`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
    if (error.message.includes('timed out')) {
      console.log(`   💡 寫入端點超時 - 可能是 API 權限問題`);
    }
  }

  // 7. 嘗試 createOrder (會產生交易)
  console.log('\n7️⃣ 測試 createOrder (私有寫入)...');
  console.log('   使用 DOGE/USDT:USDT，數量 1 張 (約 $12.8)');
  try {
    const order = await mexc.createOrder(
      'DOGE/USDT:USDT',
      'market',
      'buy',
      1,
      undefined,
      { leverage: 1 }
    );
    console.log(`   ✅ 成功！訂單 ID: ${order.id}`);

    // 立即平倉
    console.log('\n   平倉中...');
    await mexc.createOrder(
      'DOGE/USDT:USDT',
      'market',
      'sell',
      1,
      undefined,
      { reduceOnly: true }
    );
    console.log(`   ✅ 平倉成功！`);

  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);

    if (error.message.includes('timed out')) {
      console.log('\n   💡 分析結果:');
      console.log('   - 讀取端點正常工作');
      console.log('   - 寫入端點 (createOrder) 超時');
      console.log('   - 可能原因:');
      console.log('     1. MEXC API Key 未開啟合約交易權限');
      console.log('     2. 帳戶未完成合約交易開通流程');
      console.log('     3. 區域/IP 限制');
    }
  }

  console.log('\n' + '='.repeat(60));
  await prisma.$disconnect();
}

testMexcPrivateEndpoints().catch(async (error) => {
  console.error('錯誤:', error);
  await prisma.$disconnect();
});
