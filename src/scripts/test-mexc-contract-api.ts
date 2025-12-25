/**
 * 測試 MEXC Contract API 連通性
 */

import ccxt from 'ccxt';

async function testMexcContractApi() {
  console.log('='.repeat(60));
  console.log('MEXC Contract API 連通性測試');
  console.log('='.repeat(60));

  const mexc = new ccxt.mexc({
    enableRateLimit: true,
    timeout: 30000,
    options: {
      defaultType: 'swap',
    },
  });

  // 1. 測試公開的合約 API 端點
  console.log('\n1️⃣ 測試公開合約 API...');

  try {
    // 這個方法會調用 contract.mexc.com
    const ticker = await mexc.fetchTicker('BTC/USDT:USDT');
    console.log(`   ✅ fetchTicker 成功`);
    console.log(`   價格: ${ticker.last}`);
  } catch (error: any) {
    console.log(`   ❌ fetchTicker 失敗: ${error.message}`);
  }

  try {
    const fundingRate = await mexc.fetchFundingRate('BTC/USDT:USDT');
    console.log(`   ✅ fetchFundingRate 成功`);
    console.log(`   資金費率: ${(fundingRate.fundingRate! * 100).toFixed(4)}%`);
  } catch (error: any) {
    console.log(`   ❌ fetchFundingRate 失敗: ${error.message}`);
  }

  // 2. 顯示實際調用的 URL
  console.log('\n2️⃣ CCXT MEXC 端點配置:');
  console.log(`   Spot API: ${mexc.urls['api']?.['spot'] || mexc.urls['api']}`);
  console.log(`   Swap API: ${mexc.urls['api']?.['swap'] || 'N/A'}`);
  console.log(`   Contract API: ${mexc.urls['api']?.['contract'] || 'N/A'}`);

  // 3. 檢查 CCXT 使用的實際 hostname
  console.log('\n3️⃣ 檢查 MEXC API URLs:');
  const urls = mexc.urls as any;
  if (urls.api) {
    if (typeof urls.api === 'string') {
      console.log(`   API: ${urls.api}`);
    } else {
      Object.keys(urls.api).forEach(key => {
        console.log(`   ${key}: ${urls.api[key]}`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
}

testMexcContractApi().catch(console.error);
