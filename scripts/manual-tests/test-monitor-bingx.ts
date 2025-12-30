/**
 * FundingRateMonitor BingX 整合測試腳本
 * 用於診斷為什麼 BingX 數據不顯示在市場監控中
 */

import { FundingRateMonitor } from '../services/monitor/FundingRateMonitor';
import { ratesCache } from '../services/monitor/RatesCache';
import { logger } from '../lib/logger';

async function main() {
  console.log('=== FundingRateMonitor BingX 診斷 ===\n');

  // 使用測試交易對
  const testSymbols = ['BTCUSDT', 'ETHUSDT'];
  const exchanges = ['binance', 'okx', 'mexc', 'gateio', 'bingx'] as const;

  console.log('1. 創建 FundingRateMonitor...');
  console.log('   交易所:', exchanges);
  console.log('   交易對:', testSymbols);

  const monitor = new FundingRateMonitor(
    testSymbols,
    30000, // 30 秒更新間隔
    0.005,
    false,
    {
      exchanges: [...exchanges],
    }
  );

  try {
    console.log('\n2. 啟動 Monitor...');
    await monitor.start();
    console.log('   ✓ Monitor 啟動成功');

    console.log('\n3. 等待第一次更新 (5 秒)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('\n4. 檢查 RatesCache...');
    const allRates = ratesCache.getAll();
    console.log(`   快取中有 ${allRates.length} 個交易對`);

    for (const rate of allRates) {
      console.log(`\n   === ${rate.symbol} ===`);
      console.log('   交易所數據:');

      for (const exchangeName of exchanges) {
        const exchangeData = rate.exchanges.get(exchangeName);
        if (exchangeData) {
          console.log(`     ${exchangeName}:`);
          console.log(`       費率: ${(exchangeData.rate.fundingRate * 100).toFixed(4)}%`);
          console.log(`       價格: $${exchangeData.price || 'N/A'}`);
        } else {
          console.log(`     ${exchangeName}: ❌ 無數據`);
        }
      }

      if (rate.bestPair) {
        console.log(`   最佳套利對:`);
        console.log(`     做多: ${rate.bestPair.longExchange}`);
        console.log(`     做空: ${rate.bestPair.shortExchange}`);
        console.log(`     利差: ${rate.bestPair.spreadPercent?.toFixed(4)}%`);
      }
    }

    console.log('\n5. 停止 Monitor...');
    await monitor.stop();
    console.log('   ✓ Monitor 已停止');

    console.log('\n=== 診斷完成 ===');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    await monitor.stop();
  }
}

main();
