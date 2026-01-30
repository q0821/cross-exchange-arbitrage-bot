#!/usr/bin/env node
/**
 * Update Symbols Script (by 24hr Volume)
 * 自動抓取 Binance 24hr 交易量前 N 名交易對並更新 config/symbols.json
 *
 * 優化：使用 /fapi/v1/ticker/24hr 單次 API 呼叫
 * - 執行時間從 2-4 秒降到 <1 秒
 * - API 呼叫從 200+ 次降到 1 次
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { logger } from '../lib/logger.js';

const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com';

/**
 * Binance 24hr Ticker 回應結構
 */
interface BinanceTicker24hr {
  symbol: string;
  lastPrice: string;
  quoteVolume: string; // 24h 成交額（USDT）
}

interface SymbolsConfig {
  description: string;
  note: string;
  lastUpdate: string;
  groups: {
    [key: string]: {
      name: string;
      symbols: string[];
    };
  };
}

/**
 * 抓取所有 USDT 永續合約的 24hr 交易量資料
 * 使用單次 API 呼叫，比逐一請求 OI 快 20-30 倍
 */
async function fetch24hrVolumes(): Promise<Map<string, number>> {
  try {
    const response = await axios.get<BinanceTicker24hr[]>(
      `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/24hr`,
    );

    const volumeMap = new Map<string, number>();

    for (const ticker of response.data) {
      if (ticker.symbol.endsWith('USDT')) {
        const volume = parseFloat(ticker.quoteVolume);
        if (volume > 0) {
          volumeMap.set(ticker.symbol, volume);
        }
      }
    }

    logger.info({ totalSymbols: volumeMap.size }, 'Fetched 24hr volume data (single API call)');
    return volumeMap;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch 24hr volume data');
    throw error;
  }
}

/**
 * 取得 24hr 交易量前 N 名交易對
 */
function getTopNSymbols(volumeMap: Map<string, number>, topN: number): string[] {
  const sorted = Array.from(volumeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([symbol]) => symbol);

  return sorted;
}

/**
 * 更新 config/symbols.json
 */
function updateSymbolsConfig(
  topSymbols: string[],
  configPath: string
): { added: string[]; removed: string[] } {
  // 讀取現有配置
  const configContent = readFileSync(configPath, 'utf-8');
  const config: SymbolsConfig = JSON.parse(configContent);

  // 取得舊的交易對列表
  const oldSymbols = config.groups.top100_oi?.symbols || [];

  // 計算差異
  const added = topSymbols.filter((s) => !oldSymbols.includes(s));
  const removed = oldSymbols.filter((s) => !topSymbols.includes(s));

  // 更新配置
  if (!config.groups.top100_oi) {
    config.groups.top100_oi = { name: 'Top 100 OI', symbols: [] };
  }
  config.groups.top100_oi.symbols = topSymbols;
  config.lastUpdate = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

  // 寫回檔案（保持格式化）
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return { added, removed };
}

/**
 * 主程式
 */
async function main() {
  const topN = parseInt(process.env.OI_TOP_N || '30', 10);
  const configPath = join(process.cwd(), 'config', 'symbols.json');

  console.log('🔄 開始更新交易對清單（依 24hr 交易量排序）...\n');
  console.log(`📊 抓取 24hr 交易量前 ${topN} 名交易對`);

  try {
    // 1. 抓取 24hr 交易量資料（單次 API 呼叫）
    const volumeMap = await fetch24hrVolumes();

    if (volumeMap.size === 0) {
      console.error('❌ 無法取得 24hr 交易量資料');
      process.exit(1);
    }

    // 2. 取得 Top N
    const topSymbols = getTopNSymbols(volumeMap, topN);

    console.log(`✅ 已抓取 ${topSymbols.length} 個交易對\n`);

    // 3. 顯示前 10 名的交易量
    console.log('📈 24hr 交易量前 10 名：');
    topSymbols.slice(0, 10).forEach((symbol, index) => {
      const volume = volumeMap.get(symbol)!;
      const volumeInBillions = (volume / 1_000_000_000).toFixed(2);
      console.log(`   ${index + 1}. ${symbol.padEnd(12)} $${volumeInBillions}B`);
    });
    console.log('');

    // 4. 更新配置檔案
    const { added, removed } = updateSymbolsConfig(topSymbols, configPath);

    // 5. 顯示變更摘要
    console.log('📝 變更摘要：');
    console.log(`   總數量: ${topSymbols.length}`);
    console.log(`   新增: ${added.length} 個`);
    console.log(`   移除: ${removed.length} 個\n`);

    if (added.length > 0) {
      console.log('➕ 新增的交易對：');
      added.forEach((symbol) => {
        const volume = volumeMap.get(symbol)!;
        const volumeInBillions = (volume / 1_000_000_000).toFixed(2);
        console.log(`   ${symbol.padEnd(12)} $${volumeInBillions}B`);
      });
      console.log('');
    }

    if (removed.length > 0) {
      console.log('➖ 移除的交易對：');
      removed.forEach((symbol) => {
        console.log(`   ${symbol}`);
      });
      console.log('');
    }

    console.log(`✅ 已更新 ${configPath}`);
    console.log('\n⚠️  請重啟 Web 服務以套用新的監控清單：');
    console.log('   pnpm dev  或  pnpm start\n');

  } catch (error) {
    console.error('\n❌ 更新失敗:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 執行主程式
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
