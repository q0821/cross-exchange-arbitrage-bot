/**
 * 測試 MEXC 和 OKX 的資金費率間隔
 */

import ccxt from 'ccxt';

async function testMEXC() {
  console.log('\n=== 測試 MEXC ===\n');
  const exchange = new ccxt.mexc({
    enableRateLimit: true,
    options: { defaultType: 'swap' },
  });

  const symbols = ['SOON/USDT:USDT', 'BTC/USDT:USDT', 'ETH/USDT:USDT'];

  for (const symbol of symbols) {
    console.log(`\n📊 ${symbol}:`);
    console.log('─'.repeat(50));

    try {
      const fundingRate = await exchange.fetchFundingRate(symbol);

      console.log('API 回傳的 info 欄位:');
      console.log('collectCycle:', fundingRate.info?.collectCycle);
      console.log('typeof collectCycle:', typeof fundingRate.info?.collectCycle);

      if (fundingRate.info?.collectCycle) {
        const cycle = fundingRate.info.collectCycle;
        if (typeof cycle === 'string') {
          console.log(`⚠️  collectCycle 是字串: "${cycle}"`);
          const parsed = parseInt(cycle, 10);
          console.log(`   轉換為數字: ${parsed} 小時`);
        } else {
          console.log(`✅ collectCycle 是數字: ${cycle} 小時`);
        }
      } else {
        console.log('❌ 沒有 collectCycle 欄位');
      }

    } catch (error) {
      console.error(`❌ 錯誤: ${error.message}`);
    }
  }
}

async function testOKX() {
  console.log('\n\n=== 測試 OKX ===\n');
  const exchange = new ccxt.okx({
    enableRateLimit: true,
    options: { defaultType: 'swap' },
  });

  const symbols = ['SOON/USDT:USDT', 'BTC/USDT:USDT', 'ETH/USDT:USDT'];

  for (const symbol of symbols) {
    console.log(`\n📊 ${symbol}:`);
    console.log('─'.repeat(50));

    try {
      const fundingRate = await exchange.fetchFundingRate(symbol);

      console.log('API 回傳的 info 欄位:');
      const info = fundingRate.info;
      console.log('fundingTime:', info?.fundingTime);
      console.log('nextFundingTime:', info?.nextFundingTime);
      console.log('typeof fundingTime:', typeof info?.fundingTime);
      console.log('typeof nextFundingTime:', typeof info?.nextFundingTime);

      if (info?.fundingTime && info?.nextFundingTime) {
        const fundingTime = parseInt(info.fundingTime, 10);
        const nextFundingTime = parseInt(info.nextFundingTime, 10);
        const intervalMs = nextFundingTime - fundingTime;
        const intervalHours = Math.round(intervalMs / (60 * 60 * 1000));

        console.log(`✅ 計算間隔: ${intervalHours} 小時`);
        console.log(`   fundingTime: ${new Date(fundingTime).toISOString()}`);
        console.log(`   nextFundingTime: ${new Date(nextFundingTime).toISOString()}`);
      } else {
        console.log('❌ 缺少時間戳欄位');
      }

    } catch (error) {
      console.error(`❌ 錯誤: ${error.message}`);
    }
  }
}

async function main() {
  try {
    await testMEXC();
    await testOKX();

    console.log('\n\n=== 總結 ===');
    console.log('MEXC: 檢查 collectCycle 欄位是字串還是數字');
    console.log('OKX: 使用時間戳計算間隔（應該沒問題）');
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

main().catch(console.error);
