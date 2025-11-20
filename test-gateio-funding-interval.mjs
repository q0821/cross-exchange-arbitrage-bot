/**
 * 測試腳本：檢查 Gate.io API 回傳的資金費率間隔
 * 用於診斷 1 小時結算交易對被誤判為 8 小時的問題
 */

import ccxt from 'ccxt';

async function testGateioFundingInterval() {
  const symbols = ['SOON/USDT:USDT', 'BTC/USDT:USDT', 'ETH/USDT:USDT'];

  console.log('=== 測試 Gate.io 資金費率間隔 API ===\n');

  const exchange = new ccxt.gateio({
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
    },
  });

  for (const symbol of symbols) {
    console.log(`\n📊 測試 ${symbol}:`);
    console.log('─'.repeat(50));

    try {
      // 1. 測試 fetchFundingRate (目前程式碼使用的方法)
      console.log(`\n1️⃣  呼叫 fetchFundingRate('${symbol}')`);
      const fundingRate = await exchange.fetchFundingRate(symbol);

      console.log('回傳資料 (主要欄位):');
      console.log({
        symbol: fundingRate.symbol,
        fundingRate: fundingRate.fundingRate,
        fundingTimestamp: fundingRate.fundingTimestamp,
        markPrice: fundingRate.markPrice,
      });

      console.log('\n檢查 info.funding_interval:');
      console.log('info:', fundingRate.info);
      console.log('funding_interval:', fundingRate.info?.funding_interval);

      if (fundingRate.info?.funding_interval) {
        const intervalSeconds = fundingRate.info.funding_interval;
        const intervalHours = intervalSeconds / 3600;
        console.log(`✅ funding_interval: ${intervalSeconds} 秒 = ${intervalHours} 小時`);
      } else {
        console.log('❌ funding_interval 欄位不存在');
      }

      // 2. 測試 fetchMarket (獲取 contract 資訊)
      console.log(`\n2️⃣  呼叫 fetchMarket('${symbol}')`);
      await exchange.loadMarkets();
      const market = exchange.market(symbol);

      console.log('Market info (部分):');
      console.log({
        id: market.id,
        symbol: market.symbol,
        type: market.type,
        info: market.info ? '(存在)' : '(不存在)',
      });

      if (market.info?.funding_interval) {
        const intervalSeconds = market.info.funding_interval;
        const intervalHours = intervalSeconds / 3600;
        console.log(`✅ market.info.funding_interval: ${intervalSeconds} 秒 = ${intervalHours} 小時`);
      } else {
        console.log('❌ market.info.funding_interval 欄位不存在');
      }

      // 3. 直接查詢 contract API (如果可能)
      console.log(`\n3️⃣  檢查 market.info 的完整結構`);
      if (market.info) {
        console.log('market.info 包含的欄位:');
        console.log(Object.keys(market.info).join(', '));

        // 查找所有包含 "funding" 的欄位
        const fundingFields = Object.keys(market.info).filter(key =>
          key.toLowerCase().includes('funding')
        );

        if (fundingFields.length > 0) {
          console.log('\n包含 "funding" 的欄位:');
          fundingFields.forEach(key => {
            console.log(`  ${key}: ${market.info[key]}`);
          });
        }
      }

    } catch (error) {
      console.error(`\n❌ 錯誤: ${error.message}`);
      if (error.response) {
        console.error('API 回應:', error.response.data);
      }
    }

    console.log('\n' + '='.repeat(50));
  }

  console.log('\n\n=== 總結 ===');
  console.log('Gate.io 的 funding_interval 欄位位置：');
  console.log('1. fetchFundingRate().info.funding_interval - 需要驗證');
  console.log('2. market.info.funding_interval - 需要驗證');
  console.log('3. Contract API (/futures/usdt/contracts/{contract}) - 官方文件建議');
}

// 執行測試
testGateioFundingInterval().catch(console.error);
