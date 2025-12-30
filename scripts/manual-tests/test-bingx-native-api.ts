/**
 * 測試腳本：檢查 BingX 原生 API 的間隔欄位
 */
import axios from 'axios';

async function testBingxNativeApi() {
  const baseUrl = 'https://open-api.bingx.com';

  try {
    // 測試 1: 合約資訊 API
    console.log('=== 測試 /openApi/swap/v2/quote/contracts ===\n');
    const contractsRes = await axios.get(`${baseUrl}/openApi/swap/v2/quote/contracts`);

    if (contractsRes.data.code === 0) {
      const contracts = contractsRes.data.data;
      // 找幾個測試用的合約
      const testSymbols = ['PIPPIN-USDT', 'BTC-USDT', 'ETH-USDT', 'DOGE-USDT'];

      for (const symbol of testSymbols) {
        const contract = contracts.find((c: any) => c.symbol === symbol);
        if (contract) {
          console.log(`\n--- ${symbol} ---`);
          console.log('Keys:', Object.keys(contract));
          // 找可能跟間隔相關的欄位
          const intervalKeys = Object.keys(contract).filter(k =>
            k.toLowerCase().includes('fund') ||
            k.toLowerCase().includes('interval') ||
            k.toLowerCase().includes('settle') ||
            k.toLowerCase().includes('rate')
          );
          console.log('Interval related keys:', intervalKeys);
          for (const key of intervalKeys) {
            console.log(`  ${key}:`, contract[key]);
          }
        }
      }
    } else {
      console.log('Error:', contractsRes.data);
    }

    // 測試 2: 資金費率 API
    console.log('\n\n=== 測試 /openApi/swap/v2/quote/premiumIndex ===\n');
    for (const symbol of ['PIPPIN-USDT', 'BTC-USDT']) {
      const fundingRes = await axios.get(`${baseUrl}/openApi/swap/v2/quote/premiumIndex`, {
        params: { symbol }
      });
      console.log(`\n--- ${symbol} premiumIndex ---`);
      console.log('Response:', JSON.stringify(fundingRes.data, null, 2));
    }

  } catch (error) {
    console.error('Error:', (error as any).response?.data || (error as Error).message);
  }
}

testBingxNativeApi();
