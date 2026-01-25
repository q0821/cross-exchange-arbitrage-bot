/**
 * Gate.io 公開 API 連線診斷腳本
 * 測試 fetchTime 和 fetchTickers
 */

import { createPublicExchange } from '../../src/lib/ccxt-factory';
import { getProxyUrl } from '../../src/lib/env';

async function main() {
  console.log('=== Gate.io 公開 API 連線診斷 ===\n');

  const proxyUrl = getProxyUrl();
  console.log('Proxy 配置:', proxyUrl ? proxyUrl : '無');


  const exchange = createPublicExchange('gateio');

  console.log('\n1. 測試 fetchTime...');
  const startTime1 = Date.now();
  try {
    const time = await exchange.fetchTime();
    console.log(`✅ fetchTime 成功 (${Date.now() - startTime1}ms)`);
    console.log(`   伺服器時間: ${new Date(time).toISOString()}`);
  } catch (error) {
    console.log(`❌ fetchTime 失敗 (${Date.now() - startTime1}ms)`);
    console.log(`   錯誤類型: ${error?.constructor?.name}`);
    console.log(`   錯誤訊息: ${(error as Error)?.message}`);
  }

  console.log('\n2. 測試 loadMarkets...');
  const startTime2 = Date.now();
  try {
    const markets = await exchange.loadMarkets();
    const marketCount = Object.keys(markets).length;
    console.log(`✅ loadMarkets 成功 (${Date.now() - startTime2}ms)`);
    console.log(`   市場數量: ${marketCount}`);
  } catch (error) {
    console.log(`❌ loadMarkets 失敗 (${Date.now() - startTime2}ms)`);
    console.log(`   錯誤類型: ${error?.constructor?.name}`);
    console.log(`   錯誤訊息: ${(error as Error)?.message}`);
  }

  console.log('\n3. 測試 fetchTickers (BTC, ETH, SOL)...');
  const symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];
  const startTime3 = Date.now();
  try {
    const tickers = await exchange.fetchTickers(symbols);
    console.log(`✅ fetchTickers 成功 (${Date.now() - startTime3}ms)`);
    for (const [symbol, ticker] of Object.entries(tickers)) {
      const t = ticker as ccxt.Ticker;
      console.log(`   ${symbol}: ${t.last}`);
    }
  } catch (error) {
    console.log(`❌ fetchTickers 失敗 (${Date.now() - startTime3}ms)`);
    console.log(`   錯誤類型: ${error?.constructor?.name}`);
    console.log(`   錯誤訊息: ${(error as Error)?.message}`);
  }

  console.log('\n4. 測試 fetchFundingRates (BTC)...');
  const startTime4 = Date.now();
  try {
    const fundingRate = await exchange.fetchFundingRate('BTC/USDT:USDT');
    console.log(`✅ fetchFundingRate 成功 (${Date.now() - startTime4}ms)`);
    console.log(`   資金費率: ${fundingRate.fundingRate}`);
    console.log(`   下次結算: ${fundingRate.fundingTimestamp ? new Date(fundingRate.fundingTimestamp).toISOString() : 'N/A'}`);
  } catch (error) {
    console.log(`❌ fetchFundingRate 失敗 (${Date.now() - startTime4}ms)`);
    console.log(`   錯誤類型: ${error?.constructor?.name}`);
    console.log(`   錯誤訊息: ${(error as Error)?.message}`);
  }

  console.log('\n=== 診斷完成 ===');
}

main();
