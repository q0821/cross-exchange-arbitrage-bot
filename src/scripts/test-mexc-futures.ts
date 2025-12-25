/**
 * MEXC Futures API 功能驗證腳本
 * 測試 CCXT 是否真的支援 MEXC 合約交易
 */

import ccxt from 'ccxt';
import { config } from 'dotenv';

config();

async function testMexcFutures() {
  const apiKey = process.env.MEXC_API_KEY;
  const apiSecret = process.env.MEXC_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log('❌ 請設定 MEXC_API_KEY 和 MEXC_API_SECRET 環境變數');
    return;
  }

  console.log('='.repeat(60));
  console.log('MEXC Futures API 功能驗證');
  console.log('='.repeat(60));

  const mexc = new (ccxt as any).mexc({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'swap', // 永續合約
    },
  });

  // 1. 測試載入市場
  console.log('\n1️⃣ 載入市場資訊...');
  try {
    const markets = await mexc.loadMarkets();
    const swapMarkets = Object.values(markets).filter((m: any) => m.swap);
    console.log(`   ✅ 成功！找到 ${swapMarkets.length} 個永續合約市場`);
    console.log(`   範例: ${(swapMarkets.slice(0, 3) as any[]).map((m: any) => m.symbol).join(', ')}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 2. 測試獲取資金費率
  console.log('\n2️⃣ 獲取 BTC/USDT:USDT 資金費率...');
  try {
    const fundingRate = await mexc.fetchFundingRate('BTC/USDT:USDT');
    console.log(`   ✅ 成功！`);
    console.log(`   資金費率: ${(fundingRate.fundingRate * 100).toFixed(4)}%`);
    console.log(`   標記價格: ${fundingRate.markPrice}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 3. 測試獲取餘額
  console.log('\n3️⃣ 獲取合約帳戶餘額...');
  try {
    const balance = await mexc.fetchBalance();
    const usdt = balance.total?.USDT || 0;
    console.log(`   ✅ 成功！`);
    console.log(`   USDT 餘額: ${usdt}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 4. 測試獲取持倉
  console.log('\n4️⃣ 獲取當前持倉...');
  try {
    const positions = await mexc.fetchPositions();
    const activePositions = positions.filter((p: any) => parseFloat(p.contracts || '0') > 0);
    console.log(`   ✅ 成功！`);
    console.log(`   活躍持倉數: ${activePositions.length}`);
    if (activePositions.length > 0) {
      activePositions.forEach((p: any) => {
        console.log(`   - ${p.symbol}: ${p.side} ${p.contracts} 張`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 5. 測試獲取持倉模式
  console.log('\n5️⃣ 獲取持倉模式...');
  try {
    const positionMode = await mexc.fetchPositionMode();
    console.log(`   ✅ 成功！`);
    console.log(`   Hedge Mode: ${positionMode.hedged}`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 6. 測試獲取槓桿
  console.log('\n6️⃣ 獲取 BTC/USDT:USDT 槓桿設定...');
  try {
    const leverage = await mexc.fetchLeverage('BTC/USDT:USDT');
    console.log(`   ✅ 成功！`);
    console.log(`   當前槓桿: ${leverage.longLeverage || leverage.leverage}x`);
  } catch (error: any) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }

  // 7. 檢查 createOrder 方法是否存在
  console.log('\n7️⃣ 檢查下單方法...');
  if (typeof mexc.createOrder === 'function') {
    console.log('   ✅ createOrder 方法存在');
    console.log('   ⚠️ 不執行實際下單以避免產生費用');
  } else {
    console.log('   ❌ createOrder 方法不存在');
  }

  console.log('\n' + '='.repeat(60));
  console.log('驗證完成');
  console.log('='.repeat(60));
}

testMexcFutures().catch(console.error);
