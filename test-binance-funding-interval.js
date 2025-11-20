/**
 * 測試腳本：檢查幣安 API 回傳的資金費率間隔
 * 用於診斷 SOONUSDT 等交易對的間隔判斷問題
 */

import axios from 'axios';

async function testBinanceFundingInterval() {
  const symbols = ['SOONUSDT', 'BTCUSDT', 'ETHUSDT'];

  console.log('=== 測試幣安資金費率間隔 API ===\n');

  for (const symbol of symbols) {
    console.log(`\n📊 測試 ${symbol}:`);
    console.log('─'.repeat(50));

    try {
      // 1. 測試 /fapi/v1/fundingInfo (單一交易對)
      console.log(`\n1️⃣  呼叫 /fapi/v1/fundingInfo?symbol=${symbol}`);
      const infoResponse = await axios.get('https://fapi.binance.com/fapi/v1/fundingInfo', {
        params: { symbol }
      });

      console.log('回傳資料:');
      console.log(JSON.stringify(infoResponse.data, null, 2));

      // 檢查 fundingIntervalHours
      const fundingIntervalHours = infoResponse.data.fundingIntervalHours;
      console.log(`\n✅ fundingIntervalHours: ${fundingIntervalHours}`);

      // 2. 測試 /fapi/v1/premiumIndex (取得當前資金費率)
      console.log(`\n2️⃣  呼叫 /fapi/v1/premiumIndex?symbol=${symbol}`);
      const premiumResponse = await axios.get('https://fapi.binance.com/fapi/v1/premiumIndex', {
        params: { symbol }
      });

      console.log('回傳資料 (部分):');
      const { symbol: sym, lastFundingRate, nextFundingTime, markPrice } = premiumResponse.data;
      console.log({
        symbol: sym,
        lastFundingRate,
        nextFundingTime: new Date(nextFundingTime).toISOString(),
        markPrice
      });

      // 3. 分析：計算下次結算時間與當前時間的差距
      const now = Date.now();
      const nextTime = premiumResponse.data.nextFundingTime;
      const hoursUntilNext = ((nextTime - now) / (1000 * 60 * 60)).toFixed(2);

      console.log(`\n⏰ 距離下次結算: ${hoursUntilNext} 小時`);
      console.log(`📅 下次結算時間: ${new Date(nextTime).toISOString()}`);

    } catch (error) {
      console.error(`\n❌ 錯誤: ${error.message}`);
      if (error.response) {
        console.error('API 回應:', error.response.data);
      }
    }

    console.log('\n' + '='.repeat(50));
  }

  // 4. 測試不帶參數的 fundingInfo (查看是否有多個交易對回傳)
  console.log('\n\n3️⃣  測試不帶參數的 /fapi/v1/fundingInfo');
  console.log('─'.repeat(50));

  try {
    const allInfoResponse = await axios.get('https://fapi.binance.com/fapi/v1/fundingInfo');
    const allData = Array.isArray(allInfoResponse.data) ? allInfoResponse.data : [allInfoResponse.data];

    console.log(`\n回傳 ${allData.length} 筆資料`);

    // 尋找 SOONUSDT
    const soonData = allData.find(item => item.symbol === 'SOONUSDT');
    if (soonData) {
      console.log('\n✅ 找到 SOONUSDT:');
      console.log(JSON.stringify(soonData, null, 2));
    } else {
      console.log('\n⚠️  未找到 SOONUSDT (可能不在調整列表中)');
    }

    // 顯示所有 1 小時間隔的交易對
    const oneHourSymbols = allData.filter(item => item.fundingIntervalHours === 1);
    console.log(`\n📋 1 小時結算的交易對數量: ${oneHourSymbols.length}`);
    if (oneHourSymbols.length > 0) {
      console.log('範例:', oneHourSymbols.slice(0, 5).map(s => s.symbol).join(', '));
    }

    // 顯示所有 4 小時間隔的交易對
    const fourHourSymbols = allData.filter(item => item.fundingIntervalHours === 4);
    console.log(`\n📋 4 小時結算的交易對數量: ${fourHourSymbols.length}`);
    if (fourHourSymbols.length > 0) {
      console.log('範例:', fourHourSymbols.slice(0, 5).map(s => s.symbol).join(', '));
    }

  } catch (error) {
    console.error(`\n❌ 錯誤: ${error.message}`);
    if (error.response) {
      console.error('狀態碼:', error.response.status);
      console.error('API 回應:', error.response.data);
    }
  }
}

// 執行測試
testBinanceFundingInterval().catch(console.error);
