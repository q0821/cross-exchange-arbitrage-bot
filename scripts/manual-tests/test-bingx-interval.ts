/**
 * 測試腳本：檢查 BingX CCXT 回應中的間隔欄位
 */
import { createPublicExchange } from '../../src/lib/ccxt-factory';

async function testBingxInterval() {

  const client = createPublicExchange('bingx');

  try {
    // 測試幾個不同間隔的幣種
    const testSymbols = ['PIPPIN/USDT:USDT', 'BTC/USDT:USDT', 'ETH/USDT:USDT'];

    console.log('=== 測試 fetchFundingRate 回應 ===\n');

    for (const symbol of testSymbols) {
      try {
        const fundingRate = await client.fetchFundingRate(symbol);
        console.log(`\n--- ${symbol} ---`);
        console.log('fundingRate:', fundingRate.fundingRate);
        console.log('fundingTimestamp:', fundingRate.fundingTimestamp);
        console.log('nextFundingTimestamp:', (fundingRate as any).nextFundingTimestamp);
        console.log('info keys:', Object.keys((fundingRate as any).info || {}));
        console.log('info:', JSON.stringify((fundingRate as any).info, null, 2));
      } catch (e) {
        console.log(`${symbol}: Error - ${(e as Error).message}`);
      }
    }

    // 檢查 market info
    console.log('\n\n=== 測試 loadMarkets 回應 ===\n');
    const markets = await client.loadMarkets();

    for (const symbol of testSymbols) {
      const market = markets[symbol];
      if (market) {
        console.log(`\n--- ${symbol} market info ---`);
        console.log('fundingRateFrequency:', (market as any).fundingRateFrequency);
        console.log('fundingInterval:', (market as any).fundingInterval);
        console.log('info.fundingInterval:', (market.info as any)?.fundingInterval);
        console.log('info.fundingIntervalHours:', (market.info as any)?.fundingIntervalHours);
        console.log('info keys:', Object.keys(market.info || {}));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testBingxInterval();
