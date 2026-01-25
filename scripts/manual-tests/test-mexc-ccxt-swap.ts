/**
 * 使用 CCXT 正確方式測試 MEXC Swap 下單
 * 根據 CCXT 官方文件設定參數
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../lib/encryption';
import { createCcxtExchange } from '../../src/lib/ccxt-factory';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMexcCcxtSwap() {
  console.log('='.repeat(60));
  console.log('MEXC CCXT Swap 下單測試 (根據官方文件)');
  console.log('='.repeat(60));

  // 從資料庫獲取 API Key
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


  const mexc = createCcxtExchange('mexc', {
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'swap', // 永續合約
    },
  });

  console.log('\n1️⃣ 載入市場...');
  await mexc.loadMarkets();

  // 使用 CCXT 統一格式的交易對
  const symbol = 'BTC/USDT:USDT';
  const market = mexc.markets[symbol];

  if (!market) {
    console.log(`❌ 找不到市場: ${symbol}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`   ✅ 市場存在: ${symbol}`);
  console.log(`   Type: ${market.type}`);
  console.log(`   Swap: ${market.swap}`);
  console.log(`   Contract Size: ${market.contractSize}`);
  console.log(`   Min Amount: ${market.limits?.amount?.min}`);

  // 2. 檢查餘額
  console.log('\n2️⃣ 檢查餘額...');
  try {
    const balance = await mexc.fetchBalance();
    const usdt = balance.total?.USDT || 0;
    const usdtFree = balance.free?.USDT || 0;
    console.log(`   USDT 總額: ${usdt}`);
    console.log(`   USDT 可用: ${usdtFree}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 3. 檢查持倉模式
  console.log('\n3️⃣ 檢查持倉模式...');
  let isHedged = false;
  try {
    const positionMode = await mexc.fetchPositionMode(symbol);
    isHedged = positionMode.hedged;
    console.log(`   Hedge Mode: ${isHedged}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 4. 獲取當前價格
  console.log('\n4️⃣ 獲取價格...');
  let currentPrice: number;
  try {
    const ticker = await mexc.fetchTicker(symbol);
    currentPrice = ticker.last!;
    console.log(`   ${symbol} 價格: ${currentPrice}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
    await prisma.$disconnect();
    return;
  }

  // 5. 檢查槓桿
  console.log('\n5️⃣ 檢查槓桿...');
  try {
    const leverage = await mexc.fetchLeverage(symbol);
    console.log(`   當前槓桿: ${JSON.stringify(leverage)}`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 6. 檢查 CCXT has 功能
  console.log('\n6️⃣ CCXT 功能支援檢查:');
  console.log(`   has.createOrder: ${mexc.has['createOrder']}`);
  console.log(`   has.createMarketOrder: ${mexc.has['createMarketOrder']}`);
  console.log(`   has.createLimitOrder: ${mexc.has['createLimitOrder']}`);
  console.log(`   has.fetchPositions: ${mexc.has['fetchPositions']}`);

  // 7. 嘗試下單 (使用最小數量)
  console.log('\n7️⃣ 嘗試開多單...');

  // 根據合約規格計算最小數量
  const minAmount = market.limits?.amount?.min || 1;
  const contractSize = market.contractSize || 0.0001;

  console.log(`   交易對: ${symbol}`);
  console.log(`   最小數量: ${minAmount} 張合約`);
  console.log(`   合約大小: ${contractSize} BTC`);
  console.log(`   實際 BTC: ${minAmount * contractSize}`);

  let orderId: string | null = null;
  try {
    // 根據 CCXT 文件，MEXC swap 需要以下參數
    const orderParams: any = {
      leverage: 1,           // 槓桿倍數
      hedged: isHedged,      // 是否雙向持倉
      positionMode: isHedged ? 1 : 2, // 1=hedge, 2=one-way
    };

    console.log(`   下單參數: ${JSON.stringify(orderParams)}`);

    // 使用市價單開多
    const order = await mexc.createOrder(
      symbol,
      'market',
      'buy',
      minAmount, // 合約數量
      undefined, // 市價單不需要價格
      orderParams
    );

    console.log(`   ✅ 開倉成功！`);
    console.log(`   訂單 ID: ${order.id}`);
    console.log(`   狀態: ${order.status}`);
    console.log(`   成交數量: ${order.filled}`);
    console.log(`   成交均價: ${order.average}`);
    orderId = order.id;

  } catch (error: any) {
    console.log(`   ❌ 開倉失敗: ${error.message}`);

    // 顯示詳細錯誤
    if (error.constructor.name) {
      console.log(`   錯誤類型: ${error.constructor.name}`);
    }
  }

  if (!orderId) {
    console.log('\n❌ 開倉失敗，無法繼續測試平倉');
    await prisma.$disconnect();
    return;
  }

  await sleep(2000);

  // 8. 確認持倉
  console.log('\n8️⃣ 確認持倉...');
  try {
    const positions = await mexc.fetchPositions([symbol]);
    const activePositions = positions.filter((p: any) =>
      parseFloat(p.contracts || '0') > 0
    );

    console.log(`   活躍持倉數: ${activePositions.length}`);
    activePositions.forEach((p: any) => {
      console.log(`   - ${p.symbol}: ${p.side} ${p.contracts} 張`);
      console.log(`     開倉均價: ${p.entryPrice}`);
      console.log(`     未實現盈虧: ${p.unrealizedPnl}`);
    });
  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }

  // 9. 平倉
  console.log('\n9️⃣ 平倉...');
  try {
    const closeParams: any = {
      reduceOnly: true,
      hedged: isHedged,
      positionMode: isHedged ? 1 : 2,
    };

    const closeOrder = await mexc.createOrder(
      symbol,
      'market',
      'sell', // 平多用 sell
      minAmount,
      undefined,
      closeParams
    );

    console.log(`   ✅ 平倉成功！`);
    console.log(`   訂單 ID: ${closeOrder.id}`);
    console.log(`   狀態: ${closeOrder.status}`);
    console.log(`   成交均價: ${closeOrder.average}`);
  } catch (error: any) {
    console.log(`   ❌ 平倉失敗: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('測試完成');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testMexcCcxtSwap().catch(async (error) => {
  console.error('錯誤:', error);
  await prisma.$disconnect();
});
