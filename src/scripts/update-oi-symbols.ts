#!/usr/bin/env node
/**
 * Update OI Symbols Script
 * 自動抓取 Binance OI 前 N 名交易對並更新 config/symbols.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BinanceConnector } from '../connectors/binance.js';
import { logger } from '../lib/logger.js';

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
 * 抓取所有 USDT 永續合約的 OI 資料
 */
async function fetchAllOpenInterest(): Promise<Map<string, number>> {
  const connector = new BinanceConnector();

  try {
    // 連接到 Binance
    await connector.connect();

    // 獲取所有 USDT 永續合約的 OI
    const oiData = await connector.getAllOpenInterest();

    const oiMap = new Map<string, number>();

    for (const item of oiData) {
      if (item.symbol.endsWith('USDT') && item.openInterestUSD > 0) {
        oiMap.set(item.symbol, item.openInterestUSD);
      }
    }

    // 斷開連接
    await connector.disconnect();

    logger.info({ totalSymbols: oiMap.size }, 'Fetched open interest data');
    return oiMap;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch open interest data');
    throw error;
  }
}

/**
 * 取得 OI 前 N 名交易對
 */
function getTopNSymbols(oiMap: Map<string, number>, topN: number): string[] {
  const sorted = Array.from(oiMap.entries())
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

  console.log('🔄 開始更新 OI 交易對清單...\n');
  console.log(`📊 抓取 OI 前 ${topN} 名交易對`);

  try {
    // 1. 抓取 OI 資料
    const oiMap = await fetchAllOpenInterest();

    if (oiMap.size === 0) {
      console.error('❌ 無法取得 OI 資料');
      process.exit(1);
    }

    // 2. 取得 Top N
    const topSymbols = getTopNSymbols(oiMap, topN);

    console.log(`✅ 已抓取 ${topSymbols.length} 個交易對\n`);

    // 3. 顯示前 10 名的 OI 值
    console.log('📈 OI 前 10 名：');
    topSymbols.slice(0, 10).forEach((symbol, index) => {
      const oi = oiMap.get(symbol)!;
      const oiInBillions = (oi / 1_000_000_000).toFixed(2);
      console.log(`   ${index + 1}. ${symbol.padEnd(12)} $${oiInBillions}B`);
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
        const oi = oiMap.get(symbol)!;
        const oiInBillions = (oi / 1_000_000_000).toFixed(2);
        console.log(`   ${symbol.padEnd(12)} $${oiInBillions}B`);
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
