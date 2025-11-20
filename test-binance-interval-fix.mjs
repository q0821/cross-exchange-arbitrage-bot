/**
 * 測試修復後的 Binance Connector getFundingInterval 方法
 */

import { BinanceConnector } from './src/connectors/binance.js';

async function testFix() {
  console.log('=== 測試修復後的 Binance Connector ===\n');

  const connector = new BinanceConnector(false);
  await connector.connect();

  // 測試不同間隔的交易對
  const testSymbols = [
    { symbol: 'KAVAUSDT', expected: 1, description: '1 小時結算' },
    { symbol: 'BIGTIMEUSDT', expected: 4, description: '4 小時結算' },
    { symbol: 'BTCUSDT', expected: 8, description: '8 小時結算（預設）' },
    { symbol: 'SOONUSDT', expected: null, description: '新幣種（可能不在 fundingInfo 中）' },
  ];

  for (const test of testSymbols) {
    console.log(`\n📊 測試 ${test.symbol} (${test.description})`);
    console.log('─'.repeat(50));

    try {
      const interval = await connector.getFundingInterval(test.symbol);
      console.log(`✅ 取得間隔: ${interval} 小時`);

      if (test.expected !== null) {
        if (interval === test.expected) {
          console.log(`🎯 正確！符合預期: ${test.expected} 小時`);
        } else {
          console.log(`❌ 錯誤！預期: ${test.expected} 小時，實際: ${interval} 小時`);
        }
      }

      // 測試快取
      console.log('\n測試快取...');
      const cachedInterval = await connector.getFundingInterval(test.symbol);
      console.log(`✅ 快取取得間隔: ${cachedInterval} 小時`);

    } catch (error) {
      console.error(`❌ 錯誤: ${error.message}`);
    }
  }

  await connector.disconnect();
  console.log('\n\n=== 測試完成 ===');
}

testFix().catch(console.error);
