/**
 * 實際開關倉效能測試
 *
 * 連接 Testnet 測量實際開倉和平倉的延遲
 *
 * Feature: 實際開關倉測試與效能測試
 *
 * 執行方式：
 *   TRADING_PERFORMANCE_TEST=true pnpm test tests/performance/trading/position-latency.test.ts
 *
 * ⚠️ 注意：
 *   - 需要設定 Testnet API Key（見 .env.test.example）
 *   - 會在 Testnet 創建真實倉位
 *   - 每次測試會開倉再平倉，可能產生手續費
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
// 使用 prisma-factory 來創建 PrismaClient（Prisma 7 需要 adapter）
import { createPrismaClient } from '@/lib/prisma-factory';

// ============================================================================
// 效能目標
// ============================================================================

const PERFORMANCE_TARGETS = {
  /** 雙邊開倉延遲目標 */
  BILATERAL_OPEN_MS: 5000,
  /** 雙邊平倉延遲目標 */
  BILATERAL_CLOSE_MS: 5000,
  /** 完整週期（開倉 + 平倉）延遲目標 */
  FULL_CYCLE_MS: 10000,
} as const;

// 是否執行實際效能測試
const runPerformanceTests = process.env.TRADING_PERFORMANCE_TEST === 'true';

// 常數（不依賴動態載入）
const TEST_CONSTRAINTS = {
  MAX_QUANTITY: 0.001,
  DEFAULT_SYMBOL: 'BTCUSDT',
  DEFAULT_LEVERAGE: 1,
} as const;

function getTestParams() {
  return {
    symbol: process.env.TEST_SYMBOL || TEST_CONSTRAINTS.DEFAULT_SYMBOL,
    maxQuantity: parseFloat(process.env.TEST_MAX_QUANTITY || String(TEST_CONSTRAINTS.MAX_QUANTITY)),
    leverage: parseInt(process.env.TEST_LEVERAGE || String(TEST_CONSTRAINTS.DEFAULT_LEVERAGE), 10) as 1 | 2,
  };
}

function canRunTradingPerformanceTests(): boolean {
  return process.env.TRADING_PERFORMANCE_TEST === 'true';
}

function calculatePerformanceStats(latencies: number[]): {
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

describe.skipIf(!runPerformanceTests)('Position Trading Latency (Testnet)', () => {
  const TEST_TIMEOUT = 180000; // 3 分鐘超時

   
  let deps: any;
   
  let prisma: any;
   
  let binanceInstance: any = null;
   
  let okxInstance: any = null;
  let testUserId: string;
  let createdPositionIds: string[] = [];

  // 效能數據收集
  const openLatencies: number[] = [];
  const closeLatencies: number[] = [];
  const cycleLatencies: number[] = [];

  beforeAll(async () => {
    // 動態載入依賴項
    const { PositionOrchestrator } = await import('@/services/trading/PositionOrchestrator');
    const { PositionCloser } = await import('@/services/trading/PositionCloser');
    const helpers = await import('../../integration/trading/testnet-helpers');

    deps = { PositionOrchestrator, PositionCloser, ...helpers };
    // Prisma 7 使用 adapter 模式
    prisma = createPrismaClient();
    await prisma.$connect();

    // 取得 Testnet 配置
    const binanceConfig = deps.getTestnetConfig('binance');
    const okxConfig = deps.getTestnetConfig('okx');

    const configs: Array<{ exchange: string; apiKey: string; apiSecret: string; passphrase?: string }> = [];

    // 建立 Binance Testnet 連接
    if (binanceConfig) {
      try {
        binanceInstance = await deps.createTestnetExchange(binanceConfig);
        const isValid = await deps.validateTestnetConnection(binanceInstance);
        if (isValid) {
          configs.push(binanceConfig);
          console.log('✅ Binance Testnet connected for performance test');
        }
      } catch (error) {
        console.warn('Failed to connect to Binance Testnet:', error);
      }
    }

    // 建立 OKX Demo 連接
    if (okxConfig) {
      try {
        okxInstance = await deps.createTestnetExchange(okxConfig);
        const isValid = await deps.validateTestnetConnection(okxInstance);
        if (isValid) {
          configs.push(okxConfig);
          console.log('✅ OKX Demo connected for performance test');
        }
      } catch (error) {
        console.warn('Failed to connect to OKX Demo:', error);
      }
    }

    // 設置測試用戶和 API Keys
    if (configs.length > 0) {
      testUserId = await deps.getTestUserId(prisma);
      await deps.setupTestApiKeys(prisma, testUserId, configs);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // 輸出效能報告
    if (openLatencies.length > 0 || closeLatencies.length > 0) {
      console.log('\n');
      console.log('═'.repeat(70));
      console.log('📊 Performance Report: Position Trading Latency');
      console.log('═'.repeat(70));

      if (openLatencies.length > 0) {
        const openStats = calculatePerformanceStats(openLatencies);
        console.log('\n📈 Bilateral Open Latency:');
        console.log('─'.repeat(40));
        console.log(`   Samples:    ${openLatencies.length}`);
        console.log(`   Average:    ${openStats.avg.toFixed(0)}ms`);
        console.log(`   P50:        ${openStats.p50.toFixed(0)}ms`);
        console.log(`   P95:        ${openStats.p95.toFixed(0)}ms`);
        console.log(`   P99:        ${openStats.p99.toFixed(0)}ms`);
        console.log(`   Min:        ${openStats.min.toFixed(0)}ms`);
        console.log(`   Max:        ${openStats.max.toFixed(0)}ms`);
        console.log(`   Target:     <${PERFORMANCE_TARGETS.BILATERAL_OPEN_MS}ms`);
        console.log(`   Status:     ${openStats.avg < PERFORMANCE_TARGETS.BILATERAL_OPEN_MS ? '✅ PASS' : '❌ FAIL'}`);
      }

      if (closeLatencies.length > 0) {
        const closeStats = calculatePerformanceStats(closeLatencies);
        console.log('\n📉 Bilateral Close Latency:');
        console.log('─'.repeat(40));
        console.log(`   Samples:    ${closeLatencies.length}`);
        console.log(`   Average:    ${closeStats.avg.toFixed(0)}ms`);
        console.log(`   P50:        ${closeStats.p50.toFixed(0)}ms`);
        console.log(`   P95:        ${closeStats.p95.toFixed(0)}ms`);
        console.log(`   P99:        ${closeStats.p99.toFixed(0)}ms`);
        console.log(`   Min:        ${closeStats.min.toFixed(0)}ms`);
        console.log(`   Max:        ${closeStats.max.toFixed(0)}ms`);
        console.log(`   Target:     <${PERFORMANCE_TARGETS.BILATERAL_CLOSE_MS}ms`);
        console.log(`   Status:     ${closeStats.avg < PERFORMANCE_TARGETS.BILATERAL_CLOSE_MS ? '✅ PASS' : '❌ FAIL'}`);
      }

      if (cycleLatencies.length > 0) {
        const cycleStats = calculatePerformanceStats(cycleLatencies);
        console.log('\n🔄 Full Cycle (Open + Close) Latency:');
        console.log('─'.repeat(40));
        console.log(`   Samples:    ${cycleLatencies.length}`);
        console.log(`   Average:    ${cycleStats.avg.toFixed(0)}ms`);
        console.log(`   P50:        ${cycleStats.p50.toFixed(0)}ms`);
        console.log(`   P95:        ${cycleStats.p95.toFixed(0)}ms`);
        console.log(`   Min:        ${cycleStats.min.toFixed(0)}ms`);
        console.log(`   Max:        ${cycleStats.max.toFixed(0)}ms`);
        console.log(`   Target:     <${PERFORMANCE_TARGETS.FULL_CYCLE_MS}ms`);
        console.log(`   Status:     ${cycleStats.avg < PERFORMANCE_TARGETS.FULL_CYCLE_MS ? '✅ PASS' : '❌ FAIL'}`);
      }

      console.log('\n');
      console.log('═'.repeat(70));
    }

    // 清理測試資料
    if (testUserId && deps) {
      await deps.cleanupTestData(prisma, testUserId);
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    // 清理未平倉的持倉
    for (const positionId of createdPositionIds) {
      try {
        const position = await prisma.position.findUnique({
          where: { id: positionId },
        });

        if (position && position.status === 'OPEN') {
          const closer = new deps.PositionCloser(prisma);
          await closer.closePosition({
            userId: testUserId,
            positionId,
          });
        }
      } catch (error) {
        console.warn(`Failed to cleanup position ${positionId}:`, error);
      }
    }
    createdPositionIds = [];
  });

  describe('Full Cycle Latency', () => {
    it(
      'should measure full cycle (open + close) latency',
      async () => {
        if (!binanceInstance || !okxInstance) {
          console.log('Skipping: Both Binance and OKX required');
          return;
        }

        const Decimal = (await import('decimal.js')).default;
        const orchestrator = new deps.PositionOrchestrator(prisma);
        const closer = new deps.PositionCloser(prisma);
        const { symbol, maxQuantity, leverage } = getTestParams();
        const testQuantity = Math.min(maxQuantity, TEST_CONSTRAINTS.MAX_QUANTITY);

        console.log('\n⏱️ Measuring full cycle latency...');

        const cycleStart = Date.now();

        // 開倉
        const openStart = Date.now();
        const position = await orchestrator.openPosition({
          userId: testUserId,
          symbol,
          longExchange: 'binance',
          shortExchange: 'okx',
          quantity: new Decimal(testQuantity),
          leverage: leverage as 1 | 2,
        });
        const openLatency = Date.now() - openStart;

        // 平倉
        const closeStart = Date.now();
        const result = await closer.closePosition({
          userId: testUserId,
          positionId: position.id,
        });
        const closeLatency = Date.now() - closeStart;

        const cycleLatency = Date.now() - cycleStart;

        openLatencies.push(openLatency);
        closeLatencies.push(closeLatency);
        cycleLatencies.push(cycleLatency);

        console.log(`   Open: ${openLatency}ms`);
        console.log(`   Close: ${closeLatency}ms`);
        console.log(`   Total: ${cycleLatency}ms`);
        console.log(`   Target: <${PERFORMANCE_TARGETS.FULL_CYCLE_MS}ms`);

        if (result.success) {
          console.log(`   PnL: ${result.trade.totalPnL} USDT`);
        }

        expect(result.success).toBe(true);
        expect(cycleLatency).toBeLessThan(PERFORMANCE_TARGETS.FULL_CYCLE_MS);
      },
      TEST_TIMEOUT,
    );
  });
});

// Mock 測試（永遠執行）
describe('Position Trading Latency (Mock)', () => {
  it('should validate performance targets', () => {
    expect(PERFORMANCE_TARGETS.BILATERAL_OPEN_MS).toBe(5000);
    expect(PERFORMANCE_TARGETS.BILATERAL_CLOSE_MS).toBe(5000);
    expect(PERFORMANCE_TARGETS.FULL_CYCLE_MS).toBe(10000);
  });

  it('should check trading performance test flag correctly', () => {
    const originalValue = process.env.TRADING_PERFORMANCE_TEST;

    process.env.TRADING_PERFORMANCE_TEST = 'true';
    expect(canRunTradingPerformanceTests()).toBe(true);

    process.env.TRADING_PERFORMANCE_TEST = 'false';
    expect(canRunTradingPerformanceTests()).toBe(false);

    // 還原
    if (originalValue) {
      process.env.TRADING_PERFORMANCE_TEST = originalValue;
    } else {
      delete process.env.TRADING_PERFORMANCE_TEST;
    }
  });

  it('should display performance test instructions', () => {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📊 Position Trading Latency Test');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Performance Targets:');
    console.log('─'.repeat(40));
    console.log(`  Bilateral Open:   <${PERFORMANCE_TARGETS.BILATERAL_OPEN_MS}ms`);
    console.log(`  Bilateral Close:  <${PERFORMANCE_TARGETS.BILATERAL_CLOSE_MS}ms`);
    console.log(`  Full Cycle:       <${PERFORMANCE_TARGETS.FULL_CYCLE_MS}ms`);
    console.log('');
    console.log('To run actual performance tests:');
    console.log('  1. Configure Testnet API Keys in .env.test');
    console.log('  2. Run: TRADING_PERFORMANCE_TEST=true pnpm test tests/performance/trading/position-latency.test.ts');
    console.log('═'.repeat(60));

    expect(true).toBe(true);
  });
});
