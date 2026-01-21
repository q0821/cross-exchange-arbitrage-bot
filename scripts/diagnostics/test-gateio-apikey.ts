/**
 * 診斷腳本：測試 Gate.io API Key 驗證
 *
 * 用法：pnpm tsx scripts/diagnostics/test-gateio-apikey.ts
 */

import { createAuthenticatedExchange } from '../../src/lib/ccxt-factory';

async function main() {
  // 從環境變數讀取 API credentials
  const apiKey = process.env.GATEIO_API_KEY;
  const apiSecret = process.env.GATEIO_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('請設定環境變數 GATEIO_API_KEY 和 GATEIO_API_SECRET');
    process.exit(1);
  }

  console.log('=== Gate.io API Key 驗證測試 ===\n');
  console.log('API Key:', apiKey.substring(0, 8) + '...');
  console.log('Proxy:', process.env.PROXY_URL || '未設定');
  console.log('');

  try {
    console.log('1. 創建 CCXT 實例...');
    const startCreate = Date.now();
    const exchange = createAuthenticatedExchange('gateio', {
      apiKey,
      apiSecret,
    });
    console.log(`   ✓ 創建成功 (${Date.now() - startCreate}ms)`);
    console.log(`   timeout 設定: ${(exchange as any).timeout}ms`);
    console.log('');

    console.log('2. 呼叫 fetchBalance()...');
    const startFetch = Date.now();
    const balance = await exchange.fetchBalance();
    console.log(`   ✓ 成功 (${Date.now() - startFetch}ms)`);
    console.log(`   USDT 餘額: ${balance.total?.USDT || 0}`);
    console.log('');

    console.log('=== 測試完成 ===');
  } catch (error: any) {
    console.error('\n❌ 錯誤:', error.message);

    if (error.message.includes('timeout')) {
      console.error('\n可能原因:');
      console.error('  - Proxy 連線問題');
      console.error('  - Gate.io API 回應緩慢');
      console.error('  - 網路問題');
    }

    process.exit(1);
  }
}

main();
