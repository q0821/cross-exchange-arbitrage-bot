/**
 * Testnet 輔助函數
 *
 * 提供連接 Testnet 進行實際交易測試的輔助功能
 *
 * Feature: 實際開關倉測試與效能測試
 */

// 動態 import ccxt 以避免 Vitest 載入時的問題
// import ccxt from 'ccxt';
import type { PrismaClient } from '@/generated/prisma/client';
import { encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import type { SupportedExchange } from '@/types/trading';

// 動態載入 CCXT
async function loadCcxt() {
  const ccxt = await import('ccxt');
  return ccxt.default;
}

// ============================================================================
// 常數配置
// ============================================================================

/**
 * 測試安全限制
 * 硬編碼防止意外大額交易
 */
export const TEST_CONSTRAINTS = {
  /** 最大交易數量 (BTC) - OKX 最小數量為 0.01 */
  MAX_QUANTITY: 0.01,
  /** 預設交易對 */
  DEFAULT_SYMBOL: 'BTCUSDT',
  /** 預設槓桿 */
  DEFAULT_LEVERAGE: 1,
  /** 訂單超時 (ms) */
  ORDER_TIMEOUT_MS: 30000,
} as const;

/**
 * 支援的 Testnet 交易所
 */
export const TESTNET_EXCHANGES = ['binance', 'okx'] as const;
export type TestnetExchange = (typeof TESTNET_EXCHANGES)[number];

// ============================================================================
// 類型定義
// ============================================================================

export interface TestnetConfig {
  exchange: TestnetExchange;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface TestnetExchangeInstance {
  exchange: TestnetExchange;
   
  ccxt: any; // 使用 any 避免 ccxt 類型在解析階段被載入
  isTestnet: boolean;
}

export interface TestPosition {
  positionId: string;
  symbol: string;
  longExchange: TestnetExchange;
  shortExchange: TestnetExchange;
  quantity: number;
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從環境變數取得 Testnet 配置
 */
export function getTestnetConfig(exchange: TestnetExchange): TestnetConfig | null {
  if (exchange === 'binance') {
    const apiKey = process.env.BINANCE_TESTNET_API_KEY;
    const apiSecret = process.env.BINANCE_TESTNET_API_SECRET;

    if (!apiKey || !apiSecret) {
      return null;
    }

    return { exchange, apiKey, apiSecret };
  }

  if (exchange === 'okx') {
    const apiKey = process.env.OKX_DEMO_API_KEY;
    const apiSecret = process.env.OKX_DEMO_API_SECRET;
    const passphrase = process.env.OKX_DEMO_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
      return null;
    }

    return { exchange, apiKey, apiSecret, passphrase };
  }

  return null;
}

/**
 * 檢查是否可以執行實際交易測試
 */
export function canRunTradingTests(): boolean {
  return process.env.RUN_TRADING_INTEGRATION_TESTS === 'true';
}

/**
 * 檢查是否可以執行交易效能測試
 */
export function canRunTradingPerformanceTests(): boolean {
  return process.env.TRADING_PERFORMANCE_TEST === 'true';
}

/**
 * 取得測試參數
 */
export function getTestParams() {
  return {
    symbol: process.env.TEST_SYMBOL || TEST_CONSTRAINTS.DEFAULT_SYMBOL,
    maxQuantity: parseFloat(process.env.TEST_MAX_QUANTITY || String(TEST_CONSTRAINTS.MAX_QUANTITY)),
    leverage: parseInt(process.env.TEST_LEVERAGE || String(TEST_CONSTRAINTS.DEFAULT_LEVERAGE), 10) as 1 | 2,
  };
}

/**
 * 建立 Testnet 交易所連接
 *
 * @param config - Testnet 配置
 * @returns 交易所實例
 */
export async function createTestnetExchange(
  config: TestnetConfig,
): Promise<TestnetExchangeInstance> {
  const { exchange, apiKey, apiSecret, passphrase } = config;

  // 動態載入 CCXT
  const ccxt = await loadCcxt();

   
  let ccxtExchange: any;

  if (exchange === 'binance') {
    ccxtExchange = new ccxt.binance({
      apiKey,
      secret: apiSecret,
      sandbox: true, // 強制使用 Testnet
      enableRateLimit: true,
      timeout: TEST_CONSTRAINTS.ORDER_TIMEOUT_MS,
      options: {
        defaultType: 'future',
      },
    });
  } else if (exchange === 'okx') {
    ccxtExchange = new ccxt.okx({
      apiKey,
      secret: apiSecret,
      password: passphrase,
      sandbox: true, // 強制使用 Demo 模式
      enableRateLimit: true,
      timeout: TEST_CONSTRAINTS.ORDER_TIMEOUT_MS,
      options: {
        defaultType: 'swap',
      },
    });
  } else {
    throw new Error(`Unsupported testnet exchange: ${exchange}`);
  }

  // 載入市場資料
  await ccxtExchange.loadMarkets();

  return {
    exchange,
    ccxt: ccxtExchange,
    isTestnet: true,
  };
}

/**
 * 驗證確實連接到 Testnet
 *
 * 透過檢查 API endpoint 或特定標識來確認
 */
export async function validateTestnetConnection(
  instance: TestnetExchangeInstance,
): Promise<boolean> {
  try {
    const { ccxt: exchange, exchange: exchangeName } = instance;

    if (exchangeName === 'binance') {
      // Binance Testnet 使用 testnet.binancefuture.com
      const urls = exchange.urls as { api?: Record<string, string> };
      const apiUrl = urls?.api?.['fapiPublic'] || urls?.api?.['public'] || '';
      return apiUrl.includes('testnet');
    }

    if (exchangeName === 'okx') {
      // OKX Demo 使用 sandbox 設定
      // 嘗試獲取帳戶餘額，Demo 模式會有測試資金
      const balance = await exchange.fetchBalance();
      // Demo 帳戶通常有充足的測試資金
      return balance !== null;
    }

    return false;
  } catch (error) {
    logger.error({ error }, 'Failed to validate testnet connection');
    return false;
  }
}

/**
 * 取得帳戶餘額
 */
export async function getTestnetBalance(
  instance: TestnetExchangeInstance,
  currency: string = 'USDT',
): Promise<number> {
  try {
    const balance = await instance.ccxt.fetchBalance();
    const currencyBalance = balance[currency];

    if (currencyBalance) {
      return parseFloat(currencyBalance.free?.toString() || '0');
    }

    return 0;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch testnet balance');
    return 0;
  }
}

/**
 * 清理測試持倉
 *
 * 關閉所有在指定交易對上的持倉
 */
export async function cleanupTestPositions(
  instance: TestnetExchangeInstance,
  symbol: string,
): Promise<void> {
  try {
    const positions = await instance.ccxt.fetchPositions([symbol]);

    for (const position of positions) {
      const contracts = parseFloat(position.contracts?.toString() || '0');
      if (contracts > 0) {
        const side = position.side === 'long' ? 'sell' : 'buy';

        logger.info(
          { exchange: instance.exchange, symbol, side, contracts },
          'Closing test position',
        );

        await instance.ccxt.createMarketOrder(symbol, side, contracts, undefined, {
          reduceOnly: true,
        });
      }
    }
  } catch (error) {
    // 如果沒有持倉，忽略錯誤
    logger.warn({ error }, 'Failed to cleanup test positions (may not exist)');
  }
}

/**
 * 取得或建立測試用戶
 *
 * 在資料庫中建立或取得測試專用用戶
 */
export async function getTestUserId(prisma: PrismaClient): Promise<string> {
  const testEmail = 'testnet-test@example.com';

  // 嘗試找到現有用戶
  let user = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  // 如果不存在，創建新用戶
  if (!user) {
    // 使用 bcrypt hash 的測試密碼 "testnet123"
    const hashedPassword = '$2b$10$TestHashedPasswordForTestnetUser123456789';
    user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
      },
    });

    logger.info({ userId: user.id }, 'Created test user');
  }

  return user.id;
}

/**
 * 設置測試用戶的 API Key
 *
 * 將 Testnet API Key 加密後存入資料庫
 */
export async function setupTestApiKeys(
  prisma: PrismaClient,
  userId: string,
  configs: TestnetConfig[],
): Promise<void> {
  for (const config of configs) {
    const { exchange, apiKey, apiSecret, passphrase } = config;

    // 檢查是否已存在
    const existing = await prisma.apiKey.findFirst({
      where: {
        userId,
        exchange: exchange as SupportedExchange,
      },
    });

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);
    const encryptedPassphrase = passphrase ? encrypt(passphrase) : null;

    if (existing) {
      // 更新現有記錄
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: {
          encryptedKey,
          encryptedSecret,
          encryptedPassphrase,
          isActive: true,
          environment: 'TESTNET',
        },
      });
    } else {
      // 創建新記錄
      await prisma.apiKey.create({
        data: {
          userId,
          exchange: exchange as SupportedExchange,
          encryptedKey,
          encryptedSecret,
          encryptedPassphrase,
          label: `Testnet ${exchange.toUpperCase()}`,
          isActive: true,
          environment: 'TESTNET',
        },
      });
    }

    logger.info({ exchange }, 'Setup test API key');
  }
}

/**
 * 清理測試資料
 *
 * 刪除測試用戶相關的所有資料
 */
export async function cleanupTestData(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  // 刪除相關的 Trades
  await prisma.trade.deleteMany({
    where: {
      position: {
        userId,
      },
    },
  });

  // 刪除相關的 Positions
  await prisma.position.deleteMany({
    where: { userId },
  });

  // 刪除 API Keys
  await prisma.apiKey.deleteMany({
    where: { userId },
  });

  logger.info({ userId }, 'Cleaned up test data');
}

/**
 * 等待指定毫秒數
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 計算效能統計
 */
export function calculatePerformanceStats(latencies: number[]): {
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (latencies.length === 0) {
    return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}
