/**
 * BingX Connector 診斷腳本
 * 用於測試 BingX 連接器是否正常運作
 */

import { BingxConnector } from '../connectors/bingx.js';

async function main() {
  console.log('=== BingX Connector 診斷 ===\n');

  const connector = new BingxConnector(false);

  try {
    // 1. 測試連線
    console.log('1. 測試連線...');
    await connector.connect();
    console.log('   ✓ 連線成功\n');

    // 2. 測試獲取單一費率
    console.log('2. 測試獲取 BTCUSDT 費率...');
    const rate = await connector.getFundingRate('BTCUSDT');
    console.log('   ✓ 費率:', rate.fundingRate);
    console.log('   ✓ 間隔:', rate.fundingInterval, '小時');
    console.log('   ✓ 下次結算:', rate.nextFundingTime);
    console.log();

    // 3. 測試批量獲取費率
    console.log('3. 測試批量獲取費率 (BTC, ETH, SOL)...');
    const rates = await connector.getFundingRates(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
    for (const r of rates) {
      console.log(`   ✓ ${r.symbol}: ${(r.fundingRate * 100).toFixed(4)}%`);
    }
    console.log();

    // 4. 測試獲取價格
    console.log('4. 測試獲取價格...');
    const prices = await connector.getPrices(['BTCUSDT', 'ETHUSDT']);
    for (const p of prices) {
      console.log(`   ✓ ${p.symbol}: $${p.price}`);
    }
    console.log();

    console.log('=== 所有測試通過 ===');
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await connector.disconnect();
  }
}

main();
