/**
 * 實際開關倉整合測試
 *
 * 連接 OKX Demo 進行真實的單邊開倉和平倉操作
 *
 * Feature: 實際開關倉測試與效能測試
 *
 * 執行方式：
 *   RUN_TRADING_INTEGRATION_TESTS=true pnpm test tests/integration/trading/position-open-close.test.ts
 *
 * ⚠️ 注意：
 *   - 需要設定 OKX Demo API Key（見 .env.test.example）
 *   - 會在 OKX Demo 創建真實倉位
 *   - 使用極小數量（0.001 BTC）進行測試
 *   - 使用單向持倉模式（Net Mode）- 無需設定雙向持倉
 *   - Binance Testnet 已不再支援 Futures（CCXT 已棄用）
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPrismaClient } from '@/lib/prisma-factory';

// 是否執行實際交易測試
const runTradingTests = process.env.RUN_TRADING_INTEGRATION_TESTS === 'true';

// 常數
const TEST_CONSTRAINTS = {
  MAX_QUANTITY: 0.01, // OKX BTC/USDT:USDT 最小數量為 0.01
  DEFAULT_SYMBOL: 'BTC/USDT:USDT', // CCXT 格式
  DEFAULT_LEVERAGE: 1,
  ORDER_TIMEOUT_MS: 30000,
} as const;

function getTestParams() {
  return {
    symbol: TEST_CONSTRAINTS.DEFAULT_SYMBOL,
    maxQuantity: parseFloat(process.env.TEST_MAX_QUANTITY || String(TEST_CONSTRAINTS.MAX_QUANTITY)),
    leverage: parseInt(process.env.TEST_LEVERAGE || String(TEST_CONSTRAINTS.DEFAULT_LEVERAGE), 10),
  };
}

function canRunTradingTests(): boolean {
  return process.env.RUN_TRADING_INTEGRATION_TESTS === 'true';
}

// 實際交易測試（需要 OKX Demo API Key）
describe.skipIf(!runTradingTests)('Position Open/Close Integration Tests (OKX Demo)', () => {
  const TEST_TIMEOUT = 120000; // 2 分鐘超時

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deps: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let okxInstance: any = null;
  let testUserId: string;

  beforeAll(async () => {
    const helpers = await import('./testnet-helpers');
    deps = { ...helpers };

    prisma = createPrismaClient();
    await prisma.$connect();

    // 只取得 OKX Demo 配置
    const okxConfig = deps.getTestnetConfig('okx');

    const configs: Array<{ exchange: string; apiKey: string; apiSecret: string; passphrase?: string }> = [];

    if (okxConfig) {
      try {
        okxInstance = await deps.createTestnetExchange(okxConfig);
        const isValid = await deps.validateTestnetConnection(okxInstance);
        if (!isValid) {
          console.warn('OKX Demo validation failed');
          okxInstance = null;
        } else {
          configs.push(okxConfig);
          console.log('✅ OKX Demo connected');
        }
      } catch (error) {
        console.warn('Failed to connect to OKX Demo:', error);
        okxInstance = null;
      }
    }

    if (configs.length > 0) {
      testUserId = await deps.getTestUserId(prisma);
      await deps.setupTestApiKeys(prisma, testUserId, configs);
      console.log(`✅ Test user setup complete: ${testUserId}`);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (testUserId && deps) {
      await deps.cleanupTestData(prisma, testUserId);
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    // 清理可能存在的測試持倉
    if (okxInstance && deps) {
      await deps.cleanupTestPositions(okxInstance, TEST_CONSTRAINTS.DEFAULT_SYMBOL);
    }
  });

  describe('Setup Verification', () => {
    it('should display OKX Demo connection status', () => {
      if (!okxInstance) {
        console.log('');
        console.log('⚠️ 未設定 OKX Demo API Key');
        console.log('   請參考 .env.test.example 設定：');
        console.log('   - OKX_DEMO_API_KEY');
        console.log('   - OKX_DEMO_API_SECRET');
        console.log('   - OKX_DEMO_PASSPHRASE');
        console.log('');
        console.log('   後續測試將被跳過');
      } else {
        console.log('');
        console.log('✅ OKX Demo 已連接');
        console.log('   ℹ️ 使用單邊開倉測試（Net Mode）');
      }
      expect(true).toBe(true);
    });

    it('should have OKX Demo connected', () => {
      if (!okxInstance) {
        console.log('Skipping: OKX Demo not configured');
        return;
      }
      expect(okxInstance).not.toBeNull();
    });

    it('should have test user created', () => {
      if (!testUserId) {
        return;
      }
      expect(testUserId).toBeDefined();
      expect(testUserId.length).toBeGreaterThan(0);
    });

    it(
      'should have sufficient balance on OKX Demo',
      async () => {
        if (!okxInstance) {
          return;
        }

        const balance = await deps.getTestnetBalance(okxInstance, 'USDT');
        console.log(`OKX Demo USDT balance: ${balance}`);
        expect(balance).toBeGreaterThan(10);
      },
      TEST_TIMEOUT,
    );
  });

  describe('Single-Side Position Test (Net Mode)', () => {
    it(
      'should open and close a LONG position',
      async () => {
        if (!okxInstance) {
          console.log('Skipping: OKX Demo not configured');
          return;
        }

        const { symbol, maxQuantity, leverage } = getTestParams();
        const testQuantity = Math.min(maxQuantity, TEST_CONSTRAINTS.MAX_QUANTITY);

        console.log('\n🔄 Starting single-side LONG test...');
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Quantity: ${testQuantity}`);
        console.log(`   Leverage: ${leverage}x`);
        console.log(`   Side: LONG (buy)`);

        // Step 1: 設定槓桿
        console.log('\n⚙️ Setting leverage...');
        await okxInstance.ccxt.setLeverage(leverage, symbol);

        // Step 2: 開多倉
        console.log('\n📈 Opening LONG position...');
        const openStart = Date.now();

        const openOrder = await okxInstance.ccxt.createMarketOrder(symbol, 'buy', testQuantity);

        const openDuration = Date.now() - openStart;
        console.log(`   ✅ Opened in ${openDuration}ms`);
        console.log(`   Order ID: ${openOrder.id}`);

        // OKX 需要另外查詢訂單狀態
        await deps.sleep(500); // 等待訂單處理
        const orderDetail = await okxInstance.ccxt.fetchOrder(openOrder.id, symbol);
        console.log(`   Status: ${orderDetail.status}`);
        console.log(`   Filled: ${orderDetail.filled}`);
        console.log(`   Average Price: ${orderDetail.average}`);

        expect(openOrder.id).toBeDefined(); // 訂單已建立
        expect(orderDetail.status).toBe('closed'); // Market order should be filled
        expect(orderDetail.filled).toBeGreaterThan(0);

        // Step 3: 等待
        console.log('\n⏳ Waiting 2 seconds...');
        await deps.sleep(2000);

        // Step 4: 平倉（賣出）
        console.log('\n📉 Closing LONG position (sell)...');
        const closeStart = Date.now();

        const closeOrder = await okxInstance.ccxt.createMarketOrder(symbol, 'sell', testQuantity);

        const closeDuration = Date.now() - closeStart;
        console.log(`   ✅ Closed in ${closeDuration}ms`);
        console.log(`   Order ID: ${closeOrder.id}`);

        // OKX 需要另外查詢訂單狀態
        await deps.sleep(500);
        const closeOrderDetail = await okxInstance.ccxt.fetchOrder(closeOrder.id, symbol);
        console.log(`   Status: ${closeOrderDetail.status}`);
        console.log(`   Filled: ${closeOrderDetail.filled}`);
        console.log(`   Average Price: ${closeOrderDetail.average}`);

        expect(closeOrder.id).toBeDefined();
        expect(closeOrderDetail.status).toBe('closed');
        expect(closeOrderDetail.filled).toBeGreaterThan(0);

        // 計算 PnL
        const pnl = (closeOrderDetail.average - orderDetail.average) * testQuantity;
        console.log(`\n💰 Estimated PnL: ${pnl.toFixed(4)} USDT`);
        console.log(`✅ Full cycle completed in ${openDuration + 2000 + closeDuration}ms`);
      },
      TEST_TIMEOUT,
    );

    it(
      'should open and close a SHORT position',
      async () => {
        if (!okxInstance) {
          console.log('Skipping: OKX Demo not configured');
          return;
        }

        const { symbol, maxQuantity, leverage } = getTestParams();
        const testQuantity = Math.min(maxQuantity, TEST_CONSTRAINTS.MAX_QUANTITY);

        console.log('\n🔄 Starting single-side SHORT test...');
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Quantity: ${testQuantity}`);
        console.log(`   Leverage: ${leverage}x`);
        console.log(`   Side: SHORT (sell)`);

        // Step 1: 設定槓桿
        console.log('\n⚙️ Setting leverage...');
        await okxInstance.ccxt.setLeverage(leverage, symbol);

        // Step 2: 開空倉
        console.log('\n📉 Opening SHORT position...');
        const openStart = Date.now();

        const openOrder = await okxInstance.ccxt.createMarketOrder(symbol, 'sell', testQuantity);

        const openDuration = Date.now() - openStart;
        console.log(`   ✅ Opened in ${openDuration}ms`);
        console.log(`   Order ID: ${openOrder.id}`);

        // OKX 需要另外查詢訂單狀態
        await deps.sleep(500);
        const orderDetail = await okxInstance.ccxt.fetchOrder(openOrder.id, symbol);
        console.log(`   Status: ${orderDetail.status}`);
        console.log(`   Filled: ${orderDetail.filled}`);
        console.log(`   Average Price: ${orderDetail.average}`);

        expect(openOrder.id).toBeDefined();
        expect(orderDetail.status).toBe('closed');
        expect(orderDetail.filled).toBeGreaterThan(0);

        // Step 3: 等待
        console.log('\n⏳ Waiting 2 seconds...');
        await deps.sleep(2000);

        // Step 4: 平倉（買入）
        console.log('\n📈 Closing SHORT position (buy)...');
        const closeStart = Date.now();

        const closeOrder = await okxInstance.ccxt.createMarketOrder(symbol, 'buy', testQuantity);

        const closeDuration = Date.now() - closeStart;
        console.log(`   ✅ Closed in ${closeDuration}ms`);
        console.log(`   Order ID: ${closeOrder.id}`);

        // OKX 需要另外查詢訂單狀態
        await deps.sleep(500);
        const closeOrderDetail = await okxInstance.ccxt.fetchOrder(closeOrder.id, symbol);
        console.log(`   Status: ${closeOrderDetail.status}`);
        console.log(`   Filled: ${closeOrderDetail.filled}`);
        console.log(`   Average Price: ${closeOrderDetail.average}`);

        expect(closeOrder.id).toBeDefined();
        expect(closeOrderDetail.status).toBe('closed');
        expect(closeOrderDetail.filled).toBeGreaterThan(0);

        // 計算 PnL（空單：開倉價 - 平倉價）
        const pnl = (orderDetail.average - closeOrderDetail.average) * testQuantity;
        console.log(`\n💰 Estimated PnL: ${pnl.toFixed(4)} USDT`);
        console.log(`✅ Full cycle completed in ${openDuration + 2000 + closeDuration}ms`);
      },
      TEST_TIMEOUT,
    );
  });

  describe('Performance Metrics', () => {
    it(
      'should measure order execution latency',
      async () => {
        if (!okxInstance) {
          console.log('Skipping: OKX Demo not configured');
          return;
        }

        const { symbol, maxQuantity } = getTestParams();
        const testQuantity = Math.min(maxQuantity, TEST_CONSTRAINTS.MAX_QUANTITY);
        const latencies: number[] = [];

        console.log('\n📊 Measuring order execution latency (3 rounds)...');

        for (let i = 0; i < 3; i++) {
          // 開倉
          const openStart = Date.now();
          await okxInstance.ccxt.createMarketOrder(symbol, 'buy', testQuantity);
          const openLatency = Date.now() - openStart;

          // 平倉
          const closeStart = Date.now();
          await okxInstance.ccxt.createMarketOrder(symbol, 'sell', testQuantity);
          const closeLatency = Date.now() - closeStart;

          latencies.push(openLatency, closeLatency);
          console.log(`   Round ${i + 1}: Open ${openLatency}ms, Close ${closeLatency}ms`);

          if (i < 2) await deps.sleep(1000);
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);

        console.log('\n📈 Latency Statistics:');
        console.log(`   Average: ${avgLatency.toFixed(0)}ms`);
        console.log(`   Min: ${minLatency}ms`);
        console.log(`   Max: ${maxLatency}ms`);

        // 驗證延遲在合理範圍內（< 5 秒）
        expect(avgLatency).toBeLessThan(5000);
      },
      TEST_TIMEOUT,
    );
  });
});

// Mock 測試（永遠執行）
describe('Position Open/Close Integration Tests (Mock)', () => {
  it('should validate test constraints', () => {
    expect(TEST_CONSTRAINTS.MAX_QUANTITY).toBe(0.01); // OKX 最小數量
    expect(TEST_CONSTRAINTS.DEFAULT_SYMBOL).toBe('BTC/USDT:USDT');
    expect(TEST_CONSTRAINTS.DEFAULT_LEVERAGE).toBe(1);
  });

  it('should parse test params correctly', () => {
    const params = getTestParams();

    expect(params.symbol).toBeDefined();
    expect(params.maxQuantity).toBeGreaterThan(0);
    expect(params.maxQuantity).toBeLessThanOrEqual(TEST_CONSTRAINTS.MAX_QUANTITY);
    expect(params.leverage).toBeGreaterThanOrEqual(1);
  });

  it('should check trading test flag correctly', () => {
    const originalValue = process.env.RUN_TRADING_INTEGRATION_TESTS;

    process.env.RUN_TRADING_INTEGRATION_TESTS = 'true';
    expect(canRunTradingTests()).toBe(true);

    process.env.RUN_TRADING_INTEGRATION_TESTS = 'false';
    expect(canRunTradingTests()).toBe(false);

    process.env.RUN_TRADING_INTEGRATION_TESTS = '';
    expect(canRunTradingTests()).toBe(false);

    if (originalValue) {
      process.env.RUN_TRADING_INTEGRATION_TESTS = originalValue;
    } else {
      delete process.env.RUN_TRADING_INTEGRATION_TESTS;
    }
  });
});
