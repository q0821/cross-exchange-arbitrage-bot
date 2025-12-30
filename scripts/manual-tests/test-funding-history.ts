#!/usr/bin/env node
/**
 * Test Funding History Script
 *
 * 測試 CCXT fetchFundingHistory API 是否正常工作
 * 查詢各交易所過去的資金費率收支歷史
 *
 * 使用方式：
 *   pnpm tsx src/scripts/test-funding-history.ts
 *   pnpm tsx src/scripts/test-funding-history.ts --symbol=BEATUSDT
 *   pnpm tsx src/scripts/test-funding-history.ts --days=30 --symbol=BEATUSDT
 *   pnpm tsx src/scripts/test-funding-history.ts --environment=TESTNET
 */

import { PrismaClient, ApiEnvironment } from '@/generated/prisma/client';
import * as ccxt from 'ccxt';
import { decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

// 支援的交易所
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'gateio', 'mexc'] as const;
type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

// 解析命令行參數
function parseArgs(): { days: number; symbol: string; userId?: string; environment: ApiEnvironment } {
  const args = process.argv.slice(2);
  let days = 7;
  let symbol = 'BTCUSDT';
  let userId: string | undefined;
  let environment: ApiEnvironment = ApiEnvironment.MAINNET; // 預設使用 MAINNET

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      const val = arg.split('=')[1];
      if (val) days = parseInt(val, 10);
    } else if (arg.startsWith('--symbol=')) {
      const val = arg.split('=')[1];
      if (val) symbol = val;
    } else if (arg.startsWith('--userId=')) {
      userId = arg.split('=')[1];
    } else if (arg.startsWith('--environment=')) {
      const val = arg.split('=')[1];
      if (val && val.toUpperCase() in ApiEnvironment) {
        environment = val.toUpperCase() as ApiEnvironment;
      }
    }
  }

  return { days, symbol, userId, environment };
}

// 轉換 symbol 格式為 CCXT 格式
function toCcxtSymbol(symbol: string): string {
  const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}:${quote}`;
    }
  }
  return symbol;
}

// 偵測 Binance 帳戶類型（標準合約 vs Portfolio Margin）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectBinanceAccountType(ccxtExchange: any): Promise<boolean> {
  // 先嘗試標準 Futures API
  try {
    await ccxtExchange.fapiPrivateGetPositionSideDual();
    console.log('   ℹ️  偵測到標準合約帳戶');
    return false;
  } catch {
    // 標準 API 失敗，嘗試 Portfolio Margin API
  }

  try {
    await ccxtExchange.papiGetUmPositionSideDual();
    console.log('   ℹ️  偵測到 Portfolio Margin（統一交易）帳戶');
    return true;
  } catch {
    // 都失敗，預設標準帳戶
  }

  console.log('   ⚠️  無法偵測帳戶類型，使用標準模式');
  return false;
}

// 創建 CCXT 交易所實例
async function createExchange(
  exchange: SupportedExchange,
  apiKey: {
    encryptedKey: string;
    encryptedSecret: string;
    encryptedPassphrase: string | null;
    environment: string;
  },
): Promise<ccxt.Exchange> {
  const decryptedKey = decrypt(apiKey.encryptedKey);
  const decryptedSecret = decrypt(apiKey.encryptedSecret);
  const decryptedPassphrase = apiKey.encryptedPassphrase
    ? decrypt(apiKey.encryptedPassphrase)
    : undefined;

  const exchangeMap: Record<SupportedExchange, string> = {
    binance: 'binance',
    okx: 'okx',
    mexc: 'mexc',
    gateio: 'gateio',
  };

  const exchangeId = exchangeMap[exchange];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExchangeClass = (ccxt as any)[exchangeId];

  const config = {
    apiKey: decryptedKey,
    secret: decryptedSecret,
    password: decryptedPassphrase,
    sandbox: apiKey.environment === 'TESTNET',
    enableRateLimit: true,
    options: {
      defaultType: exchange === 'binance' ? 'future' : 'swap',
    },
  };

  let ccxtExchange = new ExchangeClass(config);

  // Binance Portfolio Margin 偵測
  if (exchange === 'binance') {
    const isPortfolioMargin = await detectBinanceAccountType(ccxtExchange);
    if (isPortfolioMargin) {
      console.log('   🔄 重新建立 Binance 實例（啟用 Portfolio Margin 模式）');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config.options as any).portfolioMargin = true;
      ccxtExchange = new ExchangeClass(config);
    }
  }

  return ccxtExchange;
}

// 查詢單一交易所的資金費率歷史
async function queryFundingHistory(
  exchange: SupportedExchange,
  ccxtExchange: ccxt.Exchange,
  symbol: string,
  since: number,
): Promise<void> {
  const ccxtSymbol = toCcxtSymbol(symbol);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${exchange.toUpperCase()} - ${symbol} (${ccxtSymbol})`);
  console.log('='.repeat(60));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = await (ccxtExchange as any).fetchFundingHistory(
      ccxtSymbol,
      since,
      100, // limit
    );

    if (!history || history.length === 0) {
      console.log('❌ 無資金費率記錄（可能該時間段沒有持倉）');
      return;
    }

    console.log(`✅ 找到 ${history.length} 筆記錄\n`);

    // 計算總額
    let total = 0;
    let received = 0;
    let paid = 0;

    // 顯示前 10 筆
    console.log('最近記錄：');
    console.log('-'.repeat(60));

    const displayCount = Math.min(history.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const entry = history[i];
      const amount = entry.amount || 0;
      total += amount;

      if (amount >= 0) {
        received += amount;
      } else {
        paid += Math.abs(amount);
      }

      const sign = amount >= 0 ? '+' : '';
      const emoji = amount >= 0 ? '💰' : '💸';

      console.log(
        `${emoji} ${entry.datetime || new Date(entry.timestamp).toISOString()} | ${sign}${amount.toFixed(6)} USDT`,
      );
    }

    if (history.length > 10) {
      console.log(`... 還有 ${history.length - 10} 筆記錄`);
    }

    console.log('-'.repeat(60));
    console.log(`📈 總收到: +${received.toFixed(6)} USDT`);
    console.log(`📉 總支付: -${paid.toFixed(6)} USDT`);
    console.log(`📊 淨損益: ${total >= 0 ? '+' : ''}${total.toFixed(6)} USDT`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ 查詢失敗: ${errorMsg}`);

    // 如果是方法不支持，提示
    if (errorMsg.includes('not supported') || errorMsg.includes('NotSupported')) {
      console.log(`   ⚠️  ${exchange} 可能不支援 fetchFundingHistory 方法`);
    }
  }
}

// 主函數
async function main() {
  const { days, symbol, userId, environment } = parseArgs();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  console.log('\n🔍 資金費率歷史測試腳本');
  console.log('='.repeat(60));
  console.log(`📅 查詢範圍: 過去 ${days} 天`);
  console.log(`💱 交易對: ${symbol}`);
  console.log(`🌐 環境: ${environment}`);
  console.log(`⏰ 起始時間: ${new Date(since).toISOString()}`);

  try {
    // 獲取用戶（如果指定了 userId，使用指定的；否則取第一個有該環境 API key 的用戶）
    let targetUserId = userId;

    if (!targetUserId) {
      const firstApiKey = await prisma.apiKey.findFirst({
        where: {
          isActive: true,
          environment: environment,
        },
        select: { userId: true },
      });

      if (!firstApiKey) {
        console.log(`\n❌ 資料庫中沒有找到 ${environment} 的 API Key`);
        console.log('   請先在 Web UI 設定頁面添加交易所 API Key');
        return;
      }

      targetUserId = firstApiKey.userId;
    }

    console.log(`👤 用戶 ID: ${targetUserId}`);

    // 獲取該用戶指定環境的 API key
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: targetUserId,
        isActive: true,
        environment: environment,
      },
    });

    if (apiKeys.length === 0) {
      console.log(`\n❌ 該用戶沒有 ${environment} 的 API Key`);
      return;
    }

    console.log(`🔑 找到 ${apiKeys.length} 個 ${environment} 交易所 API Key`);

    // 對每個交易所查詢
    for (const apiKey of apiKeys) {
      const exchange = apiKey.exchange as SupportedExchange;

      if (!SUPPORTED_EXCHANGES.includes(exchange)) {
        console.log(`\n⚠️  跳過不支援的交易所: ${exchange}`);
        continue;
      }

      try {
        const ccxtExchange = await createExchange(exchange, apiKey);
        await queryFundingHistory(exchange, ccxtExchange, symbol, since);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`\n❌ ${exchange} 連接失敗: ${errorMsg}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 測試完成');
  } catch (error) {
    logger.error({ error }, 'Script failed');
    console.error('❌ 腳本執行失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 執行
main().catch(console.error);
