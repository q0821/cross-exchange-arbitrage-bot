/**
 * 測試 MEXC Swap 下單 - 使用非 BTC/ETH/LTC 的幣種
 * 根據 GitHub Issue 報告，MEXC 不允許 BTC/ETH/LTC 透過 API 交易
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../lib/encryption';
import { createCcxtExchange } from '../lib/ccxt/exchangeFactory';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMexcAltSwap() {
  console.log('='.repeat(60));
  console.log('MEXC 替代幣種 Swap 下單測試');
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

  const mexc = createCcxtExchange('mexc', {
    apiKey,
    secret: apiSecret,
    options: {
      defaultType: 'swap',
    },
  });

  console.log('\n1️⃣ 載入市場...');
  await mexc.loadMarkets();

  // 嘗試多個替代幣種
  const testSymbols = [
    'LINK/USDT:USDT',
    'DOGE/USDT:USDT',
    'XRP/USDT:USDT',
    'SOL/USDT:USDT',
    'AVAX/USDT:USDT',
  ];

  // 檢查持倉模式
  console.log('\n2️⃣ 檢查持倉模式...');
  let isHedged = false;
  try {
    const positionMode = await mexc.fetchPositionMode('BTC/USDT:USDT');
    isHedged = positionMode.hedged;
    console.log(`   Hedge Mode: ${isHedged}`);
  } catch (error: any) {
    console.log(`   ⚠️ ${error.message}`);
  }

  // 嘗試每個幣種
  for (const symbol of testSymbols) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🔄 測試: ${symbol}`);
    console.log('='.repeat(40));

    const market = mexc.markets[symbol];
    if (!market) {
      console.log(`   ❌ 市場不存在`);
      continue;
    }

    console.log(`   ✅ 市場存在`);
    console.log(`   合約大小: ${market.contractSize}`);
    console.log(`   最小數量: ${market.limits?.amount?.min}`);

    // 獲取價格
    let currentPrice: number;
    try {
      const ticker = await mexc.fetchTicker(symbol);
      currentPrice = ticker.last!;
      console.log(`   價格: ${currentPrice}`);
    } catch (error: any) {
      console.log(`   ❌ 獲取價格失敗: ${error.message}`);
      continue;
    }

    // 嘗試下單
    const minAmount = market.limits?.amount?.min || 1;

    console.log(`\n   📝 嘗試開多單...`);
    console.log(`   數量: ${minAmount} 張`);

    try {
      const orderParams: any = {
        leverage: 1,
        hedged: isHedged,
        positionMode: isHedged ? 1 : 2,
      };

      const order = await mexc.createOrder(
        symbol,
        'market',
        'buy',
        minAmount,
        undefined,
        orderParams
      );

      console.log(`   ✅ 開倉成功！`);
      console.log(`   訂單 ID: ${order.id}`);
      console.log(`   狀態: ${order.status}`);
      console.log(`   成交均價: ${order.average}`);

      await sleep(1000);

      // 立即平倉
      console.log(`\n   📝 平倉...`);
      try {
        const closeOrder = await mexc.createOrder(
          symbol,
          'market',
          'sell',
          minAmount,
          undefined,
          { reduceOnly: true, hedged: isHedged, positionMode: isHedged ? 1 : 2 }
        );
        console.log(`   ✅ 平倉成功！訂單 ID: ${closeOrder.id}`);
      } catch (closeError: any) {
        console.log(`   ⚠️ 平倉失敗: ${closeError.message}`);
      }

      // 找到一個可用的幣種就結束
      console.log(`\n✅ 發現可用幣種: ${symbol}`);
      break;

    } catch (error: any) {
      console.log(`   ❌ 開倉失敗: ${error.message}`);

      // 檢查是不是 NotSupported 還是其他錯誤
      if (error.constructor.name === 'NotSupported') {
        console.log(`   原因: CCXT 尚未支援此幣種的 swap 下單`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('測試完成');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testMexcAltSwap().catch(async (error) => {
  console.error('錯誤:', error);
  await prisma.$disconnect();
});
