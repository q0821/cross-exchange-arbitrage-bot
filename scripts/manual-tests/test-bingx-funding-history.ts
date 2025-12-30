/**
 * 測試腳本：從 BingX 資金費率歷史計算間隔
 */
import axios from 'axios';

async function testBingxFundingHistory() {
  const baseUrl = 'https://open-api.bingx.com';

  const testSymbols = ['PIPPIN-USDT', 'BTC-USDT', 'ETH-USDT'];

  for (const symbol of testSymbols) {
    try {
      console.log(`\n=== ${symbol} 資金費率歷史 ===`);

      // 嘗試資金費率歷史 API
      const historyRes = await axios.get(`${baseUrl}/openApi/swap/v2/quote/fundingRate`, {
        params: { symbol, limit: 5 }
      });

      if (historyRes.data.code === 0 && historyRes.data.data?.length > 1) {
        const history = historyRes.data.data;
        console.log('歷史記錄數:', history.length);

        // 計算間隔
        for (let i = 0; i < Math.min(3, history.length - 1); i++) {
          const current = history[i];
          const previous = history[i + 1];
          const diffMs = current.fundingTime - previous.fundingTime;
          const diffHours = diffMs / (1000 * 60 * 60);
          console.log(`記錄 ${i}: fundingTime=${current.fundingTime}, fundingRate=${current.fundingRate}`);
          console.log(`  間隔: ${diffHours} 小時`);
        }
      } else {
        console.log('Response:', JSON.stringify(historyRes.data, null, 2));
      }
    } catch (error) {
      console.log(`${symbol} Error:`, (error as any).response?.data || (error as Error).message);
    }
  }
}

testBingxFundingHistory();
