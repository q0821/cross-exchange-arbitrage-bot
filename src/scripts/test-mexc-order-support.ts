/**
 * 測試 MEXC CCXT 下單功能支援情況
 */

import ccxt from 'ccxt';
import { config } from 'dotenv';

config();

async function testMexcOrderSupport() {
  const apiKey = process.env.MEXC_API_KEY;
  const apiSecret = process.env.MEXC_API_SECRET;

  console.log('='.repeat(60));
  console.log('MEXC CCXT 下單功能支援檢查');
  console.log('='.repeat(60));

  const mexc = new (ccxt as any).mexc({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
    },
  });

  await mexc.loadMarkets();

  // 1. 檢查 CCXT MEXC 的功能支援
  console.log('\n1️⃣ CCXT MEXC 功能檢查:');
  console.log(`   has.createOrder: ${mexc.has['createOrder']}`);
  console.log(`   has.createMarketOrder: ${mexc.has['createMarketOrder']}`);
  console.log(`   has.createLimitOrder: ${mexc.has['createLimitOrder']}`);
  console.log(`   has.createStopOrder: ${mexc.has['createStopOrder']}`);
  console.log(`   has.createStopMarketOrder: ${mexc.has['createStopMarketOrder']}`);
  console.log(`   has.fetchPositions: ${mexc.has['fetchPositions']}`);
  console.log(`   has.fetchBalance: ${mexc.has['fetchBalance']}`);

  // 2. 檢查 swap 市場
  console.log('\n2️⃣ Swap 市場檢查:');
  const btcMarket = mexc.markets['BTC/USDT:USDT'];
  if (btcMarket) {
    console.log(`   BTC/USDT:USDT 存在: ✅`);
    console.log(`   Type: ${btcMarket.type}`);
    console.log(`   Swap: ${btcMarket.swap}`);
    console.log(`   Active: ${btcMarket.active}`);
  } else {
    console.log('   BTC/USDT:USDT 不存在 ❌');
  }

  // 3. 檢查 spot 市場能否下單
  console.log('\n3️⃣ 測試 Spot 市場下單 (不實際執行):');
  try {
    mexc.options['defaultType'] = 'spot';
    // 只是測試方法是否存在，不實際下單
    console.log(`   Spot createOrder 方法存在: ${typeof mexc.createOrder === 'function'}`);
  } catch (error: any) {
    console.log(`   錯誤: ${error.message}`);
  }

  // 4. 嘗試用直接 API 調用
  console.log('\n4️⃣ 檢查 MEXC 直接 API 端點:');
  try {
    // 檢查是否有可用的私有 API 方法
    const privateApiMethods = Object.keys(mexc).filter(key =>
      key.startsWith('private') || key.startsWith('contract')
    );
    console.log(`   找到 ${privateApiMethods.length} 個私有/合約 API 方法`);

    // 列出一些相關的方法
    const orderMethods = privateApiMethods.filter(m =>
      m.toLowerCase().includes('order') || m.toLowerCase().includes('position')
    );
    console.log(`   訂單/持倉相關方法:`);
    orderMethods.slice(0, 10).forEach(m => console.log(`   - ${m}`));
  } catch (error: any) {
    console.log(`   錯誤: ${error.message}`);
  }

  // 5. 查看 CCXT 版本
  console.log('\n5️⃣ CCXT 版本資訊:');
  console.log(`   CCXT 版本: ${ccxt.version}`);

  console.log('\n' + '='.repeat(60));
  console.log('檢查完成');
  console.log('='.repeat(60));
}

testMexcOrderSupport().catch(console.error);
