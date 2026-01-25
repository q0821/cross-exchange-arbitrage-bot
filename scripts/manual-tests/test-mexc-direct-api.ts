/**
 * 使用 MEXC 合約 API 直接下單測試
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../lib/encryption';
import { createCcxtExchange } from '../../src/lib/ccxt-factory';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMexcDirectApi() {
  console.log('='.repeat(60));
  console.log('MEXC 合約 API 直接下單測試');
  console.log('='.repeat(60));

  // 從資料庫獲取 API Key
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { exchange: 'mexc', isActive: true, environment: 'MAINNET' },
  });

  if (!apiKeyRecord) {
    console.log('❌ 找不到 MEXC API Key');
    return;
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);
  const apiSecret = decrypt(apiKeyRecord.encryptedSecret);


  const mexc = createCcxtExchange('mexc', {
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    timeout: 30000, // 30 秒超時
  });

  await mexc.loadMarkets();

  const symbol = 'BTC_USDT'; // MEXC 合約格式
  const amount = 0.001;

  // 1. 獲取當前價格
  console.log('\n1️⃣ 獲取價格...');
  let currentPrice: number;
  try {
    const ticker = await mexc.contractPublicGetTicker({ symbol });
    currentPrice = parseFloat(ticker.data.lastPrice);
    console.log(`   BTC_USDT 價格: ${currentPrice}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
    await prisma.$disconnect();
    return;
  }

  // 2. 檢查餘額
  console.log('\n2️⃣ 檢查餘額...');
  try {
    const assets = await mexc.contractPrivateGetAccountAssets();
    const usdtAsset = assets.data?.find((a: any) => a.currency === 'USDT');
    console.log(`   USDT 可用: ${usdtAsset?.availableBalance || 0}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 3. 獲取持倉模式
  console.log('\n3️⃣ 獲取持倉模式...');
  try {
    const positionMode = await mexc.contractPrivateGetPositionPositionMode();
    console.log(`   持倉模式: ${JSON.stringify(positionMode.data)}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 4. 開多單
  console.log('\n4️⃣ 開多單...');
  console.log(`   交易對: ${symbol}`);
  console.log(`   數量: ${amount} BTC`);

  let orderId: string | null = null;
  try {
    // MEXC 合約下單參數
    const orderParams = {
      symbol: symbol,
      price: currentPrice, // 市價單也需要價格參考
      vol: amount,
      side: 1, // 1=開多, 2=開空, 3=平多, 4=平空
      type: 5, // 5=市價單, 1=限價單
      openType: 1, // 1=逐倉, 2=全倉
      leverage: 1,
    };

    console.log(`   下單參數: ${JSON.stringify(orderParams)}`);

    const order = await mexc.contractPrivatePostOrderSubmit(orderParams);
    console.log(`   回應: ${JSON.stringify(order)}`);

    if (order.data) {
      orderId = order.data;
      console.log(`   ✅ 開倉成功！訂單 ID: ${orderId}`);
    }
  } catch (error: any) {
    console.log(`   ❌ 開倉失敗: ${error.message}`);

    // 嘗試解析更詳細的錯誤
    if (error.message.includes('code')) {
      try {
        const errorData = JSON.parse(error.message);
        console.log(`   錯誤碼: ${errorData.code}`);
        console.log(`   錯誤訊息: ${errorData.msg}`);
      } catch { /* JSON 解析失敗時忽略 */ }
    }
  }

  if (!orderId) {
    console.log('\n開倉失敗，無法繼續測試');
    await prisma.$disconnect();
    return;
  }

  await sleep(2000);

  // 5. 確認持倉
  console.log('\n5️⃣ 確認持倉...');
  try {
    const positions = await mexc.contractPrivateGetPositionOpenPositions({ symbol });
    console.log(`   持倉數據: ${JSON.stringify(positions.data)}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 6. 平倉
  console.log('\n6️⃣ 平倉...');
  try {
    const closeParams = {
      symbol: symbol,
      price: currentPrice,
      vol: amount,
      side: 3, // 平多
      type: 5, // 市價單
      openType: 1,
    };

    const closeOrder = await mexc.contractPrivatePostOrderSubmit(closeParams);
    console.log(`   ✅ 平倉成功！訂單 ID: ${closeOrder.data}`);
  } catch (error: any) {
    console.log(`   ❌ 平倉失敗: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('測試完成');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testMexcDirectApi().catch(async (error) => {
  console.error('錯誤:', error);
  await prisma.$disconnect();
});
