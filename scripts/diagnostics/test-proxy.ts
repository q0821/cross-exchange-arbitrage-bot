/**
 * Proxy 連線診斷腳本
 *
 * 用途：測試 proxy 是否正確配置並能連線到各交易所
 *
 * 執行方式：
 * pnpm tsx scripts/diagnostics/test-proxy.ts
 */

import axios from 'axios';
import type { Agent } from 'http';
import { getProxyUrl, isProxyConfigured, createProxyAgent } from '../../src/lib/env.js';

interface TestResult {
  exchange: string;
  url: string;
  success: boolean;
  latency?: number;
  error?: string;
  ip?: string;
}

async function testConnection(
  name: string,
  url: string,
  proxyAgent: Agent | null
): Promise<TestResult> {
  const start = Date.now();

  try {
    const config: any = { timeout: 10000 };
    if (proxyAgent) {
      config.httpsAgent = proxyAgent;
    }

    await axios.get(url, config);
    const latency = Date.now() - start;

    return {
      exchange: name,
      url,
      success: true,
      latency,
    };
  } catch (error) {
    return {
      exchange: name,
      url,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getExternalIP(proxyAgent: Agent | null): Promise<string> {
  try {
    const config: any = { timeout: 5000 };
    if (proxyAgent) {
      config.httpsAgent = proxyAgent;
    }
    const response = await axios.get('https://api.ipify.org?format=json', config);
    return response.data.ip;
  } catch {
    return 'unknown';
  }
}

async function main() {
  console.log('========================================');
  console.log('       Proxy 連線診斷工具');
  console.log('========================================\n');

  // 檢查 proxy 設定
  const proxyUrl = getProxyUrl();
  const proxyConfigured = isProxyConfigured();

  console.log(`Proxy 已配置: ${proxyConfigured ? '✅ 是' : '❌ 否'}`);

  if (proxyUrl) {
    console.log(`Proxy URL: ${proxyUrl}\n`);
  } else {
    console.log('⚠️  未設定 PROXY_URL 環境變數');
    console.log('請在 .env 檔案中設定 PROXY_URL=http://your-proxy:port\n');
  }

  // 建立 proxy agent（支援 HTTP/HTTPS/SOCKS）
  const proxyAgent = await createProxyAgent();

  // 測試外部 IP
  console.log('----------------------------------------');
  console.log('測試外部 IP 位址');
  console.log('----------------------------------------');

  const directIP = await getExternalIP(null);
  console.log(`直連 IP: ${directIP}`);

  if (proxyAgent) {
    const proxyIP = await getExternalIP(proxyAgent);
    console.log(`Proxy IP: ${proxyIP}`);

    if (directIP !== proxyIP && proxyIP !== 'unknown') {
      console.log('✅ Proxy 正常運作（IP 不同）\n');
    } else if (proxyIP === 'unknown') {
      console.log('⚠️  無法取得 Proxy IP\n');
    } else {
      console.log('⚠️  直連與 Proxy IP 相同，請確認 proxy 設定\n');
    }
  }

  // 測試各交易所 API
  const endpoints = [
    { name: 'Binance', url: 'https://fapi.binance.com/fapi/v1/time' },
    { name: 'OKX', url: 'https://www.okx.com/api/v5/public/time' },
    { name: 'Gate.io', url: 'https://api.gateio.ws/api/v4/spot/time' },
    { name: 'MEXC', url: 'https://api.mexc.com/api/v3/time' },
    { name: 'BingX', url: 'https://open-api.bingx.com/openApi/swap/v2/server/time' },
  ];

  console.log('----------------------------------------');
  console.log('測試交易所 API 連線（直連 vs Proxy）');
  console.log('----------------------------------------');

  // 表頭
  console.log('\n交易所'.padEnd(12) + '直連'.padStart(12) + 'Proxy'.padStart(12) + '差異'.padStart(12));
  console.log('-'.repeat(48));

  const directResults: TestResult[] = [];
  const proxyResults: TestResult[] = [];

  for (const endpoint of endpoints) {
    // 測試直連
    const directResult = await testConnection(endpoint.name, endpoint.url, null);
    directResults.push(directResult);

    // 測試 Proxy（如果有配置）
    let proxyResult: TestResult;
    if (proxyAgent) {
      proxyResult = await testConnection(endpoint.name, endpoint.url, proxyAgent);
    } else {
      proxyResult = { exchange: endpoint.name, url: endpoint.url, success: false, error: '未配置' };
    }
    proxyResults.push(proxyResult);

    // 格式化輸出
    const directStr = directResult.success ? `${directResult.latency}ms` : `❌ ${(directResult.error || '').slice(0, 8)}`;
    const proxyStr = proxyResult.success ? `${proxyResult.latency}ms` : (proxyResult.error === '未配置' ? '-' : `❌ ${(proxyResult.error || '').slice(0, 8)}`);

    let diffStr = '-';
    if (directResult.success && proxyResult.success && directResult.latency && proxyResult.latency) {
      const diff = proxyResult.latency - directResult.latency;
      diffStr = diff > 0 ? `+${diff}ms` : `${diff}ms`;
    }

    const statusIcon = directResult.success && proxyResult.success ? '✅' :
                       directResult.success || proxyResult.success ? '⚠️' : '❌';

    console.log(`${statusIcon} ${endpoint.name.padEnd(10)} ${directStr.padStart(10)} ${proxyStr.padStart(10)} ${diffStr.padStart(10)}`);
  }

  // 摘要
  console.log('\n----------------------------------------');
  console.log('測試結果摘要');
  console.log('----------------------------------------');

  const directSuccess = directResults.filter((r) => r.success).length;
  const proxySuccess = proxyResults.filter((r) => r.success).length;

  console.log(`直連成功: ${directSuccess}/${directResults.length}`);
  if (proxyConfigured) {
    console.log(`Proxy 成功: ${proxySuccess}/${proxyResults.length}`);
  }

  // 計算平均延遲
  const directLatencies = directResults.filter(r => r.success && r.latency).map(r => r.latency!);
  const proxyLatencies = proxyResults.filter(r => r.success && r.latency).map(r => r.latency!);

  if (directLatencies.length > 0) {
    const avgDirect = Math.round(directLatencies.reduce((a, b) => a + b, 0) / directLatencies.length);
    console.log(`直連平均延遲: ${avgDirect}ms`);
  }

  if (proxyLatencies.length > 0) {
    const avgProxy = Math.round(proxyLatencies.reduce((a, b) => a + b, 0) / proxyLatencies.length);
    console.log(`Proxy 平均延遲: ${avgProxy}ms`);
  }

  // 失敗詳情
  const allFailed = [...directResults, ...proxyResults].filter(r => !r.success && r.error !== '未配置');
  if (allFailed.length > 0) {
    console.log('\n失敗的連線:');
    allFailed.forEach((r) => {
      const type = directResults.includes(r) ? '直連' : 'Proxy';
      console.log(`  - ${r.exchange} (${type}): ${r.error}`);
    });
  }

  if (directSuccess === directResults.length && (!proxyConfigured || proxySuccess === proxyResults.length)) {
    console.log('\n🎉 所有交易所 API 連線正常！');
  }

  console.log('\n========================================\n');
}

main().catch(console.error);
